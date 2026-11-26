import { isProfileRecommendationReady } from './recommendation/profile-readiness';
import { scoreSingleJob } from './recommendation/scoring';
import type {
  RecommendationJobInputWithContext,
  RecommendationProfileInput,
} from './recommendation-contract';

export type MatchTierTone = 'high' | 'medium' | 'low';

export type SingleJobMatchResult =
  | {
      ready: false;
      reason: 'profile_incomplete';
    }
  | {
      ready: true;
      job_id: string;
      score: number;
      tier_label: string;
      tier_tone: MatchTierTone;
      matched: string[];
      missing: string[];
      unknown: string[];
      is_inactive_or_expired: boolean;
    };

export function getMatchTier(score: number): { label: string; tone: MatchTierTone } {
  if (score >= 70) {
    return { label: 'Sangat Cocok', tone: 'high' };
  }
  if (score >= 45) {
    return { label: 'Cukup Cocok', tone: 'medium' };
  }
  return { label: 'Perlu Penyesuaian', tone: 'low' };
}

export function evaluateSingleJobMatch(
  profile: RecommendationProfileInput | null | undefined,
  job: RecommendationJobInputWithContext,
  options?: { referenceDate?: string },
): SingleJobMatchResult {
  const safeProfile: RecommendationProfileInput = profile ?? null;
  if (!isProfileRecommendationReady(safeProfile)) {
    return {
      ready: false,
      reason: 'profile_incomplete',
    };
  }

  const scored = scoreSingleJob(safeProfile, job, {
    referenceDate: options?.referenceDate,
  });
  const tier = getMatchTier(scored.score);

  return {
    ready: true,
    job_id: scored.job_id,
    score: scored.score,
    tier_label: tier.label,
    tier_tone: tier.tone,
    matched: scored.matched,
    missing: scored.missing,
    unknown: scored.unknown,
    is_inactive_or_expired: scored.isInactiveOrExpired,
  };
}
