import { ApiError, asObject } from './http';

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_OR_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;

export function invalid(field: string, reason: string): ApiError {
  return new ApiError(400, 'validation_error', `Input ${field} ${reason}.`, { field });
}

export function text(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string') throw invalid(field, 'harus berupa teks');
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw invalid(field, `harus memiliki ${min}-${max} karakter`);
  }
  return trimmed;
}

export function optionalText(
  value: unknown,
  field: string,
  min: number,
  max: number,
): string | null {
  if (value === undefined || value === null) return null;
  return text(value, field, min, max);
}

export function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw invalid(field, 'harus berupa boolean');
  return value;
}

export function oneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw invalid(field, `harus salah satu dari: ${allowed.join(', ')}`);
  }
  return value as T;
}

export function arrayValue(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw invalid(field, 'harus berupa array');
  if (value.length > max) throw invalid(field, `maksimal ${max} item`);
  return value;
}

export function uuidValue(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw invalid(field, 'harus berupa UUID');
  }
  return value.toLowerCase();
}

export function urlValue(value: unknown, field: string): string {
  const raw = text(value, field, 8, 2048);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw invalid(field, 'harus berupa URL yang valid');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw invalid(field, 'harus menggunakan http atau https');
  }
  return parsed.toString();
}

export function monthOrDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !MONTH_OR_DATE_PATTERN.test(value)) {
    throw invalid(field, 'harus berformat YYYY-MM atau YYYY-MM-DD');
  }
  const parts = value.split('-').map((part) => Number(part));
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (day !== undefined) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw invalid(field, 'bukan tanggal yang valid');
    }
  }
  return value;
}

export function emailValue(value: unknown): string {
  const raw = text(value, 'email', 3, 254);
  if (!EMAIL_PATTERN.test(raw)) throw invalid('email', 'harus berupa email yang valid');
  return raw.toLowerCase();
}

export function passwordValue(value: unknown): string {
  if (typeof value !== 'string') throw invalid('password', 'harus berupa teks');
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < 8 || bytes > 72) throw invalid('password', 'harus memiliki 8-72 byte');
  return value;
}

export function intValue(
  value: string | null,
  field: string,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === null || value === '') return fallback;
  if (!/^\d{1,6}$/.test(value)) throw invalid(field, 'harus berupa bilangan bulat');
  const parsed = Number(value);
  if (parsed < min || parsed > max) throw invalid(field, `harus berada di ${min}-${max}`);
  return parsed;
}

export function searchTerm(value: string | null, field: string, max: number): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) throw invalid(field, `maksimal ${max} karakter`);
  const cleaned = trimmed.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) throw invalid(field, 'tidak berisi karakter yang dapat dicari');
  return cleaned;
}

export function assertAllowedQuery(params: URLSearchParams, allowed: readonly string[]): void {
  for (const key of params.keys()) {
    if (!allowed.includes(key)) {
      throw new ApiError(400, 'unknown_query', `Query tidak dikenal: ${key.slice(0, 40)}.`, {
        field: key.slice(0, 40),
      });
    }
    if (params.getAll(key).length > 1) {
      throw new ApiError(400, 'duplicate_query', `Query ${key.slice(0, 40)} tidak boleh berulang.`, {
        field: key.slice(0, 40),
      });
    }
  }
}

function assertSafeJson(value: unknown, field: string, depth: number): void {
  if (depth > 10) throw invalid(field, 'memiliki kedalaman JSON lebih dari 10');
  if (Array.isArray(value)) {
    for (const item of value) assertSafeJson(item, field, depth + 1);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw invalid(field, 'mengandung kunci JSON yang tidak diizinkan');
      }
      assertSafeJson(item, field, depth + 1);
    }
  }
}

export function jsonObject(
  value: unknown,
  field: string,
  maxBytes: number,
): Record<string, unknown> {
  const parsed = asObject(value, field);
  if (Buffer.byteLength(JSON.stringify(parsed), 'utf8') > maxBytes) {
    throw invalid(field, `memiliki ukuran JSON lebih dari ${maxBytes} byte`);
  }
  assertSafeJson(parsed, field, 0);
  return parsed;
}

export function stringList(value: unknown, field: string, maxItems: number): string[] {
  if (value === undefined || value === null) return [];
  return arrayValue(value, field, maxItems).map((item, index) =>
    text(item, `${field}[${index}]`, 1, 60),
  );
}

export function enumList<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
  maxItems: number,
): T[] {
  if (value === undefined || value === null) return [];
  return arrayValue(value, field, maxItems).map((item, index) =>
    oneOf(item, `${field}[${index}]`, allowed),
  );
}
