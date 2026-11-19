import type { NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { assertOriginAllowed } from '@/lib/auth';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createAdminClient, createCookieClient } from '@/lib/supabase';
import { emailValue, optionalText, passwordValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function isConflictError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('sudah terdaftar')
  );
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email', 'password', 'full_name'], 'body');
    const email = emailValue(body.email);
    const password = passwordValue(body.password);
    const fullName = optionalText(body.full_name, 'full_name', 1, 120);
    assertOriginAllowed(req);

    const env = readSupabaseAdminEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }

    const ip = clientIp(req);
    const limited = await enforceRateLimits(env, [
      {
        bucket: 'signup:ip',
        key: ip,
        max: 5,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
      {
        bucket: 'signup:email',
        key: email,
        max: 3,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
    ]);
    if (limited) return limited;

    const admin = createAdminClient(env);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      ...(fullName ? { user_metadata: { full_name: fullName } } : {}),
    });

    if (createError || !created.user) {
      if (createError?.status === 429) {
        throw new ApiError(429, 'rate_limited', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
      }
      if (isConflictError(createError)) {
        throw new ApiError(409, 'conflict', 'Email sudah terdaftar.');
      }
      throw new ApiError(400, 'signup_failed', 'Pendaftaran tidak dapat diproses.');
    }

    const supabase = await createCookieClient(env);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) {
      if (error?.status === 429) {
        throw new ApiError(429, 'rate_limited', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
      }
      throw new ApiError(400, 'signup_failed', 'Pendaftaran tidak dapat diproses.');
    }

    return ok({ user: { id: data.user.id, email: data.user.email ?? email } }, 201);
  });
}
