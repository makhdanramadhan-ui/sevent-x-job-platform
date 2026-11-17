import type { NextRequest } from 'next/server';
import { readSupabaseEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { createCookieClient } from '@/lib/supabase';
import { emailValue, optionalText, passwordValue } from '@/lib/validation';
import { assertOriginAllowed } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email', 'password', 'full_name'], 'body');
    const email = emailValue(body.email);
    const password = passwordValue(body.password);
    const fullName = optionalText(body.full_name, 'full_name', 1, 120);
    assertOriginAllowed(req);
    const env = readSupabaseEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    const supabase = await createCookieClient(env);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: fullName ? { data: { full_name: fullName } } : undefined,
    });
    if (error || !data.user) {
      if (error?.status === 429) {
        throw new ApiError(429, 'rate_limited', 'Terlalu banyak percobaan. Coba lagi nanti.');
      }
      throw new ApiError(400, 'signup_failed', 'Pendaftaran tidak dapat diproses.');
    }
    return ok(
      {
        user: { id: data.user.id, email: data.user.email ?? email },
        requires_email_confirmation: !data.session,
      },
      201,
    );
  });
}
