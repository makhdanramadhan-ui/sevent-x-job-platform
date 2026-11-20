import type { RecommendationProfileInput } from '../recommendation-contract';
import { isProfileLocationReady } from './location-filter';

export function hasBidangOrSkills(profile: RecommendationProfileInput): boolean {
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const positions = Array.isArray(profile?.preferences?.positions)
    ? profile.preferences.positions
    : [];
  const hasSkills = skills.some((s) => typeof s === 'string' && s.trim().length > 0);
  const hasBidang = positions.some((p) => typeof p === 'string' && p.trim().length > 0);
  return hasSkills || hasBidang;
}

export function isProfileRecommendationReady(profile: RecommendationProfileInput): boolean {
  return hasBidangOrSkills(profile) && isProfileLocationReady(profile?.preferences);
}
