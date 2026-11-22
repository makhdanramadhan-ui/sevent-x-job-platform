import { NextResponse } from 'next/server';
import { ApiError } from './http';
import { text } from './validation';

export const RESET_ATTEMPT_MAX = 5;
export const RESET_ATTEMPT_WINDOW_SECONDS = 15 * 60;

export function parseResetCode(value: unknown): string {
  const raw = text(value, 'code', 8, 8);
  if (!/^\d{8}$/.test(raw)) {
    throw new ApiError(400, 'validation_error', 'Input code harus berupa 8 digit.', { field: 'code' });
  }
  return raw;
}

export function parseNewPassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ApiError(400, 'validation_error', 'Input password harus berupa teks.', { field: 'password' });
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (bytes < 1 || bytes > 72) {
    throw new ApiError(400, 'validation_error', 'Input password harus memiliki 1-72 byte.', { field: 'password' });
  }
  return value;
}

export function tooManyAttempts(retryAfter: number): NextResponse {
  const seconds = Math.max(1, Math.floor(retryAfter || RESET_ATTEMPT_WINDOW_SECONDS));
  return NextResponse.json(
    {
      error: {
        code: 'too_many_attempts',
        message: 'Terlalu sering, coba lagi nanti.',
      },
    },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  );
}
