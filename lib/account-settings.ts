import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isEmailProviderUser } from './auth';
import { readAccountSettingsSecret } from './env';
import { ApiError } from './http';
import { clientIp, enforceRateLimits, rateLimitResponse } from './rate-limit';
import { readSmtpConfig, sendMatchEmail } from './email/transport';
import type { SupabaseAdminEnv } from './env';
import { createAdminClient } from './supabase';
import { buildAccountSettingsEmail } from './email/account-settings';
import type { NextRequest } from 'next/server';

export const ACCOUNT_SETTINGS_CHALLENGE_TTL_SECONDS = 15 * 60;
export const ACCOUNT_SETTINGS_MAX_ATTEMPTS = 5;
export const ACCOUNT_SETTINGS_REQUEST_IP_MAX = 10;
export const ACCOUNT_SETTINGS_REQUEST_USER_MAX = 5;
export const ACCOUNT_SETTINGS_CONFIRM_IP_MAX = 20;
export const ACCOUNT_SETTINGS_CONFIRM_USER_MAX = 10;
export const ACCOUNT_SETTINGS_REQUEST_WINDOW_SECONDS = 60 * 60;
export const ACCOUNT_SETTINGS_CONFIRM_WINDOW_SECONDS = 15 * 60;

export type AccountSettingsAction = 'email' | 'password' | 'delete';

type ChallengeRow = {
  id: string;
  user_id: string;
  action: AccountSettingsAction;
  current_email: string;
  target_email: string | null;
  current_code_digest: string;
  new_code_digest: string | null;
  expires_at: string;
  consumed_at: string | null;
  failed_attempts: number;
  created_at: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertAccountSettingsSecret(): string {
  const secret = readAccountSettingsSecret();
  if (!secret) {
    throw new ApiError(503, 'account_settings_not_configured', 'Pengaturan akun belum dikonfigurasi.');
  }
  return secret;
}

export function assertSmtpConfigured(): void {
  if (!readSmtpConfig()) {
    throw new ApiError(503, 'email_not_configured', 'Layanan email belum dikonfigurasi.');
  }
}

export function isGoogleOnlyUser(user: User): boolean {
  const providers = (user.app_metadata as { providers?: string[] } | undefined)?.providers;
  if (Array.isArray(providers) && providers.length > 0) {
    return providers.every((provider) => provider === 'google');
  }
  const provider = (user.app_metadata as { provider?: string } | undefined)?.provider;
  return provider === 'google';
}

export async function hasPasswordAmr(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa.');
  }
  const methods = data.currentAuthenticationMethods ?? [];
  return methods.some((entry) => {
    if (typeof entry === 'string') return entry === 'password';
    return entry.method === 'password';
  });
}

export async function assertCanManageCredentials(user: User, supabase: SupabaseClient): Promise<void> {
  if (isGoogleOnlyUser(user) || !isEmailProviderUser(user)) {
    throw new ApiError(
      403,
      'credentials_managed_by_google',
      'Kredensial akun ini dikelola oleh Google. Gunakan pengaturan akun Google Anda.',
    );
  }
  if (!user.email_confirmed_at) {
    throw new ApiError(403, 'email_not_confirmed', 'Email belum diverifikasi.');
  }
  const passwordAmr = await hasPasswordAmr(supabase);
  if (!passwordAmr) {
    throw new ApiError(
      403,
      'credentials_managed_by_google',
      'Kredensial akun ini dikelola oleh Google. Gunakan pengaturan akun Google Anda.',
    );
  }
}

export async function canManageCredentials(user: User, supabase: SupabaseClient): Promise<boolean> {
  try {
    await assertCanManageCredentials(user, supabase);
    return true;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === 'credentials_managed_by_google' || error.code === 'email_not_confirmed')
    ) {
      return false;
    }
    throw error;
  }
}

export function canDeleteAccount(user: User): boolean {
  return Boolean(user.email_confirmed_at && user.email);
}

export function assertCanDeleteAccount(user: User): void {
  if (!user.email_confirmed_at || !user.email) {
    throw new ApiError(403, 'email_not_confirmed', 'Email belum diverifikasi.');
  }
}

export async function verifyCurrentPassword(
  env: SupabaseAdminEnv,
  email: string,
  password: string,
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) {
    throw new ApiError(400, 'invalid_current_password', 'Password saat ini salah.');
  }
}

export function generateOtpCode(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

export function digestAccountCode(
  secret: string,
  challengeId: string,
  userId: string,
  action: AccountSettingsAction,
  purpose: 'current' | 'new',
  email: string,
  code: string,
): string {
  const payload = [
    'account-settings-v1',
    challengeId,
    userId,
    action,
    purpose,
    normalizeEmail(email),
    code,
  ].join('\n');
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length || aBuf.length === 0) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function enforceAccountSettingsRequestLimits(
  env: SupabaseAdminEnv,
  req: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  return enforceRateLimits(env, [
    {
      bucket: 'account-settings:request:ip',
      key: ip,
      max: ACCOUNT_SETTINGS_REQUEST_IP_MAX,
      windowSeconds: ACCOUNT_SETTINGS_REQUEST_WINDOW_SECONDS,
      mode: 'fail-closed',
    },
    {
      bucket: 'account-settings:request:user',
      key: userId,
      max: ACCOUNT_SETTINGS_REQUEST_USER_MAX,
      windowSeconds: ACCOUNT_SETTINGS_REQUEST_WINDOW_SECONDS,
      mode: 'fail-closed',
    },
  ]);
}

export async function enforceAccountSettingsConfirmLimits(
  env: SupabaseAdminEnv,
  req: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  return enforceRateLimits(env, [
    {
      bucket: 'account-settings:confirm:ip',
      key: ip,
      max: ACCOUNT_SETTINGS_CONFIRM_IP_MAX,
      windowSeconds: ACCOUNT_SETTINGS_CONFIRM_WINDOW_SECONDS,
      mode: 'fail-closed',
    },
    {
      bucket: 'account-settings:confirm:user',
      key: userId,
      max: ACCOUNT_SETTINGS_CONFIRM_USER_MAX,
      windowSeconds: ACCOUNT_SETTINGS_CONFIRM_WINDOW_SECONDS,
      mode: 'fail-closed',
    },
  ]);
}

export function accountSettingsRateLimitResponse(retryAfter: number): NextResponse {
  return rateLimitResponse(retryAfter);
}

export async function createAccountSettingChallenge(
  env: SupabaseAdminEnv,
  input: {
    id: string;
    userId: string;
    action: AccountSettingsAction;
    currentEmail: string;
    targetEmail: string | null;
    currentCodeDigest: string;
    newCodeDigest: string | null;
  },
): Promise<void> {
  const admin = createAdminClient(env);
  const expiresAt = new Date(Date.now() + ACCOUNT_SETTINGS_CHALLENGE_TTL_SECONDS * 1000).toISOString();
  const { error } = await admin.from('account_setting_challenges').insert({
    id: input.id,
    user_id: input.userId,
    action: input.action,
    current_email: normalizeEmail(input.currentEmail),
    target_email: input.targetEmail ? normalizeEmail(input.targetEmail) : null,
    current_code_digest: input.currentCodeDigest,
    new_code_digest: input.newCodeDigest,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('[account-settings] create challenge failed', { message: error.message });
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
}

export async function readAccountSettingChallenge(
  env: SupabaseAdminEnv,
  verificationId: string,
): Promise<ChallengeRow | null> {
  const admin = createAdminClient(env);
  const { data, error } = await admin
    .from('account_setting_challenges')
    .select(
      'id, user_id, action, current_email, target_email, current_code_digest, new_code_digest, expires_at, consumed_at, failed_attempts, created_at',
    )
    .eq('id', verificationId)
    .maybeSingle();
  if (error) {
    console.error('[account-settings] read challenge failed', { message: error.message });
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
  return (data as ChallengeRow | null) ?? null;
}

export async function consumeAccountSettingChallenge(
  env: SupabaseAdminEnv,
  input: {
    challengeId: string;
    userId: string;
    action: AccountSettingsAction;
    currentEmail: string;
    targetEmail: string | null;
    currentCodeDigest: string;
    newCodeDigest: string | null;
  },
): Promise<{ status: string; failedAttempts: number }> {
  const admin = createAdminClient(env);
  const { data, error } = await admin.rpc('consume_account_setting_challenge', {
    p_challenge_id: input.challengeId,
    p_user_id: input.userId,
    p_action: input.action,
    p_current_email: normalizeEmail(input.currentEmail),
    p_target_email: input.targetEmail ? normalizeEmail(input.targetEmail) : null,
    p_current_code_digest: input.currentCodeDigest,
    p_new_code_digest: input.newCodeDigest,
    p_max_attempts: ACCOUNT_SETTINGS_MAX_ATTEMPTS,
  });
  if (error) {
    console.error('[account-settings] consume challenge failed', { message: error.message });
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
  const row = Array.isArray(data) ? data[0] : data;
  const status = row && typeof row === 'object' ? (row as { status?: unknown }).status : null;
  const failedAttemptsRaw =
    row && typeof row === 'object' ? (row as { failed_attempts?: unknown }).failed_attempts : 0;
  const failedAttempts = typeof failedAttemptsRaw === 'number' ? failedAttemptsRaw : 0;
  if (typeof status !== 'string') {
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
  return { status, failedAttempts };
}

export async function sendAccountSettingCodes(input: {
  action: AccountSettingsAction;
  currentEmail: string;
  currentCode: string;
  targetEmail?: string;
  newCode?: string;
}): Promise<void> {
  const smtpConfig = readSmtpConfig();
  if (!smtpConfig) {
    throw new ApiError(503, 'email_not_configured', 'Layanan email belum dikonfigurasi.');
  }

  const currentPayload = buildAccountSettingsEmail({
    action: input.action,
    email: input.currentEmail,
    code: input.currentCode,
    purpose: 'current',
  });
  try {
    await sendMatchEmail(smtpConfig, {
      to: input.currentEmail,
      subject: currentPayload.subject,
      html: currentPayload.html,
      text: currentPayload.text,
    });
  } catch (error) {
    console.error('[account-settings] send current email failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError(503, 'email_send_failed', 'Gagal mengirim email verifikasi. Coba lagi.');
  }

  if (input.action === 'email') {
    const targetEmail = input.targetEmail;
    const newCode = input.newCode;
    if (!targetEmail || !newCode) {
      throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
    }
    const newPayload = buildAccountSettingsEmail({
      action: input.action,
      email: targetEmail,
      code: newCode,
      purpose: 'new',
    });
    try {
      await sendMatchEmail(smtpConfig, {
        to: targetEmail,
        subject: newPayload.subject,
        html: newPayload.html,
        text: newPayload.text,
      });
    } catch (error) {
      console.error('[account-settings] send new email failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(503, 'email_send_failed', 'Gagal mengirim email verifikasi. Coba lagi.');
    }
  }
}

export function mapChallengeConsumeError(status: string): ApiError {
  if (status === 'expired') {
    return new ApiError(400, 'invalid_code', 'Kode verifikasi kedaluwarsa. Minta kode baru.');
  }
  if (status === 'consumed' || status === 'not_found') {
    return new ApiError(400, 'invalid_code', 'Kode verifikasi tidak valid atau sudah digunakan.');
  }
  if (status === 'too_many_attempts') {
    return new ApiError(429, 'too_many_attempts', 'Terlalu banyak percobaan kode. Minta kode baru.');
  }
  if (status === 'mismatch') {
    return new ApiError(400, 'invalid_code', 'Kode verifikasi salah.');
  }
  return new ApiError(400, 'invalid_code', 'Kode verifikasi tidak valid.');
}

export async function revokeUserSessions(
  env: SupabaseAdminEnv,
  userId: string,
  accessToken: string | null,
): Promise<void> {
  const admin = createAdminClient(env);
  // Mark session invalidation time for access-token lifetime accounting.
  const { data: userData, error: readError } = await admin.auth.admin.getUserById(userId);
  if (readError || !userData?.user) {
    console.error('[account-settings] getUserById before revoke failed', { message: readError?.message });
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
  const appMetadata = (userData.user.app_metadata ?? {}) as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...appMetadata, sessions_invalidated_at: nowIso },
  });
  if (updateError) {
    console.error('[account-settings] sessions_invalidated_at update failed', { message: updateError.message });
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }

  if (accessToken) {
    try {
      await admin.auth.admin.signOut(accessToken, 'global');
    } catch (error) {
      console.error('[account-settings] admin global signOut failed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function clearAuthCookies(response: NextResponse, req: NextRequest): void {
  for (const cookie of req.cookies.getAll()) {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.delete(cookie.name);
    }
  }
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf8');
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readTokenIat(token: string | null): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const iat = payload?.iat;
  return typeof iat === 'number' && Number.isFinite(iat) ? iat : null;
}

export function isSessionInvalidated(user: User, accessToken: string | null): boolean {
  const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const invalidatedAtRaw = appMeta.sessions_invalidated_at;
  if (typeof invalidatedAtRaw !== 'string' || !invalidatedAtRaw) return false;
  const invalidatedAt = Date.parse(invalidatedAtRaw);
  if (!Number.isFinite(invalidatedAt)) return false;
  const iat = readTokenIat(accessToken);
  if (iat === null) {
    // Conservative: if we cannot determine token age, reject invalidated sessions.
    return true;
  }
  return iat * 1000 < invalidatedAt;
}

export function assertSessionNotInvalidated(user: User, accessToken: string | null): void {
  if (isSessionInvalidated(user, accessToken)) {
    throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa.');
  }
}

export async function findEmailOwner(
  env: SupabaseAdminEnv,
  email: string,
): Promise<{ id: string } | null> {
  const admin = createAdminClient(env);
  const target = normalizeEmail(email);
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('[account-settings] listUsers failed', { message: error.message });
      throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
    }
    const users = data?.users ?? [];
    const found = users.find((u) => normalizeEmail(u.email ?? '') === target);
    if (found) return { id: found.id };
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return null;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
