import { NextResponse, type NextRequest } from 'next/server';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import {
  DeadlineNotificationsTableUnavailableError,
  isMissingDeadlineNotificationsTable,
  runDeadlineNotify,
  skippedDeadlineNotifyResult,
  type EmailBookmarkRow,
  type EmailProfilePreferenceRow,
  type SentDeadlineNotificationRow,
} from '@/lib/email/deadline-runner';
import { readSmtpConfig, resolveSiteUrl, sendDeadlineEmail } from '@/lib/email/transport';
import { readUnsubscribeSecret } from '@/lib/email/unsubscribe';
import type { JobSourceRow } from '@/lib/recommendation/job-context';
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
    return NextResponse.json(skippedDeadlineNotifyResult('service_not_configured'));
  }

  const smtpConfig = readSmtpConfig();
  if (!smtpConfig) {
    return NextResponse.json(skippedDeadlineNotifyResult('smtp_not_configured'));
  }

  const unsubscribeSecret = readUnsubscribeSecret();
  const admin = createAdminClient(adminEnv);

  try {
    const result = await runDeadlineNotify({
      smtpConfig,
      unsubscribeSecret,
      siteUrl: resolveSiteUrl(),
      deps: {
        listBookmarks: async () => {
          const { data, error } = await admin
            .from('bookmarks')
            .select('user_id, job_id, jobs(id, title, company, location, work_mode, status, deadline)')
            .order('created_at', { ascending: false })
            .limit(1000);
          if (error) throwDb(error);
          return (data ?? []) as unknown as EmailBookmarkRow[];
        },
        listProfiles: async (userIds) => {
          if (userIds.length === 0) return [];
          const { data, error } = await admin
            .from('profiles')
            .select('user_id, preferences')
            .in('user_id', userIds);
          if (error) throwDb(error);
          return (data ?? []) as EmailProfilePreferenceRow[];
        },
        listSentReminders: async (pairs) => {
          if (pairs.length === 0) return new Set<string>();
          const userIds = Array.from(new Set(pairs.map((p) => p.user_id)));
          const jobIds = Array.from(new Set(pairs.map((p) => p.job_id)));
          const { data, error } = await admin
            .from('bookmark_deadline_notifications')
            .select('user_id, job_id, reminder_day')
            .in('user_id', userIds)
            .in('job_id', jobIds);
          if (error) {
            if (isMissingDeadlineNotificationsTable(error)) {
              throw new DeadlineNotificationsTableUnavailableError();
            }
            throwDb(error);
          }
          return new Set(
            (data ?? []).map((row) => `${row.user_id}|${row.job_id}|${row.reminder_day}`),
          );
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
          await sendDeadlineEmail(smtpConfig, message);
        },
        recordSent: async (rows: SentDeadlineNotificationRow[]) => {
          if (rows.length === 0) return;
          const { error } = await admin
            .from('bookmark_deadline_notifications')
            .upsert(rows, { onConflict: 'user_id,job_id,reminder_day', ignoreDuplicates: true });
          if (error) {
            if (isMissingDeadlineNotificationsTable(error)) {
              throw new DeadlineNotificationsTableUnavailableError();
            }
            throwDb(error);
          }
        },
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DeadlineNotificationsTableUnavailableError) {
      return NextResponse.json(skippedDeadlineNotifyResult('notifications_table_missing'));
    }
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Terjadi kesalahan internal.' } },
      { status: 500 },
    );
  }
}
