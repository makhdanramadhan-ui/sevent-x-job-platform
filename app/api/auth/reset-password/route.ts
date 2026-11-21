import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readSupabaseAdminEnv } from '@/lib/env';
import { assertOriginAllowed } from '@/lib/auth';
import { ApiError, asObject, fail, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { clientIp } from '@/lib/rate-limit';
import { validatePassword } from '@/lib/password-policy';
import { createAdminClient } from '@/lib/supabase';
import { emailValue, text } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const RESET_ATTEMPT_MAX = 5;
export const RESET_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export function parseResetCode(value: unknown): string {
  const raw = text(value, 'code', 8, 8);
  if (!/^\d{8}$/.test(raw)) {
    throw new ApiError(400, 'validation_error', 'Input code harus berupa 8 digit.', { field: 'code' });
  }
  return raw;
}

export function parseNewPassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'validation_error', 'Input password harus berupa teks.', { field: 'password' });
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < 1 || bytes > 72) {
    throw new ApiError(400, 'validation_error', 'Input password harus memiliki 1-72 byte.', { field: 'password' });
  }
  return value;
}

type ConsumeResult = { allowed: boolean; retryAfter: number };

async function consumeAttempt(
  admin: ReturnType<typeof createAdminClient>,
  bucket: string,
  key: string,
  max: number,
): Promise<ConsumeResult> {
  const { data, error } = await admin.rpc('consume_rate_limit', {
    bucket,
    key,
    max,
    window_seconds: RESET_ATTEMPT_WINDOW_SECONDS,
  });
  if (error) throw new Error(`consume_rate_limit failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('consume_rate_limit returned invalid result');
  const record = row as Record<string, unknown>;
  if (typeof record.allowed !== 'boolean' || typeof record.retry_after !== 'number') {
    throw new Error('consume_rate_limit returned invalid result');
  }
  return { allowed: record.allowed, retryAfter: Math.max(1, Math.floor(record.retry_after)) };
}

export function tooManyAttempts(retryAfter: number): NextResponse {
  const seconds = Math.max(1, Math.floor(retryAfter || RESET_ATTEMPT_WINDOW_SECONDS));
  return NextResponse.json(
    {
      error: {
        code: 'too_many_attempts',
        message: 'Terlalu sering, coba lagi nanti.',
      },
    },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email', 'code', 'password'], 'body');
    const email = emailValue(body.email);
    const code = parseResetCode(body.code);
    const password = parseNewPassword(body.password);
    assertOriginAllowed(req);

    const policy = validatePassword(password);
    if (!policy.ok) {
      throw new ApiError(400, 'weak_password', 'Password belum memenuhi kebijakan.', {
        failures: policy.failures,
      });
    }

    const env = readSupabaseAdminEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }

    const admin = createAdminClient(env);

    for (const check of [
      { bucket: 'reset-password:email', key: email, max: RESET_ATTEMPT_MAX },
      { bucket: 'reset-password:ip', key: clientIp(req), max: 20 },
    ]) {
      let result: ConsumeResult;
      try {
        result = await consumeAttempt(admin, check.bucket, check.key, check.max);
      } catch (error) {
        console.error('[reset-password] rate limit failed closed', {
          bucket: check.bucket,
          message: error instanceof Error ? error.message : String(error),
        });
        return fail(429, 'too_many_attempts', 'Terlalu sering, coba lagi nanti.');
      }
      if (!result.allowed) return tooManyAttempts(result.retryAfter);
    }

    const anon = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await anon.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    });

    if (error || !data.user || !data.session) {
      throw new ApiError(400, 'invalid_code', 'Kode salah atau kedaluwarsa.');
    }

    const userId = data.user.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error('[reset-password] updateUserById failed', {
        message: updateError.message,
        status: updateError.status,
      });
      throw new ApiError(500, 'reset_failed', 'Gagal mengatur ulang password.');
    }

    const { data: refreshed, error: refreshError } = await admin.auth.admin.getUserById(userId);
    if (refreshError || !refreshed?.user?.email_confirmed_at) {
      console.error('[reset-password] email confirmation check failed', {
        message: refreshError?.message ?? 'email_confirmed_at missing',
      });
      throw new ApiError(500, 'reset_failed', 'Gagal mengonfirmasi email.');
    }

    try {
      const revokeClient = createClient(env.url, env.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      await revokeClient.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      const { error: signOutError } = await revokeClient.auth.signOut({ scope: 'global' });
      if (signOutError) {
        console.error('[reset-password] global signout failed', { message: signOutError.message });
      }
    } catch (err) {
      console.error('[reset-password] global signout failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    }

    return ok({ status: 'password_reset' });
  });
}
