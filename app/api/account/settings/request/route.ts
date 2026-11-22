import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  assertAccountSettingsSecret,
  assertCanDeleteAccount,
  assertCanManageCredentials,
  createAccountSettingChallenge,
  digestAccountCode,
  enforceAccountSettingsRequestLimits,
  generateOtpCode,
  sendAccountSettingCodes,
  verifyCurrentPassword,
  findEmailOwner,
} from '@/lib/account-settings';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { emailValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function parseAction(value: unknown): 'email' | 'password' | 'delete' {
  if (value !== 'email' && value !== 'password' && value !== 'delete') {
    throw new ApiError(400, 'validation_error', 'Input action tidak valid.', { field: 'action' });
  }
  return value;
}

function parseCurrentPassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'validation_error', 'Input currentPassword harus berupa teks.', {
      field: 'currentPassword',
    });
  }
  if (value.length < 1 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new ApiError(400, 'validation_error', 'Input currentPassword tidak valid.', {
      field: 'currentPassword',
    });
  }
  return value;
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const env = readSupabaseAdminEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    const secret = assertAccountSettingsSecret();
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    const action = parseAction(body.action);

    const limited = await enforceAccountSettingsRequestLimits(env, req, auth.user.id);
    if (limited) return limited;

    const email = auth.user.email;
    if (!email) {
      throw new ApiError(400, 'invalid_request', 'Email akun tidak tersedia.');
    }

    if (action === 'delete') {
      rejectUnknownKeys(body, ['action'], 'body');
      assertCanDeleteAccount(auth.user);

      const verificationId = randomUUID();
      const currentCode = generateOtpCode();
      const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'delete', 'current', email, currentCode);

      await createAccountSettingChallenge(env, {
        id: verificationId,
        userId: auth.user.id,
        action: 'delete',
        currentEmail: email,
        targetEmail: null,
        currentCodeDigest,
        newCodeDigest: null,
      });

      await sendAccountSettingCodes({
        action: 'delete',
        currentEmail: email,
        currentCode,
      });

      return ok({ status: 'code_sent', verificationId });
    }

    if (action === 'password') {
      rejectUnknownKeys(body, ['action', 'currentPassword'], 'body');
      const currentPassword = parseCurrentPassword(body.currentPassword);
      await assertCanManageCredentials(auth.user, auth.supabase);
      await verifyCurrentPassword(env, email, currentPassword);

      const verificationId = randomUUID();
      const currentCode = generateOtpCode();
      const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'password', 'current', email, currentCode);

      await createAccountSettingChallenge(env, {
        id: verificationId,
        userId: auth.user.id,
        action: 'password',
        currentEmail: email,
        targetEmail: null,
        currentCodeDigest,
        newCodeDigest: null,
      });

      await sendAccountSettingCodes({
        action: 'password',
        currentEmail: email,
        currentCode,
      });

      return ok({ status: 'code_sent', verificationId });
    }

    // action === 'email'
    rejectUnknownKeys(body, ['action', 'currentPassword', 'newEmail'], 'body');
    const currentPassword = parseCurrentPassword(body.currentPassword);
    const newEmail = emailValue(body.newEmail);
    if (newEmail.toLowerCase() === email.toLowerCase()) {
      throw new ApiError(400, 'validation_error', 'Email baru harus berbeda dari email saat ini.', {
        field: 'newEmail',
      });
    }
    await assertCanManageCredentials(auth.user, auth.supabase);
    await verifyCurrentPassword(env, email, currentPassword);

    const existing = await findEmailOwner(env, newEmail);
    if (existing) {
      throw new ApiError(409, 'conflict', 'Email sudah terdaftar.');
    }

    const verificationId = randomUUID();
    const currentCode = generateOtpCode();
    const newCode = generateOtpCode();
    const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'email', 'current', email, currentCode);
    const newCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'email', 'new', newEmail, newCode);

    await createAccountSettingChallenge(env, {
      id: verificationId,
      userId: auth.user.id,
      action: 'email',
      currentEmail: email,
      targetEmail: newEmail,
      currentCodeDigest,
      newCodeDigest,
    });

    await sendAccountSettingCodes({
      action: 'email',
      currentEmail: email,
      currentCode,
      targetEmail: newEmail,
      newCode,
    });

    return ok({ status: 'code_sent', verificationId });
  });
}
