import type { NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { resolveSiteUrl, readSmtpConfig, sendMatchEmail } from '@/lib/email/transport';
import { buildVerificationEmail } from '@/lib/email/verification';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { assertOriginAllowed } from '@/lib/auth';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase';
import { emailValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

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
        bucket: 'resend:ip',
        key: ip,
        max: 10,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
      {
        bucket: 'resend:email',
        key: email,
        max: 3,
        windowSeconds: 60 * 60,
        mode: 'fail-closed',
      },
    ]);
    if (limited) return limited;

    const smtpConfig = readSmtpConfig();
    if (!smtpConfig) {
      return ok({ status: 'sent_if_pending' });
    }

    const admin = createAdminClient(env);

    let targetUserId: string | null = null;
    let targetProviderIsEmail = false;
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) break;
      const users = data?.users ?? [];
      const found = users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
      if (found) {
        targetUserId = found.id;
        const provider = (found.app_metadata as { provider?: string } | undefined)?.provider;
        const providers = (found.app_metadata as { providers?: string[] } | undefined)?.providers;
        targetProviderIsEmail =
          provider === 'email' || (Array.isArray(providers) && providers.includes('email'));
        break;
      }
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break;
    }

    if (!targetUserId || !targetProviderIsEmail) {
      return ok({ status: 'sent_if_pending' });
    }

    const { data: userData, error: userErr } = await admin.auth.admin.getUserById(targetUserId);
    if (userErr || !userData?.user) {
      return ok({ status: 'sent_if_pending' });
    }
    if (userData.user.email_confirmed_at) {
      return ok({ status: 'sent_if_pending' });
    }

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
      return ok({ status: 'sent_if_pending' });
    }

    const verificationType = (linkData?.properties?.verification_type ?? 'magiclink') as string;
    const confirmUrl = `${siteUrl}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(verificationType)}`;

    try {
      const payload = buildVerificationEmail({ email, confirmUrl });
      const sendResult = await sendMatchEmail(smtpConfig, {
        to: email,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      const toDomain = email.includes('@') ? email.split('@')[1] : 'unknown';
      console.log('[resend-verification] verification email sent', {
        toDomain,
        messageId: sendResult.messageId || null,
        accepted: sendResult.accepted,
        rejected: sendResult.rejected,
      });
    } catch (err) {
      console.error('[resend-verification] send failed', err);
      return ok({ status: 'sent_if_pending' });
    }

    return ok({ status: 'sent_if_pending' });
  });
}
