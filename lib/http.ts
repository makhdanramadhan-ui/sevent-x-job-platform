import { NextResponse } from 'next/server';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function handleError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return fail(error.status, error.code, error.message, error.details);
  }
  return fail(500, 'internal_error', 'Terjadi kesalahan internal.');
}

export async function run(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleError(error);
  }
}

export function asObject(value: unknown, field: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'validation_error', `${field} harus berupa objek.`, { field });
  }
  return value as Record<string, unknown>;
}

export function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  field: string,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      const safeKey = key.slice(0, 40);
      throw new ApiError(400, 'unknown_field', `Field tidak dikenal: ${field}.${safeKey}.`, {
        field: `${field}.${safeKey}`,
      });
    }
  }
}

export async function readJson(req: Request, maxBytes = 64 * 1024): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Content-Type harus application/json.');
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, 'payload_too_large', 'Ukuran permintaan melebihi batas.');
  }
  if (!req.body) {
    throw new ApiError(400, 'invalid_json', 'Body JSON tidak ditemukan.');
  }
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new ApiError(413, 'payload_too_large', 'Ukuran permintaan melebihi batas.');
    }
    chunks.push(value);
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new ApiError(400, 'invalid_json', 'Body bukan UTF-8 yang valid.');
  }
  if (text.trim().length === 0) {
    throw new ApiError(400, 'invalid_json', 'Body JSON kosong.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'invalid_json', 'Body bukan JSON yang valid.');
  }
}
