import { NextResponse, type NextRequest } from 'next/server';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import {
  NotificationsTableUnavailableError,
  runMatchNotify,
  skippedMatchNotifyResult,
  type EmailJobRow,
  type EmailProfileRow,
} from '@/lib/email/runner';
import { readSmtpConfig, resolveSiteUrl, sendMatchEmail } from '@/lib/email/transport';
import { readUnsubscribeSecret } from '@/lib/email/unsubscribe';
import type { JobSourceRow } from '@/lib/recommendation/job-context';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PROFILE_COLUMNS = 'user_id, skills, education, experiences, projects, preferences';
const JOB_COLUMNS =
  'id, title, company, location, work_mode, employment_type, level, education, skills, status, deadline, description';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get('authorization')?.trim() === `Bearer ${secret}`;
}

function isMissingNotificationsTable(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown } | null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message = typeof record?.message === 'string' ? record.message.toLowerCase() : '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('job_match_notifications') ||
    message.includes('schema cache')
  );
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

  const smtpConfig = readSmtpConfig();
  if (!smtpConfig) {
    return NextResponse.json(skippedMatchNotifyResult('smtp_not_configured'));
  }

  const unsubscribeSecret = readUnsubscribeSecret();
  const admin = createAdminClient(adminEnv);

  try {
    const result = await runMatchNotify({
      smtpConfig,
      unsubscribeSecret,
      siteUrl: resolveSiteUrl(),
      deps: {
        listProfiles: async () => {
          const { data, error } = await admin.from('profiles').select(PROFILE_COLUMNS);
          if (error) throwDb(error);
          return (data ?? []) as EmailProfileRow[];
        },
        listJobs: async () => {
          const { data, error } = await admin
            .from('jobs')
            .select(JOB_COLUMNS)
            .eq('status', 'open')
            .order('last_fetched_at', { ascending: false, nullsFirst: false })
            .order('id', { ascending: true })
            .limit(200);
          if (error) throwDb(error);
          return (data ?? []) as EmailJobRow[];
        },
        listSentPairs: async (userIds, jobIds) => {
          if (userIds.length === 0 || jobIds.length === 0) return new Set<string>();
          const { data, error } = await admin
            .from('job_match_notifications')
            .select('user_id, job_id')
            .in('user_id', userIds)
            .in('job_id', jobIds);
          if (error) {
            if (isMissingNotificationsTable(error)) {
              throw new NotificationsTableUnavailableError();
            }
            throwDb(error);
          }
          return new Set((data ?? []).map((row) => `${row.user_id}|${row.job_id}`));
        },
        listSources: async (jobIds) => {
          if (jobIds.length === 0) return [];
          const { data, error } = await admin
            .from('job_sources')
            .select('job_id, source_name, source_url, fetched_at')
            .in('job_id', jobIds);
          if (error) throwDb(error);
          return (data ?? []) as JobSourceRow[];
        },
        getEmail: async (userId) => {
          const { data, error } = await admin.auth.admin.getUserById(userId);
          if (error) throwDb(error);
          return data.user.email ?? null;
        },
        send: async (message) => {
          await sendMatchEmail(smtpConfig, message);
        },
        recordSent: async (rows) => {
          if (rows.length === 0) return;
          const { error } = await admin
            .from('job_match_notifications')
            .upsert(rows, { onConflict: 'user_id,job_id', ignoreDuplicates: true });
          if (error) {
            if (isMissingNotificationsTable(error)) {
              throw new NotificationsTableUnavailableError();
            }
            throwDb(error);
          }
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NotificationsTableUnavailableError) {
      return NextResponse.json(skippedMatchNotifyResult('notifications_table_missing'));
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Terjadi kesalahan internal.' } },
      { status: 500 },
    );
  }
}
