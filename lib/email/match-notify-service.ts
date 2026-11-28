import type { SupabaseClient } from '@supabase/supabase-js';
import { throwDb } from '../db';
import type { JobSourceRow } from '../recommendation/job-context';
import {
  NotificationsTableUnavailableError,
  runMatchNotify,
  skippedMatchNotifyResult,
  type EmailJobRow,
  type EmailProfileRow,
  type MatchNotifyResult,
} from './runner';
import { readSmtpConfig, resolveSiteUrl, sendMatchEmail } from './transport';
import { readUnsubscribeSecret } from './unsubscribe';

const PROFILE_COLUMNS = 'user_id, skills, education, experiences, projects, preferences';
const JOB_COLUMNS =
  'id, title, company, location, work_mode, employment_type, level, education, skills, status, deadline, description';

export function isMissingNotificationsTable(error: unknown): boolean {
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

export type ExecuteMatchNotifyOptions = {
  userIds?: string[];
};

/**
 * Menjalankan pencocokan lowongan dan pengiriman email digest menggunakan Supabase admin client.
 */
export async function executeMatchNotify(
  admin: SupabaseClient,
  options: ExecuteMatchNotifyOptions = {},
): Promise<MatchNotifyResult> {
  const smtpConfig = readSmtpConfig();
  if (!smtpConfig) {
    return skippedMatchNotifyResult('smtp_not_configured');
  }

  const unsubscribeSecret = readUnsubscribeSecret();
  if (!unsubscribeSecret) {
    return skippedMatchNotifyResult('unsubscribe_secret_not_configured');
  }

  const filterUserIds = Array.isArray(options.userIds)
    ? Array.from(new Set(options.userIds.map((id) => id.trim()).filter(Boolean)))
    : [];

  try {
    return await runMatchNotify({
      smtpConfig,
      unsubscribeSecret,
      siteUrl: resolveSiteUrl(),
      deps: {
        listProfiles: async () => {
          let query = admin.from('profiles').select(PROFILE_COLUMNS);
          if (filterUserIds.length > 0) {
            query = query.in('user_id', filterUserIds);
          }
          const { data, error } = await query;
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
            .limit(500);
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
  } catch (error) {
    if (error instanceof NotificationsTableUnavailableError) {
      return skippedMatchNotifyResult('notifications_table_missing');
    }
    throw error;
  }
}

export type PostIngestNotifyOutcome = {
  triggered: boolean;
  sent: number;
  candidates: number;
  skipped?: string;
  error?: string;
};

async function runSafeMatchNotify(
  admin: SupabaseClient,
  options: {
    userIds?: string[];
    run?: (admin: SupabaseClient, opts: ExecuteMatchNotifyOptions) => Promise<MatchNotifyResult>;
  },
): Promise<PostIngestNotifyOutcome> {
  const executor = options.run ?? executeMatchNotify;
  try {
    const result = await executor(admin, { userIds: options.userIds });
    return {
      triggered: true,
      sent: result.data.sent,
      candidates: result.data.candidates,
      ...(result.data.skipped ? { skipped: result.data.skipped } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[match-notify] post-ingest trigger failed:', message);
    return {
      triggered: true,
      sent: 0,
      candidates: 0,
      error: message,
    };
  }
}

/**
 * Memicu notifikasi kecocokan secara non-fatal setelah proses ingest selesai.
 * Hanya berjalan jika ada lowongan baru yang masuk (ingested > 0).
 */
export async function triggerMatchNotifyAfterIngest(
  admin: SupabaseClient,
  options: {
    ingested: number;
    userIds?: string[];
    run?: (admin: SupabaseClient, opts: ExecuteMatchNotifyOptions) => Promise<MatchNotifyResult>;
  },
): Promise<PostIngestNotifyOutcome> {
  if (options.ingested <= 0) {
    return { triggered: false, sent: 0, candidates: 0, skipped: 'no_ingested_jobs' };
  }
  return runSafeMatchNotify(admin, options);
}

/**
 * Memicu pengecekan dan pengiriman notifikasi kecocokan untuk satu pengguna secara non-fatal
 * (misalnya setelah pengguna memperbarui profil atau keahlian, meski tidak ada ingest baru).
 */
export async function triggerMatchNotifyForUser(
  admin: SupabaseClient,
  userId: string,
  options: {
    run?: (admin: SupabaseClient, opts: ExecuteMatchNotifyOptions) => Promise<MatchNotifyResult>;
  } = {},
): Promise<PostIngestNotifyOutcome> {
  const trimmed = userId.trim();
  if (!trimmed) {
    return { triggered: false, sent: 0, candidates: 0, skipped: 'missing_user_id' };
  }
  return runSafeMatchNotify(admin, { userIds: [trimmed], run: options.run });
}
