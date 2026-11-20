import { displaySourceName } from '../job-source';
import type { RecommendationItem } from '../recommendation-contract';

export const MATCH_EMAIL_THRESHOLD = 70;
export const MAX_JOBS_PER_DIGEST = 5;
export const MAX_EMAILS_PER_RUN = 100;

export type DigestSource = {
  source_name: string | null;
  source_url: string | null;
};

export type DigestJob = {
  jobId: string;
  title: string;
  company: string;
  location: string | null;
  workMode: string | null;
  score: number;
  reasons: string[];
  sourceName: string;
  sourceUrl: string | null;
};

export type DigestJobInput = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: string | null;
  status: string | null;
};

export function isEmailAlertsEnabled(preferences: unknown): boolean {
  if (!preferences || typeof preferences !== 'object') return true;
  return (preferences as Record<string, unknown>).email_match_alerts !== false;
}

export function selectDigestCandidates(input: {
  items: ReadonlyArray<Pick<RecommendationItem, 'job_id' | 'score' | 'matched'>>;
  jobs: ReadonlyArray<DigestJobInput>;
  sourcesByJobId: ReadonlyMap<string, DigestSource>;
  sentJobIds: ReadonlySet<string>;
}): DigestJob[] {
  const jobsById = new Map(input.jobs.map((job) => [job.id, job]));

  const qualified = input.items
    .map((item, index) => ({ item, index, job: jobsById.get(item.job_id) }))
    .filter(({ item, job }) => {
      if (!job || job.status !== 'open') return false;
      if (item.score < MATCH_EMAIL_THRESHOLD) return false;
      return !input.sentJobIds.has(item.job_id);
    })
    .sort((a, b) => b.item.score - a.item.score || a.index - b.index)
    .slice(0, MAX_JOBS_PER_DIGEST);

  return qualified.map(({ item, job }) => {
    const source = input.sourcesByJobId.get(item.job_id);
    return {
      jobId: item.job_id,
      title: job!.title,
      company: job!.company,
      location: job!.location,
      workMode: job!.work_mode,
      score: item.score,
      reasons: item.matched
        .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
        .slice(0, 3),
      sourceName: displaySourceName(source?.source_name),
      sourceUrl: source?.source_url ?? null,
    };
  });
}
