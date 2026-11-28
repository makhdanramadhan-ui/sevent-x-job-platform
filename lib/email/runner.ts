import type { SendMailOptions } from 'nodemailer';
import { rankJobs } from '../recommendation';
import { filterEligibleJobs, pickSource, type JobSourceRow } from '../recommendation/job-context';
import { isProfileRecommendationReady } from '../recommendation/profile-readiness';
import { filterRelevantJobs } from '../recommendation/relevance';
import type {
  RecommendationItem,
  RecommendationJobInputWithContext,
  RecommendationProfileInput,
} from '../recommendation-contract';
import {
  isEmailAlertsEnabled,
  MATCH_EMAIL_THRESHOLD,
  MAX_EMAILS_PER_RUN,
  selectDigestCandidates,
  type DigestSource,
} from './digest';
import { buildDigestEmail } from './message';
import { buildUnsubscribeUrl } from './unsubscribe';
import type { SmtpConfig } from './transport';

export type EmailProfileRow = {
  user_id: string;
  skills: string[] | null;
  education: unknown[] | null;
  experiences: unknown[] | null;
  projects: unknown[] | null;
  preferences: unknown;
};

export type EmailJobRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  level: string | null;
  education: string | null;
  skills: string[] | null;
  status: string | null;
  deadline: string | null;
  description: string | null;
};

export type SentNotificationRow = {
  user_id: string;
  job_id: string;
  score: number;
};

export type MatchNotifyDeps = {
  listProfiles: () => Promise<EmailProfileRow[]>;
  listJobs: () => Promise<EmailJobRow[]>;
  listSentPairs: (userIds: string[], jobIds: string[]) => Promise<Set<string>>;
  listSources: (jobIds: string[]) => Promise<JobSourceRow[]>;
  getEmail: (userId: string) => Promise<string | null>;
  send: (message: SendMailOptions) => Promise<void>;
  recordSent: (rows: SentNotificationRow[]) => Promise<void>;
};

export type MatchNotifyResult = {
  data: {
    ok: boolean;
    sent: number;
    candidates: number;
    opted_in_profiles: number;
    skipped_users: number;
    failed_sends: number;
    record_errors: number;
    capped: boolean;
    skipped?: string;
  };
  skipped?: string;
};

export class NotificationsTableUnavailableError extends Error {
  constructor() {
    super('Tabel notifikasi kecocokan belum tersedia.');
    this.name = 'NotificationsTableUnavailableError';
  }
}

function toProfileInput(profile: EmailProfileRow): RecommendationProfileInput {
  return {
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    education: Array.isArray(profile.education) ? profile.education : [],
    experiences: Array.isArray(profile.experiences) ? profile.experiences : [],
    projects: Array.isArray(profile.projects) ? profile.projects : [],
    preferences:
      profile.preferences && typeof profile.preferences === 'object' ? profile.preferences : {},
  } as unknown as RecommendationProfileInput;
}

function notificationKey(userId: string, jobId: string): string {
  return `${userId}|${jobId}`;
}

export function skippedMatchNotifyResult(
  reason: string,
  counts: { opted_in_profiles?: number } = {},
): MatchNotifyResult {
  return {
    data: {
      ok: true,
      sent: 0,
      candidates: 0,
      opted_in_profiles: counts.opted_in_profiles ?? 0,
      skipped_users: 0,
      failed_sends: 0,
      record_errors: 0,
      capped: false,
      skipped: reason,
    },
    skipped: reason,
  };
}

export async function runMatchNotify(options: {
  smtpConfig: SmtpConfig | null;
  unsubscribeSecret: string | null;
  siteUrl: string;
  deps: MatchNotifyDeps;
}): Promise<MatchNotifyResult> {
  const { smtpConfig, unsubscribeSecret, siteUrl, deps } = options;
  if (!smtpConfig) return skippedMatchNotifyResult('smtp_not_configured');
  if (!unsubscribeSecret) return skippedMatchNotifyResult('unsubscribe_secret_not_configured');

  const profiles = await deps.listProfiles();
  const readyProfiles = profiles.filter(
    (profile) =>
      isEmailAlertsEnabled(profile.preferences) &&
      isProfileRecommendationReady(toProfileInput(profile)),
  );
  if (readyProfiles.length === 0) return skippedMatchNotifyResult('no_ready_profiles');

  const jobs = (await deps.listJobs()).filter((job) => job.status === 'open');
  if (jobs.length === 0) {
    return skippedMatchNotifyResult('no_open_jobs', { opted_in_profiles: readyProfiles.length });
  }

  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const rankedByUser = new Map<string, { items: RecommendationItem[]; jobs: EmailJobRow[] }>();
  const candidateJobIds = new Set<string>();

  for (const profile of readyProfiles) {
    const profileInput = toProfileInput(profile);
    const relevance = filterRelevantJobs(jobs, profileInput);
    const selection = filterEligibleJobs(relevance.relevant, profile.preferences);
    const { eligible } = selection;
    const ranked = rankJobs(
      {
        profile: profileInput,
        jobs: eligible as unknown as RecommendationJobInputWithContext[],
      },
      {
        locationTiers: selection.tiers,
        nearbyLabels: selection.nearbyLabels,
      },
    );
    const eligibleIds = new Set(eligible.map((job) => job.id));
    const items = ranked.items.filter(
      (item) =>
        eligibleIds.has(item.job_id) &&
        item.score >= MATCH_EMAIL_THRESHOLD &&
        jobsById.get(item.job_id)?.status === 'open',
    );
    for (const item of items) candidateJobIds.add(item.job_id);
    rankedByUser.set(profile.user_id, { items, jobs: eligible });
  }

  if (candidateJobIds.size === 0) {
    return skippedMatchNotifyResult('no_matching_jobs', {
      opted_in_profiles: readyProfiles.length,
    });
  }

  let sentPairs: Set<string>;
  try {
    sentPairs = await deps.listSentPairs(
      readyProfiles.map((profile) => profile.user_id),
      [...candidateJobIds],
    );
  } catch (error) {
    if (error instanceof NotificationsTableUnavailableError) {
      return skippedMatchNotifyResult('notifications_table_missing');
    }
    throw error;
  }

  let sourceRows: JobSourceRow[] = [];
  try {
    sourceRows = await deps.listSources([...candidateJobIds]);
  } catch {
    sourceRows = [];
  }

  const groupedSources = new Map<string, JobSourceRow[]>();
  for (const row of sourceRows) {
    const list = groupedSources.get(row.job_id) ?? [];
    list.push(row);
    groupedSources.set(row.job_id, list);
  }
  const sourcesByJobId = new Map<string, DigestSource>();
  for (const [jobId, rows] of groupedSources) {
    const chosen = pickSource(rows);
    if (chosen) {
      sourcesByJobId.set(jobId, {
        source_name: chosen.source_name,
        source_url: chosen.source_url,
      });
    }
  }

  let sent = 0;
  let candidates = 0;
  let skippedUsers = 0;
  let failedSends = 0;
  let recordErrors = 0;

  for (const profile of readyProfiles) {
    if (sent >= MAX_EMAILS_PER_RUN) break;

    const ranked = rankedByUser.get(profile.user_id);
    if (!ranked) continue;

    const sentJobIds = new Set(
      [...candidateJobIds].filter((jobId) =>
        sentPairs.has(notificationKey(profile.user_id, jobId)),
      ),
    );
    const digestJobs = selectDigestCandidates({
      items: ranked.items,
      jobs: ranked.jobs,
      sourcesByJobId,
      sentJobIds,
    });
    if (digestJobs.length === 0) {
      skippedUsers += 1;
      continue;
    }

    let email: string | null = null;
    try {
      email = await deps.getEmail(profile.user_id);
    } catch {
      skippedUsers += 1;
      continue;
    }
    if (!email) {
      skippedUsers += 1;
      continue;
    }

    const message = buildDigestEmail(digestJobs, {
      recommendationsUrl: `${siteUrl}/recommendations`,
      unsubscribeUrl: buildUnsubscribeUrl(siteUrl, profile.user_id, unsubscribeSecret),
    });

    try {
      await deps.send({ to: email, subject: message.subject, html: message.html, text: message.text });
    } catch {
      failedSends += 1;
      skippedUsers += 1;
      continue;
    }

    sent += 1;
    candidates += digestJobs.length;
    try {
      await deps.recordSent(
        digestJobs.map((job) => ({
          user_id: profile.user_id,
          job_id: job.jobId,
          score: job.score,
        })),
      );
    } catch {
      recordErrors += 1;
    }
  }

  return {
    data: {
      ok: true,
      sent,
      candidates,
      opted_in_profiles: readyProfiles.length,
      skipped_users: skippedUsers,
      failed_sends: failedSends,
      record_errors: recordErrors,
      capped: sent >= MAX_EMAILS_PER_RUN,
    },
  };
}
