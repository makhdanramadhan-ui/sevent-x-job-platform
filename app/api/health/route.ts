import { NextResponse } from 'next/server';
import { readSmtpConfig } from '@/lib/email/transport';
import { readSupabaseEnv } from '@/lib/env';
import { checkSystemHealth } from '@/lib/health';
import { createPublicServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseEnv = readSupabaseEnv();

  const report = await checkSystemHealth({
    isSupabaseConfigured: () => supabaseEnv !== null,
    pingDatabase: async () => {
      if (!supabaseEnv) throw new Error('Supabase not configured');
      const supabase = createPublicServerClient(supabaseEnv);
      const { error } = await supabase.from('jobs').select('id').limit(1);
      if (error) throw new Error(error.message);
    },
    isSmtpConfigured: () => readSmtpConfig() !== null,
  });

  const httpStatus = report.status === 'healthy' ? 200 : 503;
  return NextResponse.json(report, { status: httpStatus });
}
