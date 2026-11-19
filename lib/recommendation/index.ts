import type {
  RecommendationFilters,
  RecommendationInput,
  RecommendationItem,
  RecommendationJobInput,
  RecommendationOutput,
} from '../recommendation-contract';
import { scoreSingleJob, SCORE_WEIGHTS, type DetailedScoreResult } from './scoring';
import { cleanToken, normalizeSkill } from './synonyms';

export { SCORE_WEIGHTS, normalizeSkill };

/**
 * Menyaring daftar lowongan berdasarkan RecommendationFilters jika filter diberikan.
 * Filter kosong (array kosong) berarti tidak membatasi dimensi tersebut.
 */
export function applyRecommendationFilters(
  jobs: ReadonlyArray<RecommendationJobInput>,
  filters?: Partial<RecommendationFilters>,
): RecommendationJobInput[] {
  if (!filters) return [...jobs];

  const workModes =
    filters.work_modes && filters.work_modes.length > 0 ? new Set(filters.work_modes) : null;
  const employmentTypes =
    filters.employment_types && filters.employment_types.length > 0
      ? new Set(filters.employment_types)
      : null;
  const levels = filters.levels && filters.levels.length > 0 ? new Set(filters.levels) : null;

  return jobs.filter((job) => {
    if (workModes && !workModes.has(job.work_mode)) return false;
    if (employmentTypes && !employmentTypes.has(job.employment_type)) return false;
    if (levels && !levels.has(job.level)) return false;
    return true;
  });
}

function buildConservativeDuplicateSignature(job: RecommendationJobInput): string {
  const title = cleanToken(job.title ?? '');
  const company = cleanToken(job.company ?? '');
  const location = cleanToken(job.location ?? '');
  const mode = job.work_mode ?? 'unknown';
  const empType = job.employment_type ?? 'unknown';
  const level = job.level ?? 'unknown';
  return `${title}|${company}|${location}|${mode}|${empType}|${level}`;
}

export type RankJobsOptions = {
  referenceDate?: string;
  filters?: Partial<RecommendationFilters>;
};

/**
 * Fungsi utama mesin rekomendasi berbasis aturan (contract_version: 1).
 * Mengurutkan lowongan secara deterministik berdasarkan:
 * 1. Lowongan aktif/belum kedaluwarsa di atas lowongan tutup/kedaluwarsa
 * 2. Skor kecocokan tertinggi (0-100)
 * 3. Jumlah syarat yang terpenuhi (matchedRequirementCount) tertinggi
 * 4. Jumlah syarat yang belum terpenuhi (missing.length) terendah
 * 5. job_id secara leksikografis (penentu seri deterministik)
 */
export function rankJobs(
  input: RecommendationInput,
  options: RankJobsOptions = {},
): RecommendationOutput {
  const filteredJobs = applyRecommendationFilters(input.jobs ?? [], options.filters);

  const seenSignatures = new Set<string>();
  const seenJobIds = new Set<string>();
  const detailedResults: DetailedScoreResult[] = [];

  for (const job of filteredJobs) {
    if (!job || typeof job.id !== 'string') continue;
    // Abaikan jika ID lowongan sama persis muncul dua kali di array input
    if (seenJobIds.has(job.id)) continue;
    seenJobIds.add(job.id);

    const signature = buildConservativeDuplicateSignature(job);
    const isDuplicateInBatch = seenSignatures.has(signature);
    seenSignatures.add(signature);

    const scored = scoreSingleJob(input.profile, job, {
      referenceDate: options.referenceDate,
      isDuplicateInBatch,
    });
    detailedResults.push(scored);
  }

  detailedResults.sort((a, b) => {
    if (a.isInactiveOrExpired !== b.isInactiveOrExpired) {
      return a.isInactiveOrExpired ? 1 : -1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.matchedRequirementCount !== a.matchedRequirementCount) {
      return b.matchedRequirementCount - a.matchedRequirementCount;
    }
    if (a.missing.length !== b.missing.length) {
      return a.missing.length - b.missing.length;
    }
    return a.job_id.localeCompare(b.job_id);
  });

  const items: RecommendationItem[] = detailedResults.map((res) => ({
    job_id: res.job_id,
    score: res.score,
    matched: res.matched,
    missing: res.missing,
    unknown: res.unknown,
  }));

  return {
    contract_version: 1,
    items,
  };
}
