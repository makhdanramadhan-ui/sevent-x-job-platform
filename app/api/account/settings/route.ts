import type { NextRequest } from 'next/server';
import { assertOriginAllowed, requireAuth } from '@/lib/auth';
import {
  assertAccountSettingsSecret,
  assertCanDeleteAccount,
  assertCanManageCredentials,
  canDeleteAccount,
  canManageCredentials,
  clearAuthCookies,
  consumeAccountSettingChallenge,
  digestAccountCode,
  mapChallengeConsumeError,
  verifyCurrentPassword,
} from '@/lib/account-settings';
import { removeAllUserAvatarObjects } from '@/lib/avatar';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function parseConfirmation(value: unknown): 'HAPUS' {
  if (value !== 'HAPUS') {
    throw new ApiError(400, 'validation_error', 'Konfirmasi penghapusan tidak valid.', {
      field: 'confirmation',
    });
  }
  return 'HAPUS';
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

function parseCode(value: unknown, field: 'currentCode'): string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) {
    throw new ApiError(400, 'validation_error', 'Input kode harus berupa 8 digit.', { field });
  }
  return value;
}

function parseVerificationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(400, 'validation_error', 'Input verificationId tidak valid.', {
      field: 'verificationId',
    });
  }
  return value.toLowerCase();
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const canManage = await canManageCredentials(auth.user, auth.supabase);
    return ok({
      email: auth.user.email ?? '',
      canManageCredentials: canManage,
      canDeleteAccount: canDeleteAccount(auth.user),
    });
  });
}

export async function DELETE(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const env = readSupabaseAdminEnv();
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    assertOriginAllowed(req);

    const ip = clientIp(req);
    const limited = await enforceRateLimits(env, [
      {
        bucket: 'account-settings:delete:ip',
        key: ip,
        max: 10,
        windowSeconds: 15 * 60,
        mode: 'fail-closed',
      },
      {
        bucket: 'account-settings:delete:user',
        key: auth.user.id,
        max: 5,
        windowSeconds: 15 * 60,
        mode: 'fail-closed',
      },
    ]);
    if (limited) return limited;

    const body = asObject(await readJson(req, 8 * 1024), 'body');
    const hasPasswordFlow = 'currentPassword' in body;
    const hasCodeFlow = 'verificationId' in body || 'currentCode' in body;

    if (hasPasswordFlow) {
      rejectUnknownKeys(body, ['currentPassword', 'confirmation'], 'body');
      const currentPassword = parseCurrentPassword(body.currentPassword);
      parseConfirmation(body.confirmation);
      await assertCanManageCredentials(auth.user, auth.supabase);
      const email = auth.user.email;
      if (!email) {
        throw new ApiError(400, 'invalid_request', 'Email akun tidak tersedia.');
      }
      await verifyCurrentPassword(env, email, currentPassword);
    } else if (hasCodeFlow) {
      rejectUnknownKeys(body, ['verificationId', 'currentCode', 'confirmation'], 'body');
      assertAccountSettingsSecret();
      assertCanDeleteAccount(auth.user);
      const verificationId = parseVerificationId(body.verificationId);
      const currentCode = parseCode(body.currentCode, 'currentCode');
      parseConfirmation(body.confirmation);
      const email = auth.user.email;
      if (!email) {
        throw new ApiError(400, 'invalid_request', 'Email akun tidak tersedia.');
      }
      const secret = assertAccountSettingsSecret();
      const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'delete', 'current', email, currentCode);
      const consumed = await consumeAccountSettingChallenge(env, {
        challengeId: verificationId,
        userId: auth.user.id,
        action: 'delete',
        currentEmail: email,
        targetEmail: null,
        currentCodeDigest,
        newCodeDigest: null,
      });
      if (consumed.status !== 'ok') {
        throw mapChallengeConsumeError(consumed.status);
      }
    } else {
      throw new ApiError(400, 'validation_error', 'Body permintaan tidak valid.', { field: 'body' });
    }

    // Re-check trusted session/user state right before destructive operation.
    const admin = createAdminClient(env);
    const { data: fresh, error: freshError } = await admin.auth.admin.getUserById(auth.user.id);
    if (freshError || !fresh?.user) {
      throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa.');
    }
    if (!fresh.user.email || fresh.user.email.toLowerCase() !== (auth.user.email ?? '').toLowerCase()) {
      throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa.');
    }

    try {
      await removeAllUserAvatarObjects(env, auth.user.id);
    } catch (error) {
      console.error('[account-settings] avatar cleanup failed before delete', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw new ApiError(500, 'delete_failed', 'Gagal menghapus akun. Coba lagi.');
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(auth.user.id);
    if (deleteError) {
      console.error('[account-settings] deleteUser failed', { message: deleteError.message });
      throw new ApiError(500, 'delete_failed', 'Gagal menghapus akun. Coba lagi.');
    }

    const response = ok({ status: 'deleted' });
    clearAuthCookies(response, req);
    return response;
  });
}
