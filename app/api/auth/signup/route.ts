import type { NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { resolveSiteUrl, readSmtpConfig, sendMatchEmail } from '@/lib/email/transport';
import { buildVerificationEmail } from '@/lib/email/verification';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { assertOriginAllowed } from '@/lib/auth';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase';
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
      email_confirm: false,
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

    const userId = created.user.id;
    const siteUrl = resolveSiteUrl();
    const redirectTo = `${siteUrl}/auth/confirm`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    const hashedToken =
      linkData?.properties?.hashed_token ??
      (linkData?.properties as { hashedToken?: string } | undefined)?.hashedToken;

    if (linkError || !hashedToken) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new ApiError(503, 'email_send_failed', 'Gagal mengirim email verifikasi. Coba lagi.');
    }

    const verificationType = (linkData?.properties?.verification_type ?? 'magiclink') as string;
    const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}`;
    const smtpConfig = readSmtpConfig();
    if (!smtpConfig) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new ApiError(503, 'email_send_failed', 'Gagal mengirim email verifikasi. Coba lagi.');
    }

    const emailPayload = buildVerificationEmail({
      email,
      confirmUrl,
      expiresNote: 'Tautan verifikasi berlaku dalam waktu terbatas.',
    });

    try {
      await sendMatchEmail(smtpConfig, {
        to: email,
        subject: emailPayload.subject,
        html: emailPayload.html,
        text: emailPayload.text,
      });
    } catch (err) {
      console.error('[signup] email send failed', err);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new ApiError(503, 'email_send_failed', 'Gagal mengirim email verifikasi. Coba lagi.');
    }

    return ok({ status: 'verification_sent', email }, 201);
  });
}
