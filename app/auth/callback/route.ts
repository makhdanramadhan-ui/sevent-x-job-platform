import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseEnv } from '@/lib/env';
import { createCookieClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function safeNextPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return null;
  return value;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get('code');
  const requestedNext = safeNextPath(req.nextUrl.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin), 302);
  }

  const env = readSupabaseEnv();
  if (!env) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin), 302);
  }

  const supabase = await createCookieClient(env);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL('/login?error=oauth', origin), 302);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  const destination = profile ? (requestedNext ?? '/jobs') : '/onboarding';
  return NextResponse.redirect(new URL(destination, origin), 302);
}
