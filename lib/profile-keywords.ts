import type { ProfileRecord } from './contracts';

export type ProfileKeywordState = {
  keywords: string[];
  hasBidang: boolean;
  hasSkills: boolean;
  isEmpty: boolean;
};

function cleanKeyword(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

export function extractProfileKeywords(
  profile: Pick<ProfileRecord, 'skills' | 'preferences'> | null | undefined,
): ProfileKeywordState {
  const positions = Array.isArray(profile?.preferences?.positions)
    ? profile.preferences.positions
    : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];

  const seen = new Set<string>();
  const keywords: string[] = [];

  for (const raw of [...positions, ...skills]) {
    const cleaned = cleanKeyword(typeof raw === 'string' ? raw : '');
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(cleaned);
  }

  const hasBidang = positions.some((p) => cleanKeyword(typeof p === 'string' ? p : '').length > 0);
  const hasSkills = skills.some((s) => cleanKeyword(typeof s === 'string' ? s : '').length > 0);

  return {
    keywords,
    hasBidang,
    hasSkills,
    isEmpty: !hasBidang && !hasSkills,
  };
}

export function jobMatchesKeywords(
  job: { title?: string | null; description?: string | null; skills?: string[] | null },
  keywords: string[],
): boolean {
  if (keywords.length === 0) return false;
  const title = (job.title ?? '').toLowerCase();
  const description = (job.description ?? '').toLowerCase();
  const skills = Array.isArray(job.skills) ? job.skills.map((s) => String(s).toLowerCase()) : [];
  return keywords.some((raw) => {
    const kw = raw.toLowerCase().trim();
    if (!kw) return false;
    if (title.includes(kw)) return true;
    if (description.includes(kw)) return true;
    return skills.some((s) => s.includes(kw) || kw.includes(s));
  });
}
