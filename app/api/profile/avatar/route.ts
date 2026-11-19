import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  AVATAR_MAX_BYTES,
  AVATAR_RATE_LIMIT,
  detectAvatarKind,
  ensureAvatarBucket,
  readAvatarPath,
  readProviderAvatarUrl,
  removeAvatarObjects,
  resolveAvatar,
  setAvatarPath,
  uploadAvatarObject,
} from '@/lib/avatar';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ApiError, ok, run } from '@/lib/http';
import { enforceRateLimits } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

async function readAvatarFile(req: NextRequest): Promise<{ buffer: Uint8Array; kind: NonNullable<ReturnType<typeof detectAvatarKind>> }> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw new ApiError(415, 'unsupported_media_type', 'Jenis berkas tidak didukung.');
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, 'invalid_multipart', 'Data unggahan tidak valid.');
  }
  const value = form.get('file');
  if (!(value instanceof File)) {
    throw new ApiError(400, 'validation_error', 'Berkas foto wajib diunggah.', { field: 'file' });
  }
  if (value.size > AVATAR_MAX_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Ukuran foto melebihi 2 MB.');
  }
  let buffer: Uint8Array;
  try {
    buffer = new Uint8Array(await value.arrayBuffer());
  } catch {
    throw new ApiError(400, 'invalid_multipart', 'Data unggahan tidak valid.');
  }
  if (buffer.byteLength > AVATAR_MAX_BYTES) {
    throw new ApiError(413, 'payload_too_large', 'Ukuran foto melebihi 2 MB.');
  }
  const kind = detectAvatarKind(buffer);
  if (!kind) {
    throw new ApiError(415, 'unsupported_media_type', 'Jenis berkas tidak didukung.');
  }
  return { buffer, kind };
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const adminEnv = readSupabaseAdminEnv();
    if (!adminEnv) {
      throw new ApiError(503, 'avatar_storage_unavailable', 'Penyimpanan foto profil belum tersedia.');
    }

    const limited = await enforceRateLimits(adminEnv, [
      {
        bucket: AVATAR_RATE_LIMIT.bucket,
        key: auth.user.id,
        max: AVATAR_RATE_LIMIT.max,
        windowSeconds: AVATAR_RATE_LIMIT.windowSeconds,
        mode: 'fail-closed',
      },
    ]);
    if (limited) return limited;

    const { buffer, kind } = await readAvatarFile(req);
    const previousPath = readAvatarPath(auth.user);

    await ensureAvatarBucket(adminEnv);
    const newPath = await uploadAvatarObject(adminEnv, auth.user.id, buffer, kind);

    try {
      const appMeta = (auth.user.app_metadata ?? {}) as Record<string, unknown>;
      await setAvatarPath(adminEnv, auth.user.id, appMeta, newPath);
    } catch (error) {
      try {
        await removeAvatarObjects(adminEnv, [newPath]);
      } catch {}
      throw error;
    }

    if (previousPath && previousPath !== newPath) {
      try {
        await removeAvatarObjects(adminEnv, [previousPath]);
      } catch {
        // best-effort cleanup of previous object
      }
    }

    const avatar = resolveAvatar(adminEnv, {
      app_metadata: { ...(auth.user.app_metadata ?? {}), avatar_path: newPath },
      user_metadata: auth.user.user_metadata ?? {},
    });
    return ok({ avatar_url: avatar.avatar_url });
  });
}

export async function DELETE(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const adminEnv = readSupabaseAdminEnv();
    if (!adminEnv) {
      throw new ApiError(503, 'avatar_storage_unavailable', 'Penyimpanan foto profil belum tersedia.');
    }

    const previousPath = readAvatarPath(auth.user);
    const appMeta = (auth.user.app_metadata ?? {}) as Record<string, unknown>;

    if (previousPath) {
      await removeAvatarObjects(adminEnv, [previousPath]);
    }
    await setAvatarPath(adminEnv, auth.user.id, appMeta, null);

    const avatar_url = readProviderAvatarUrl(auth.user);
    return ok({ avatar_url });
  });
}
