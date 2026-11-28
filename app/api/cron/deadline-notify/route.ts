import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import {
  executeDeadlineNotify,
  skippedDeadlineNotifyResult,
} from '@/lib/email/deadline-runner';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  if (req.headers.get('authorization')?.trim() === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get('x-cron-secret')?.trim();
  if (headerSecret && headerSecret === secret) return true;
  return false;
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
    return NextResponse.json(skippedDeadlineNotifyResult('service_not_configured'));
  }

  const admin = createAdminClient(adminEnv);

  try {
    const result = await executeDeadlineNotify(admin);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Terjadi kesalahan internal.' } },
      { status: 500 },
    );
  }
}
