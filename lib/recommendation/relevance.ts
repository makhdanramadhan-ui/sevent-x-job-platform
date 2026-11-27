import { extractCanonicalSkillsFromText, extractRoleTokens, normalizeSkill } from './synonyms';

export type ProfileRelevanceContext = {
  skills?: ReadonlyArray<string> | null;
  experiences?: ReadonlyArray<{ title?: string | null; description?: string | null }> | null;
  projects?: ReadonlyArray<{ name?: string | null; description?: string | null }> | null;
  preferences?: { positions?: ReadonlyArray<string> | null } | null;
};

export type JobRelevanceContext = {
  title?: string | null;
  description?: string | null;
  skills?: ReadonlyArray<string> | null;
};

export type JobRelevanceDecision = {
  relevant: boolean;
  reason: 'role_match' | 'skill_match' | 'no_match' | 'no_profile_signal';
  roleGroups: string[];
  skillMatches: string[];
};

function canonicalSkills(text: string | null | undefined): Set<string> {
  return extractCanonicalSkillsFromText(text);
}

/**
 * Menilai relevansi lowongan hanya dari grup peran kanonik dan skill katalog.
 * Token generik (misalnya "A/B Testing" di deskripsi pemasaran) tidak dihitung.
 */
export function isJobRelevantToProfile(
  job: JobRelevanceContext,
  profile: ProfileRelevanceContext | null | undefined,
): JobRelevanceDecision {
  const positions = Array.isArray(profile?.preferences?.positions)
    ? profile.preferences.positions
    : [];
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];

  const userGroups = new Set<string>();
  for (const position of positions) {
    if (typeof position !== 'string' || !position.trim()) continue;
    for (const group of extractRoleTokens(position).groups) userGroups.add(group);
  }

  const userSkills = new Set<string>();
  for (const skill of skills) {
    if (typeof skill !== 'string' || !skill.trim()) continue;
    const normalized = normalizeSkill(skill);
    if (normalized) userSkills.add(normalized);
    for (const canonical of canonicalSkills(skill)) userSkills.add(canonical);
  }
  for (const exp of profile?.experiences ?? []) {
    if (!exp) continue;
    for (const canonical of canonicalSkills(`${exp.title ?? ''} ${exp.description ?? ''}`)) {
      userSkills.add(canonical);
    }
  }
  for (const proj of profile?.projects ?? []) {
    if (!proj) continue;
    for (const canonical of canonicalSkills(`${proj.name ?? ''} ${proj.description ?? ''}`)) {
      userSkills.add(canonical);
    }
  }

  if (userGroups.size === 0 && userSkills.size === 0) {
    return { relevant: false, reason: 'no_profile_signal', roleGroups: [], skillMatches: [] };
  }

  const jobGroups = [...extractRoleTokens(job.title).groups];
  const roleGroups = jobGroups.filter((group) => userGroups.has(group));

  const jobSkillSet = canonicalSkills(`${job.title ?? ''} ${job.description ?? ''}`);
  for (const skill of job.skills ?? []) {
    if (typeof skill !== 'string' || !skill.trim()) continue;
    const normalized = normalizeSkill(skill);
    if (normalized) jobSkillSet.add(normalized);
    for (const canonical of canonicalSkills(skill)) jobSkillSet.add(canonical);
  }
  const skillMatches = [...jobSkillSet].filter((canonical) => userSkills.has(canonical));

  const reason =
    roleGroups.length > 0 ? 'role_match' : skillMatches.length > 0 ? 'skill_match' : 'no_match';
  return {
    relevant: reason !== 'no_match',
    reason,
    roleGroups,
    skillMatches,
  };
}

export type RelevantJobsResult<T> = {
  relevant: T[];
  diagnostics: Record<string, number>;
};

export function filterRelevantJobs<T extends JobRelevanceContext>(
  jobs: ReadonlyArray<T>,
  profile: ProfileRelevanceContext | null | undefined,
): RelevantJobsResult<T> {
  const diagnostics: Record<string, number> = {};
  const relevant: T[] = [];
  for (const job of jobs) {
    const decision = isJobRelevantToProfile(job, profile);
    diagnostics[decision.reason] = (diagnostics[decision.reason] ?? 0) + 1;
    if (decision.relevant) relevant.push(job);
  }
  return { relevant, diagnostics };
}
