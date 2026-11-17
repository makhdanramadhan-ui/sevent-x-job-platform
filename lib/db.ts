import { ApiError } from './http';

export function throwDb(error: { code?: string | null } | null): never {
  const code = error?.code ?? '';
  if (code === 'PGRST116') throw new ApiError(404, 'not_found', 'Data tidak ditemukan.');
  if (code === '23505') throw new ApiError(409, 'conflict', 'Data sudah ada.');
  if (code === '23503') throw new ApiError(422, 'invalid_reference', 'Referensi data tidak valid.');
  if (code === '42501') throw new ApiError(403, 'forbidden', 'Akses ditolak.');
  throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
}
