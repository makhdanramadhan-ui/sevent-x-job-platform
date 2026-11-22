import type { NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { assertOriginAllowed } from '@/lib/auth';
import { buildForgotPasswordEmail } from '@/lib/email/forgot-password';
import { readSmtpConfig, sendMatchEmail } from '@/lib/email/transport';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase';
import { emailValue } from '@/lib/validation';
import { FORGOT_PASSWORD_STATUS } from '@/lib/forgot-password';

export const dynamic = 'force-dynamic';

function toDomain(email: string): string {
  return email.includes('@') ? email.split('@')[1].toLowerCase() : 'unknown';
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['email'], 'body');
    const email = emailValue(body.email);
    assertOriginAllowed(req);

    const env = readSupabaseAdminEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }

    const ip = clientIp(req);
    const limited = await enforceRateLimits(env, [
      {
        bucket: 'forgot-password:ip',
        key: ip,
        max: 10,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
      {
        bucket: 'forgot-password:email',
        key: email,
        max: 3,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
    ]);
    if (limited) return limited;

    const smtpConfig = readSmtpConfig();
    if (!smtpConfig) {
      return ok(FORGOT_PASSWORD_STATUS);
    }

    const admin = createAdminClient(env);

    let targetUser: { id: string; emailConfirmed: boolean; hasEmailProvider: boolean } | null = null;
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('[forgot-password] listUsers failed', { message: error.message });
        return ok(FORGOT_PASSWORD_STATUS);
      }
      const users = data?.users ?? [];
      const found = users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
      if (found) {
        const provider = (found.app_metadata as { provider?: string } | undefined)?.provider;
        const providers = (found.app_metadata as { providers?: string[] } | undefined)?.providers;
        const hasEmailProvider =
          provider === 'email' || (Array.isArray(providers) && providers.includes('email'));
        targetUser = {
          id: found.id,
          emailConfirmed: Boolean(found.email_confirmed_at),
          hasEmailProvider,
        };
        break;
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    if (!targetUser || !targetUser.hasEmailProvider) {
      return ok(FORGOT_PASSWORD_STATUS);
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    const emailOtp = linkData?.properties?.email_otp;
    if (linkError || !emailOtp || !/^\d{8}$/.test(emailOtp)) {
      console.error('[forgot-password] generateLink failed', {
        hasError: Boolean(linkError),
        message: linkError?.message,
        hasEmailOtp: Boolean(emailOtp),
      });
      return ok(FORGOT_PASSWORD_STATUS);
    }

    const payload = buildForgotPasswordEmail({ email, code: emailOtp });
    try {
      const sendResult = await sendMatchEmail(smtpConfig, {
        to: email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      console.log('[forgot-password] recovery email sent', {
        toDomain: toDomain(email),
        messageId: sendResult.messageId || null,
        accepted: sendResult.accepted,
        rejected: sendResult.rejected,
      });
    } catch (err) {
      const e = err as Record<string, unknown> | null;
      console.error('[forgot-password] send failed', {
        toDomain: toDomain(email),
        message: err instanceof Error ? err.message : String(err),
        code: e && typeof e === 'object' ? e.code : undefined,
        responseCode: e && typeof e === 'object' ? e.responseCode : undefined,
        command: e && typeof e === 'object' ? e.command : undefined,
        response: e && typeof e.response === 'string' ? e.response.slice(0, 300) : undefined,
      });
    }

    return ok(FORGOT_PASSWORD_STATUS);
  });
}
