import { randomUUID } from 'node:crypto';
import type { User } from '@supabase/supabase-js';
import { ApiError } from './http';
import { createAdminClient } from './supabase';
import type { SupabaseAdminEnv } from './env';

export const AVATAR_BUCKET = 'avatars';
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_RATE_LIMIT = { bucket: 'avatar:user', max: 10, windowSeconds: 60 * 60 } as const;

const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type AvatarKind = 'jpeg' | 'png' | 'webp';

function readHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function detectAvatarKind(buffer: Uint8Array): AvatarKind | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

function avatarExt(kind: AvatarKind): string {
  if (kind === 'jpeg') return 'jpg';
  if (kind === 'png') return 'png';
  return 'webp';
}

function avatarContentType(kind: AvatarKind): string {
  if (kind === 'jpeg') return 'image/jpeg';
  if (kind === 'png') return 'image/png';
  return 'image/webp';
}

export function readAvatarPath(user: Pick<User, 'app_metadata'>): string | null {
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const path = meta.avatar_path;
  if (typeof path !== 'string') return null;
  const trimmed = path.trim();
  return trimmed ? trimmed : null;
}

export function readProviderAvatarUrl(user: Pick<User, 'user_metadata'>): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return readHttpsUrl(meta.avatar_url ?? meta.picture);
}

export function avatarPublicUrl(env: SupabaseAdminEnv, path: string): string {
  const admin = createAdminClient(env);
  const { data } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function resolveAvatar(
  env: SupabaseAdminEnv | null,
  user: Pick<User, 'app_metadata' | 'user_metadata'>,
): { avatar_url: string | null; avatar_source: 'custom' | 'provider' | null } {
  const customPath = readAvatarPath(user);
  if (customPath && env) {
    return { avatar_url: avatarPublicUrl(env, customPath), avatar_source: 'custom' };
  }
  const providerUrl = readProviderAvatarUrl(user);
  if (providerUrl) {
    return { avatar_url: providerUrl, avatar_source: 'provider' };
  }
  return { avatar_url: null, avatar_source: null };
}

function isAlreadyExistsError(error: { message?: string; statusCode?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = (error.message ?? '').toLowerCase();
  const code = (error.statusCode ?? '').toLowerCase();
  return (
    code === '409' ||
    code === '23505' ||
    message.includes('already exists') ||
    message.includes('duplicate')
  );
}

export async function ensureAvatarBucket(env: SupabaseAdminEnv): Promise<void> {
  const admin = createAdminClient(env);
  const options = {
    public: true,
    fileSizeLimit: AVATAR_MAX_BYTES,
    allowedMimeTypes: [...AVATAR_MIME_TYPES],
  };
  const { error } = await admin.storage.createBucket(AVATAR_BUCKET, options);
  if (!error) return;
  if (!isAlreadyExistsError(error)) {
    throw new ApiError(503, 'avatar_storage_unavailable', 'Penyimpanan foto profil belum tersedia.');
  }
  const { error: updateError } = await admin.storage.updateBucket(AVATAR_BUCKET, {
    public: true,
    fileSizeLimit: AVATAR_MAX_BYTES,
    allowedMimeTypes: [...AVATAR_MIME_TYPES],
  });
  if (updateError) {
    throw new ApiError(503, 'avatar_storage_unavailable', 'Penyimpanan foto profil belum tersedia.');
  }
}

export async function uploadAvatarObject(
  env: SupabaseAdminEnv,
  userId: string,
  buffer: Uint8Array,
  kind: AvatarKind,
): Promise<string> {
  const admin = createAdminClient(env);
  const path = `${userId}/${randomUUID()}.${avatarExt(kind)}`;
  const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, buffer, {
    contentType: avatarContentType(kind),
    upsert: false,
  });
  if (error) {
    throw new ApiError(503, 'avatar_storage_unavailable', 'Gagal mengunggah foto profil.');
  }
  return path;
}

export async function removeAvatarObjects(env: SupabaseAdminEnv, paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter((path) => path.trim().length > 0))];
  if (unique.length === 0) return;
  const admin = createAdminClient(env);
  const { error } = await admin.storage.from(AVATAR_BUCKET).remove(unique);
  if (error) {
    throw new ApiError(503, 'avatar_storage_unavailable', 'Gagal menghapus foto profil.');
  }
}

export async function removeAllUserAvatarObjects(env: SupabaseAdminEnv, userId: string): Promise<void> {
  const admin = createAdminClient(env);
  const prefix = `${userId}`;
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(AVATAR_BUCKET).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) {
      const message = (error.message ?? '').toLowerCase();
      if (message.includes('not found') || message.includes('bucket')) return;
      throw new ApiError(503, 'avatar_storage_unavailable', 'Gagal membersihkan foto profil.');
    }
    if (!data || data.length === 0) break;
    for (const entry of data) {
      if (!entry?.name) continue;
      // folders have null id in list results; files have id
      if (entry.id !== null) {
        paths.push(`${prefix}/${entry.name}`);
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  if (paths.length > 0) {
    await removeAvatarObjects(env, paths);
  }
}

export async function setAvatarPath(
  env: SupabaseAdminEnv,
  userId: string,
  currentAppMetadata: Record<string, unknown>,
  avatarPath: string | null,
): Promise<void> {
  const admin = createAdminClient(env);
  const nextMetadata: Record<string, unknown> = { ...currentAppMetadata };
  if (avatarPath) {
    nextMetadata.avatar_path = avatarPath;
  } else {
    delete nextMetadata.avatar_path;
  }
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: nextMetadata });
  if (error) {
    throw new ApiError(503, 'avatar_update_failed', 'Gagal memperbarui foto profil.');
  }
}
