import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { readSupabaseEnv } from './env';
import { ApiError } from './http';
import { createBearerClient, createCookieClient } from './supabase';

export type AuthMode = 'cookie' | 'bearer';

export type AuthContext = {
  user: User;
  supabase: SupabaseClient;
  mode: AuthMode;
};

const MUTATING_METHODS: Record<string, true> = {
  POST: true,
  PUT: true,
  PATCH: true,
  DELETE: true,
};

function expectedOrigin(req: NextRequest): string {
  const host = req.headers.get('host');
  if (!host) return req.nextUrl.origin;
  const forwarded = req.headers.get('x-forwarded-proto');
  const protocol = forwarded ? forwarded.split(',')[0].trim() : req.nextUrl.protocol.replace(/:$/, '');
  return `${protocol}://${host}`;
}

function assertSameOrigin(req: NextRequest): void {
  const origin = req.headers.get('origin');
  if (origin) {
    if (origin !== expectedOrigin(req)) {
      throw new ApiError(403, 'csrf_rejected', 'Origin permintaan tidak diizinkan.');
    }
    return;
  }
  if (req.headers.get('sec-fetch-site') !== 'same-origin') {
    throw new ApiError(403, 'csrf_rejected', 'Permintaan mutasi harus berasal dari origin yang sama.');
  }
}

export function assertOriginAllowed(req: NextRequest): void {
  const origin = req.headers.get('origin');
  const site = req.headers.get('sec-fetch-site');
  if (origin) {
    if (origin !== expectedOrigin(req)) {
      throw new ApiError(403, 'csrf_rejected', 'Origin permintaan tidak diizinkan.');
    }
    return;
  }
  if (site && site !== 'same-origin' && site !== 'none') {
    throw new ApiError(403, 'csrf_rejected', 'Permintaan harus berasal dari origin yang sama.');
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthContext> {
  const authorization = req.headers.get('authorization');
  const env = readSupabaseEnv();

  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    const token = match?.[1] ?? '';
    if (token.length < 10 || token.length > 8192) {
      throw new ApiError(401, 'unauthorized', 'Kredensial tidak valid.');
    }
    if (!env) {
      throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
    }
    const supabase = createBearerClient(env, token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      throw new ApiError(401, 'unauthorized', 'Kredensial tidak valid atau kedaluwarsa.');
    }
    return { user: data.user, supabase, mode: 'bearer' };
  }

  const store = await cookies();
  const hasSessionCookie = store
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
  if (!hasSessionCookie) {
    throw new ApiError(401, 'unauthorized', 'Autentikasi diperlukan.');
  }
  if (!env) {
    throw new ApiError(503, 'auth_not_configured', 'Autentikasi belum dikonfigurasi.');
  }
  if (MUTATING_METHODS[req.method]) {
    assertSameOrigin(req);
  }
  const supabase = await createCookieClient(env);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, 'unauthorized', 'Sesi tidak valid atau kedaluwarsa.');
  }
  return { user: data.user, supabase, mode: 'cookie' };
}
