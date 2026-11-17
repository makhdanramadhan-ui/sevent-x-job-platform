import type { NextRequest } from 'next/server';
import { readSupabaseEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { createCookieClient } from '@/lib/supabase';
import { emailValue, passwordValue } from '@/lib/validation';
import { assertOriginAllowed } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email', 'password'], 'body');
    const email = emailValue(body.email);
    const password = passwordValue(body.password);
    assertOriginAllowed(req);
    const env = readSupabaseEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    const supabase = await createCookieClient(env);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      if (error?.status === 429) {
        throw new ApiError(429, 'rate_limited', 'Terlalu banyak percobaan. Coba lagi nanti.');
      }
      throw new ApiError(401, 'invalid_credentials', 'Email atau password salah.');
    }
    return ok({ user: { id: data.user.id, email: data.user.email ?? email } });
  });
}
