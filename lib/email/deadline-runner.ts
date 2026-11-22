import type { SendMailOptions } from 'nodemailer';
import { pickSource, type JobSourceRow } from '../recommendation/job-context';
import {
  buildDeadlineEmail,
  getEligibleReminderDay,
  isDeadlineAlertsEnabled,
  type DeadlineJobInfo,
} from './deadline-message';
import { resolveSiteUrl, type SmtpConfig } from './transport';
import { buildUnsubscribeUrl } from './unsubscribe';

export const MAX_DEADLINE_EMAILS_PER_RUN = 100;

export type EmailBookmarkRow = {
  user_id: string;
  job_id: string;
  jobs: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    work_mode: string | null;
    status: string | null;
    deadline: string | null;
  } | null;
};

export type EmailProfilePreferenceRow = {
  user_id: string;
  preferences: unknown;
};

export type SentDeadlineNotificationRow = {
  user_id: string;
  job_id: string;
  reminder_day: number;
};

export type DeadlineNotifyDeps = {
  listBookmarks: () => Promise<EmailBookmarkRow[]>;
  listProfiles: (userIds: string[]) => Promise<EmailProfilePreferenceRow[]>;
  listSentReminders: (
    pairs: Array<{ user_id: string; job_id: string; reminder_day: number }>,
  ) => Promise<Set<string>>;
  listSources?: (jobIds: string[]) => Promise<JobSourceRow[]>;
  getEmail: (userId: string) => Promise<string | null>;
  send: (message: SendMailOptions) => Promise<void>;
  recordSent: (rows: SentDeadlineNotificationRow[]) => Promise<void>;
};

export type RunDeadlineNotifyOptions = {
  smtpConfig?: SmtpConfig | null;
  unsubscribeSecret?: string | null;
  siteUrl?: string;
  referenceDate?: string | Date;
  deps: DeadlineNotifyDeps;
};

export type DeadlineNotifyResult = {
  data: {
    ok: boolean;
    sent: number;
    candidates: number;
    skipped_no_deadline: number;
    skipped_not_reminder_day: number;
    skipped_already_sent: number;
    skipped_opt_out: number;
    failed_sends: number;
    record_errors: number;
    capped: boolean;
    skipped?: string;
  };
  skipped?: string;
};

export class DeadlineNotificationsTableUnavailableError extends Error {
  constructor() {
    super('Tabel bookmark_deadline_notifications belum tersedia.');
    this.name = 'DeadlineNotificationsTableUnavailableError';
  }
}

export function isMissingDeadlineNotificationsTable(error: unknown): boolean {
  const record = error as { code?: unknown; message?: unknown } | null;
  const code = typeof record?.code === 'string' ? record.code : '';
  const message = typeof record?.message === 'string' ? record.message.toLowerCase() : '';
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    message.includes('bookmark_deadline_notifications') ||
    message.includes('schema cache')
  );
}

export function reminderNotificationKey(
  userId: string,
  jobId: string,
  reminderDay: number,
): string {
  return `${userId}|${jobId}|${reminderDay}`;
}

export function skippedDeadlineNotifyResult(
  reason: string,
  extra: Partial<DeadlineNotifyResult['data']> = {},
): DeadlineNotifyResult {
  return {
    data: {
      ok: true,
      sent: 0,
      candidates: 0,
      skipped_no_deadline: 0,
      skipped_not_reminder_day: 0,
      skipped_already_sent: 0,
      skipped_opt_out: 0,
      failed_sends: 0,
      record_errors: 0,
      capped: false,
      skipped: reason,
      ...extra,
    },
    skipped: reason,
  };
}

export async function runDeadlineNotify(
  options: RunDeadlineNotifyOptions,
): Promise<DeadlineNotifyResult> {
  const { deps, referenceDate } = options;
  const siteUrl = options.siteUrl || resolveSiteUrl();
  const unsubscribeSecret = options.unsubscribeSecret ?? null;

  const bookmarks = await deps.listBookmarks();

  type Candidate = {
    userId: string;
    jobId: string;
    job: NonNullable<EmailBookmarkRow['jobs']>;
    reminderDay: 1 | 3;
  };

  const eligible: Candidate[] = [];
  let skippedNoDeadline = 0;
  let skippedNotReminderDay = 0;

  for (const row of bookmarks) {
    if (!row.jobs || row.jobs.status !== 'open') continue;
    if (!row.jobs.deadline || !row.jobs.deadline.trim()) {
      skippedNoDeadline += 1;
      continue;
    }

    const reminderDay = getEligibleReminderDay(row.jobs.deadline, referenceDate);
    if (!reminderDay) {
      skippedNotReminderDay += 1;
      continue;
    }

    eligible.push({
      userId: row.user_id,
      jobId: row.job_id,
      job: row.jobs,
      reminderDay,
    });
  }

  if (eligible.length === 0) {
    return {
      data: {
        ok: true,
        sent: 0,
        candidates: 0,
        skipped_no_deadline: skippedNoDeadline,
        skipped_not_reminder_day: skippedNotReminderDay,
        skipped_already_sent: 0,
        skipped_opt_out: 0,
        failed_sends: 0,
        record_errors: 0,
        capped: false,
        skipped: 'no_eligible_bookmarks',
      },
      skipped: 'no_eligible_bookmarks',
    };
  }

  // 1. Filter out users who opted out of deadline notifications
  const userIds = Array.from(new Set(eligible.map((item) => item.userId)));
  const profiles = await deps.listProfiles(userIds);
  const preferencesByUser = new Map(profiles.map((p) => [p.user_id, p.preferences]));

  let skippedOptOut = 0;
  const optedIn = eligible.filter((item) => {
    const prefs = preferencesByUser.get(item.userId);
    const enabled = isDeadlineAlertsEnabled(prefs);
    if (!enabled) {
      skippedOptOut += 1;
      return false;
    }
    return true;
  });

  if (optedIn.length === 0) {
    return {
      data: {
        ok: true,
        sent: 0,
        candidates: eligible.length,
        skipped_no_deadline: skippedNoDeadline,
        skipped_not_reminder_day: skippedNotReminderDay,
        skipped_already_sent: 0,
        skipped_opt_out: skippedOptOut,
        failed_sends: 0,
        record_errors: 0,
        capped: false,
        skipped: 'all_users_opted_out',
      },
      skipped: 'all_users_opted_out',
    };
  }

  // 2. Check already sent notifications to prevent duplicates
  const sentSet = await deps.listSentReminders(
    optedIn.map((item) => ({
      user_id: item.userId,
      job_id: item.jobId,
      reminder_day: item.reminderDay,
    })),
  );

  let skippedAlreadySent = 0;
  const toSend = optedIn.filter((item) => {
    const key = reminderNotificationKey(item.userId, item.jobId, item.reminderDay);
    if (sentSet.has(key)) {
      skippedAlreadySent += 1;
      return false;
    }
    return true;
  });

  if (toSend.length === 0) {
    return {
      data: {
        ok: true,
        sent: 0,
        candidates: eligible.length,
        skipped_no_deadline: skippedNoDeadline,
        skipped_not_reminder_day: skippedNotReminderDay,
        skipped_already_sent: skippedAlreadySent,
        skipped_opt_out: skippedOptOut,
        failed_sends: 0,
        record_errors: 0,
        capped: false,
        skipped: 'all_already_sent',
      },
      skipped: 'all_already_sent',
    };
  }

  // 3. Fetch sources for jobs
  const jobIds = Array.from(new Set(toSend.map((item) => item.jobId)));
  const sources = deps.listSources ? await deps.listSources(jobIds) : [];
  const sourcesByJobId = new Map<string, JobSourceRow[]>();
  for (const src of sources) {
    const list = sourcesByJobId.get(src.job_id) ?? [];
    list.push(src);
    sourcesByJobId.set(src.job_id, list);
  }

  // 4. Send loop
  let sent = 0;
  let failedSends = 0;
  let recordErrors = 0;

  for (const item of toSend) {
    if (sent >= MAX_DEADLINE_EMAILS_PER_RUN) break;

    let email: string | null = null;
    try {
      email = await deps.getEmail(item.userId);
    } catch {
      failedSends += 1;
      continue;
    }

    if (!email) {
      failedSends += 1;
      continue;
    }

    const jobSources = sourcesByJobId.get(item.jobId) ?? [];
    const chosenSource = pickSource(jobSources);
    const applyUrl = chosenSource?.source_url || `${siteUrl}/jobs/${item.jobId}`;

    const unsubscribeUrl = unsubscribeSecret
      ? buildUnsubscribeUrl(siteUrl, item.userId, unsubscribeSecret)
      : `${siteUrl}/profile`;

    const jobInfo: DeadlineJobInfo = {
      id: item.job.id,
      title: item.job.title,
      company: item.job.company,
      location: item.job.location,
      workMode: item.job.work_mode,
      deadline: item.job.deadline!,
      reminderDay: item.reminderDay,
      sourceUrl: chosenSource?.source_url ?? null,
      sourceName: chosenSource?.source_name ?? null,
    };

    const message = buildDeadlineEmail(jobInfo, {
      applyUrl,
      profileUrl: `${siteUrl}/profile`,
      cvUrl: `${siteUrl}/cv`,
      unsubscribeUrl,
    });

    try {
      await deps.send({
        to: email,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    } catch {
      failedSends += 1;
      continue;
    }

    sent += 1;
    try {
      await deps.recordSent([
        {
          user_id: item.userId,
          job_id: item.jobId,
          reminder_day: item.reminderDay,
        },
      ]);
    } catch {
      recordErrors += 1;
    }
  }

  return {
    data: {
      ok: true,
      sent,
      candidates: eligible.length,
      skipped_no_deadline: skippedNoDeadline,
      skipped_not_reminder_day: skippedNotReminderDay,
      skipped_already_sent: skippedAlreadySent,
      skipped_opt_out: skippedOptOut,
      failed_sends: failedSends,
      record_errors: recordErrors,
      capped: sent >= MAX_DEADLINE_EMAILS_PER_RUN,
    },
  };
}
