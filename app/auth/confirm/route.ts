import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseEnv } from '@/lib/env';
import { createCookieClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type');

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/login?verify=invalid', origin), 302);
  }

  const env = readSupabaseEnv();
  if (!env) {
    return NextResponse.redirect(new URL('/login?verify=invalid', origin), 302);
  }

  const supabase = await createCookieClient(env);
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change',
  });

  if (error || !data.user || !data.session) {
    return NextResponse.redirect(new URL('/login?verify=invalid', origin), 302);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', data.user.id)
    .maybeSingle();

  const destination = profile ? '/profile?verified=1' : '/onboarding?verified=1';
  return NextResponse.redirect(new URL(destination, origin), 302);
}
