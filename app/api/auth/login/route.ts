import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readSupabaseAdminEnv, readSupabaseEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { assertOriginAllowed } from '@/lib/auth';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createCookieClient } from '@/lib/supabase';
import { emailValue, passwordValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email', 'password'], 'body');
    const email = emailValue(body.email);
    const password = passwordValue(body.password);
    assertOriginAllowed(req);

    const adminEnv = readSupabaseAdminEnv();
    if (adminEnv) {
      const limited = await enforceRateLimits(adminEnv, [
        {
          bucket: 'login:ip',
          key: clientIp(req),
          max: 10,
          windowSeconds: 15 * 60,
          mode: 'fail-open',
        },
      ]);
      if (limited) return limited;
    } else {
      console.error('[rate-limit] fail-open', {
        bucket: 'login:ip',
        message: 'SUPABASE_SERVICE_ROLE_KEY tidak tersedia',
      });
    }

    const env = readSupabaseEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    const supabase = await createCookieClient(env);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      if (error?.status === 429) {
        throw new ApiError(429, 'rate_limited', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
      }
      throw new ApiError(401, 'invalid_credentials', 'Email atau password salah.');
    }

    if (!data.user.email_confirmed_at) {
      const provider = (data.user.app_metadata as { provider?: string } | undefined)?.provider;
      const providers = (data.user.app_metadata as { providers?: string[] } | undefined)?.providers;
      const isEmailProvider =
        provider === 'email' || (Array.isArray(providers) && providers.includes('email'));
      if (isEmailProvider) {
        await supabase.auth.signOut().catch(() => undefined);
        const store = await cookies();
        const responseCookiesToClear: string[] = [];
        for (const c of store.getAll()) {
          if (c.name.startsWith('sb-')) responseCookiesToClear.push(c.name);
        }
        const bodyOut = { error: { code: 'email_not_confirmed', message: 'Email belum diverifikasi.' } };
        const res = NextResponse.json(bodyOut, { status: 403 });
        for (const name of responseCookiesToClear) {
          res.cookies.delete(name);
        }
        return res;
      }
    }

    return ok({ user: { id: data.user.id, email: data.user.email ?? email } });
  });
}
