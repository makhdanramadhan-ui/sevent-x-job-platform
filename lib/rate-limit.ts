import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { SupabaseAdminEnv } from './env';
import { createAdminClient } from './supabase';

type RateLimitMode = 'fail-closed' | 'fail-open';

type ConsumeResult = {
  allowed: boolean;
  retryAfter: number;
};

export type RateLimitCheck = {
  bucket: string;
  key: string;
  max: number;
  windowSeconds: number;
  mode: RateLimitMode;
};

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  return first ? first.slice(0, 200) : null;
}

export function clientIp(req: NextRequest): string {
  const vercelForwardedFor = firstForwardedIp(req.headers.get('x-vercel-forwarded-for'));
  if (vercelForwardedFor) return vercelForwardedFor;

  const vercelIp = req.headers.get('x-vercel-ip')?.trim();
  if (vercelIp) return vercelIp.slice(0, 200);

  if (process.env.VERCEL) return 'unknown';

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp.slice(0, 200);

  const forwarded = firstForwardedIp(req.headers.get('x-forwarded-for'));
  if (forwarded) return forwarded;

  return 'unknown';
}

function parseConsumeResult(data: unknown): ConsumeResult | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const allowed = record.allowed;
  const retryAfter = record.retry_after;
  if (typeof allowed !== 'boolean') return null;
  if (typeof retryAfter !== 'number' || !Number.isFinite(retryAfter)) return null;
  return { allowed, retryAfter: Math.max(0, Math.floor(retryAfter)) };
}

async function consume(
  env: SupabaseAdminEnv,
  check: RateLimitCheck,
): Promise<ConsumeResult> {
  const admin = createAdminClient(env);
  const { data, error } = await admin.rpc('consume_rate_limit', {
    bucket: check.bucket,
    key: check.key,
    max: check.max,
    window_seconds: check.windowSeconds,
  });
  if (error) {
    throw new Error(`consume_rate_limit failed: ${error.message}`);
  }
  const result = parseConsumeResult(data);
  if (!result) {
    throw new Error('consume_rate_limit returned invalid result');
  }
  return result;
}

export function rateLimitResponse(retryAfter: number): NextResponse {
  const seconds = Math.max(1, Math.floor(retryAfter || 60));
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return NextResponse.json(
    {
      error: {
        code: 'rate_limited',
        message: `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`,
      },
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(seconds),
      },
    },
  );
}

export async function enforceRateLimits(
  env: SupabaseAdminEnv,
  checks: readonly RateLimitCheck[],
): Promise<NextResponse | null> {
  for (const check of checks) {
    try {
      const result = await consume(env, check);
      if (!result.allowed) {
        return rateLimitResponse(result.retryAfter);
      }
    } catch (error) {
      if (check.mode === 'fail-closed') {
        throw error;
      }
      console.error('[rate-limit] fail-open', {
        bucket: check.bucket,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return null;
}
