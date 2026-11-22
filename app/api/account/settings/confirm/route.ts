import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  assertAccountSettingsSecret,
  assertCanManageCredentials,
  clearAuthCookies,
  consumeAccountSettingChallenge,
  digestAccountCode,
  enforceAccountSettingsConfirmLimits,
  findEmailOwner,
  mapChallengeConsumeError,
} from '@/lib/account-settings';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { validatePassword } from '@/lib/password-policy';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function parseAction(value: unknown): 'email' | 'password' {
  if (value !== 'email' && value !== 'password') {
    throw new ApiError(400, 'validation_error', 'Input action tidak valid.', { field: 'action' });
  }
  return value;
}

function parseVerificationId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ApiError(400, 'validation_error', 'Input verificationId tidak valid.', {
      field: 'verificationId',
    });
  }
  return value.toLowerCase();
}

function parseCode(value: unknown, field: 'currentCode' | 'newCode'): string {
  if (typeof value !== 'string' || !/^\d{8}$/.test(value)) {
    throw new ApiError(400, 'validation_error', 'Input kode harus berupa 8 digit.', { field });
  }
  return value;
}

function parseNewPassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'validation_error', 'Input newPassword harus berupa teks.', {
      field: 'newPassword',
    });
  }
  if (Buffer.byteLength(value, 'utf8') < 1 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new ApiError(400, 'validation_error', 'Input newPassword harus memiliki 1-72 byte.', {
      field: 'newPassword',
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

    const limited = await enforceAccountSettingsConfirmLimits(env, req, auth.user.id);
    if (limited) return limited;

    const email = auth.user.email;
    if (!email) {
      throw new ApiError(400, 'invalid_request', 'Email akun tidak tersedia.');
    }

    await assertCanManageCredentials(auth.user, auth.supabase);

    const admin = createAdminClient(env);

    if (action === 'password') {
      rejectUnknownKeys(body, ['action', 'verificationId', 'currentCode', 'newPassword'], 'body');
      const verificationId = parseVerificationId(body.verificationId);
      const currentCode = parseCode(body.currentCode, 'currentCode');
      const newPassword = parseNewPassword(body.newPassword);
      const policy = validatePassword(newPassword);
      if (!policy.ok) {
        throw new ApiError(400, 'weak_password', 'Password belum memenuhi kebijakan.', {
          failures: policy.failures,
        });
      }

      const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'password', 'current', email, currentCode);
      const consumed = await consumeAccountSettingChallenge(env, {
        challengeId: verificationId,
        userId: auth.user.id,
        action: 'password',
        currentEmail: email,
        targetEmail: null,
        currentCodeDigest,
        newCodeDigest: null,
      });
      if (consumed.status !== 'ok') {
        throw mapChallengeConsumeError(consumed.status);
      }

      const { data: fresh, error: freshError } = await admin.auth.admin.getUserById(auth.user.id);
      if (freshError || !fresh?.user) {
        throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
      }
      const appMeta = (fresh.user.app_metadata ?? {}) as Record<string, unknown>;
      const nowIso = new Date().toISOString();
      const { error: updateError } = await admin.auth.admin.updateUserById(auth.user.id, {
        password: newPassword,
        app_metadata: { ...appMeta, sessions_invalidated_at: nowIso },
      });
      if (updateError) {
        console.error('[account-settings] password update failed', { message: updateError.message });
        throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
      }

      if (auth.accessToken) {
        try {
          await admin.auth.admin.signOut(auth.accessToken, 'global');
        } catch (error) {
          console.error('[account-settings] global signOut after password change failed', {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const response = ok({ status: 'updated' });
      clearAuthCookies(response, req);
      return response;
    }

    // action === 'email'
    rejectUnknownKeys(body, ['action', 'verificationId', 'currentCode', 'newCode'], 'body');
    const verificationId = parseVerificationId(body.verificationId);
    const currentCode = parseCode(body.currentCode, 'currentCode');
    const newCode = parseCode(body.newCode, 'newCode');

    // Read challenge to get target email for digest computation; consume RPC will revalidate binding.
    const { data: challenge, error: challengeError } = await admin
      .from('account_setting_challenges')
      .select('target_email, action, user_id')
      .eq('id', verificationId)
      .maybeSingle();
    if (challengeError) {
      console.error('[account-settings] read challenge failed', { message: challengeError.message });
      throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
    }
    if (!challenge || challenge.user_id !== auth.user.id || challenge.action !== 'email') {
      throw new ApiError(400, 'invalid_code', 'Kode verifikasi tidak valid atau sudah digunakan.');
    }
    const targetEmailRaw = challenge.target_email;
    if (typeof targetEmailRaw !== 'string' || !targetEmailRaw) {
      throw new ApiError(400, 'invalid_code', 'Kode verifikasi tidak valid atau sudah digunakan.');
    }
    const targetEmail = targetEmailRaw.toLowerCase();

    const currentCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'email', 'current', email, currentCode);
    const newCodeDigest = digestAccountCode(secret, verificationId, auth.user.id, 'email', 'new', targetEmail, newCode);

    const consumed = await consumeAccountSettingChallenge(env, {
      challengeId: verificationId,
      userId: auth.user.id,
      action: 'email',
      currentEmail: email,
      targetEmail,
      currentCodeDigest,
      newCodeDigest,
    });
    if (consumed.status !== 'ok') {
      throw mapChallengeConsumeError(consumed.status);
    }

    // Re-check email uniqueness at confirm time.
    const owner = await findEmailOwner(env, targetEmail);
    if (owner && owner.id !== auth.user.id) {
      throw new ApiError(409, 'conflict', 'Email sudah terdaftar.');
    }

    const { data: fresh, error: freshError } = await admin.auth.admin.getUserById(auth.user.id);
    if (freshError || !fresh?.user) {
      throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
    }
    const appMeta = (fresh.user.app_metadata ?? {}) as Record<string, unknown>;
    const nowIso = new Date().toISOString();
    const { error: updateError } = await admin.auth.admin.updateUserById(auth.user.id, {
      email: targetEmail,
      email_confirm: true,
      app_metadata: { ...appMeta, sessions_invalidated_at: nowIso },
    });
    if (updateError) {
      const msg = (updateError.message ?? '').toLowerCase();
      if (msg.includes('already') || msg.includes('exists') || msg.includes('registered')) {
        throw new ApiError(409, 'conflict', 'Email sudah terdaftar.');
      }
      console.error('[account-settings] email update failed', { message: updateError.message });
      throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
    }

    if (auth.accessToken) {
      try {
        await admin.auth.admin.signOut(auth.accessToken, 'global');
      } catch (error) {
        console.error('[account-settings] global signOut after email change failed', {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const response = ok({ status: 'updated' });
    clearAuthCookies(response, req);
    return response;
  });
}
