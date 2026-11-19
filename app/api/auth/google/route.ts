import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseAdminEnv, readSupabaseEnv } from '@/lib/env';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { createCookieClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null): string {
  if (!value) return '/onboarding';
  if (!value.startsWith('/') || value.startsWith('//')) return '/onboarding';
  if (value.includes('\\') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return '/onboarding';
  return value;
}

function isProviderUnavailable(error: { message?: string; code?: string; status?: number } | null): boolean {
  if (!error) return false;
  const code = (error.code ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  return (
    code === 'validation_failed' ||
    code.includes('provider') ||
    message.includes('provider is not enabled') ||
    message.includes('unsupported provider') ||
    message.includes('missing oauth') ||
    message.includes('provider is not supported')
  );
}

export async function GET(req: NextRequest) {
  const adminEnv = readSupabaseAdminEnv();
  if (adminEnv) {
    const limited = await enforceRateLimits(adminEnv, [
      {
        bucket: 'google:ip',
        key: clientIp(req),
        max: 20,
        windowSeconds: 15 * 60,
        mode: 'fail-open',
      },
    ]);
    if (limited) return limited;
  } else {
    console.error('[rate-limit] fail-open', {
      bucket: 'google:ip',
      message: 'SUPABASE_SERVICE_ROLE_KEY tidak tersedia',
    });
  }

  const env = readSupabaseEnv();
  if (!env) {
    return NextResponse.redirect(new URL('/login?error=google_unavailable', req.nextUrl.origin), 302);
  }

  const next = safeNextPath(req.nextUrl.searchParams.get('next'));
  const supabase = await createCookieClient(env);
  const redirectTo = new URL('/auth/callback', req.nextUrl.origin);
  redirectTo.searchParams.set('next', next);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo.toString(),
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    if (isProviderUnavailable(error)) {
      return NextResponse.redirect(new URL('/login?error=google_unavailable', req.nextUrl.origin), 302);
    }
    return NextResponse.redirect(new URL('/login?error=oauth', req.nextUrl.origin), 302);
  }

  return NextResponse.redirect(data.url, 302);
}
