import { NextResponse } from 'next/server';
import { readSmtpConfig } from '@/lib/email/transport';
import { readSupabaseAdminEnv } from '@/lib/env';
import { checkSystemHealth } from '@/lib/health';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseEnv = readSupabaseAdminEnv();

  const report = await checkSystemHealth({
    isSupabaseConfigured: () => supabaseEnv !== null,
    pingDatabase: async () => {
      if (!supabaseEnv) throw new Error('Supabase admin not configured');
      const supabase = createAdminClient(supabaseEnv);
      const { error } = await supabase.from('jobs').select('id').limit(1);
      if (error) throw new Error(error.message);
    },
    isSmtpConfigured: () => readSmtpConfig() !== null,
  });

  const httpStatus = report.status === 'healthy' ? 200 : 503;
  return NextResponse.json(report, { status: httpStatus });
}
