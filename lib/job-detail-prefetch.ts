import { apiFetch } from '@/components/ui/api-client';
import type { JobDetail } from '@/lib/contracts';

type JobDetailFetchResult = Awaited<ReturnType<typeof apiFetch<JobDetail>>>;

let prefetchedEntry: {
  jobId: string;
  promise: Promise<JobDetailFetchResult>;
  expiresAt: number;
} | null = null;

/**
 * Mulai request `/api/jobs/[id]` secara paralel dengan pemeriksaan sesi `/api/auth/me`
 * agar tidak terjadi antrean waterfall yang menunda LCP (Render Delay).
 */
export function prefetchJobDetail(jobId: string): Promise<JobDetailFetchResult> {
  if (
    prefetchedEntry &&
    prefetchedEntry.jobId === jobId &&
    Date.now() < prefetchedEntry.expiresAt
  ) {
    return prefetchedEntry.promise;
  }

  const promise = apiFetch<JobDetail>(`/api/jobs/${encodeURIComponent(jobId)}`);
  prefetchedEntry = {
    jobId,
    promise,
    expiresAt: Date.now() + 8000,
  };
  return promise;
}

export function consumePrefetchedJobDetail(
  jobId: string,
): Promise<JobDetailFetchResult> {
  if (
    prefetchedEntry &&
    prefetchedEntry.jobId === jobId &&
    Date.now() < prefetchedEntry.expiresAt
  ) {
    const { promise } = prefetchedEntry;
    prefetchedEntry = null;
    return promise;
  }
  return apiFetch<JobDetail>(`/api/jobs/${encodeURIComponent(jobId)}`);
}
