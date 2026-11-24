import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { executeMatchNotify } from '@/lib/email/match-notify-service';
import { skippedMatchNotifyResult } from '@/lib/email/runner';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Kredensial cron tidak valid.' } },
      { status: 401 },
    );
  }

  const adminEnv = readSupabaseAdminEnv();
  if (!adminEnv) {
    return NextResponse.json(skippedMatchNotifyResult('service_not_configured'));
  }

  try {
    const admin = createAdminClient(adminEnv);
    const result = await executeMatchNotify(admin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Terjadi kesalahan internal.' } },
      { status: 500 },
    );
  }
}
