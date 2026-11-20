import type { SupabaseClient } from '@supabase/supabase-js';
import type { RecommendationItem, RecommendationJobCard } from '../recommendation-contract';
import { isJobEligibleForLocationPreferences } from './location-filter';

const SOURCE_PRIORITY: Record<string, number> = {
  linkedin_guest: 0,
  himalayas_api: 1,
  remotive_api: 2,
  jobicy_api: 3,
};

export type JobSourceRow = {
  job_id: string;
  source_name: string | null;
  source_url: string | null;
  fetched_at: string | null;
};

export type LocationDiagnostics = Record<string, number>;

export function filterEligibleJobs<T extends {
  id: string;
  work_mode: string | null;
  location: string | null;
  description?: string | null;
}>(
  jobs: T[],
  preferences: unknown,
): { eligible: T[]; diagnostics: LocationDiagnostics } {
  const diagnostics: LocationDiagnostics = {};
  const eligible = jobs.filter((job) => {
    const decision = isJobEligibleForLocationPreferences(job, preferences);
    diagnostics[decision.reason] = (diagnostics[decision.reason] ?? 0) + 1;
    return decision.eligible;
  });
  return { eligible, diagnostics };
}

export function pickSource(sources: JobSourceRow[]): JobSourceRow | null {
  const prioritized = [...sources].sort((a, b) => {
    const rankA = SOURCE_PRIORITY[a.source_name ?? ''] ?? 9;
    const rankB = SOURCE_PRIORITY[b.source_name ?? ''] ?? 9;
    if (rankA !== rankB) return rankA - rankB;
    return (b.fetched_at ?? '').localeCompare(a.fetched_at ?? '');
  });
  return prioritized.find((s) => Boolean(s.source_url)) ?? prioritized[0] ?? null;
}

export async function attachJobContext(
  supabase: SupabaseClient,
  items: RecommendationItem[],
  sourceRows: JobSourceRow[],
  jobCards: RecommendationJobCard[],
): Promise<RecommendationItem[]> {
  const sourcesByJob = new Map<string, JobSourceRow[]>();
  for (const source of sourceRows) {
    const list = sourcesByJob.get(source.job_id) ?? [];
    list.push(source);
    sourcesByJob.set(source.job_id, list);
  }
  const cardsById = new Map(jobCards.map((job) => [job.id, job]));

  return items.map((item) => {
    const chosen = pickSource(sourcesByJob.get(item.job_id) ?? []);
    return {
      ...item,
      job: cardsById.get(item.job_id) ?? null,
      source: chosen
        ? { source_name: chosen.source_name ?? 'sumber asli', source_url: chosen.source_url }
        : null,
    };
  });
}
