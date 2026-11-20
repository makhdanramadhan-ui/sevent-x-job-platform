import type {
  RecommendationFilters,
  RecommendationInput,
  RecommendationItem,
  RecommendationJobInput,
  RecommendationOutput,
} from '../recommendation-contract';
import { scoreSingleJob, SCORE_WEIGHTS, type DetailedScoreResult } from './scoring';
import type { LocationMatchTier } from './location-filter';
import { cleanToken, normalizeSkill } from './synonyms';

export { SCORE_WEIGHTS, normalizeSkill };

/**
 * Mode kerja, tipe pekerjaan dan level adalah preferensi lunak: mereka memengaruhi
 * skor lewat scoreSingleJob, tetapi tidak pernah menghilangkan lowongan.
 */
export function applyRecommendationFilters(
  jobs: ReadonlyArray<RecommendationJobInput>,
  _filters?: Partial<RecommendationFilters>,
): RecommendationJobInput[] {
  return [...jobs];
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
  locationTiers?: ReadonlyMap<string, LocationMatchTier>;
  nearbyLabels?: ReadonlyMap<string, string>;
};

const TIER_RANK: Record<LocationMatchTier, number> = { exact: 0, remote: 0, nearby: 1 };

/**
 * Fungsi utama mesin rekomendasi berbasis aturan (contract_version: 1).
 * Mengurutkan lowongan secara deterministik berdasarkan:
 * 1. Lowongan aktif/belum kedaluwarsa di atas lowongan tutup/kedaluwarsa
 * 2. Skor kecocokan tertinggi (0-100)
 * 3. Kecocokan lokasi persis/remote di atas lowongan lokasi terdekat
 * 4. Jumlah syarat yang terpenuhi (matchedRequirementCount) tertinggi
 * 5. Jumlah syarat yang belum terpenuhi (missing.length) terendah
 * 6. job_id secara leksikografis (penentu seri deterministik)
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
    const tierA = options.locationTiers?.get(a.job_id) ?? 'exact';
    const tierB = options.locationTiers?.get(b.job_id) ?? 'exact';
    if (TIER_RANK[tierA] !== TIER_RANK[tierB]) {
      return TIER_RANK[tierA] - TIER_RANK[tierB];
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
    location_note: options.nearbyLabels?.get(res.job_id) ?? null,
  }));

  return {
    contract_version: 1,
    items,
  };
}
