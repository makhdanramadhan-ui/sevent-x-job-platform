import type { SupabaseClient } from '@supabase/supabase-js';
import { findCountry } from '../countries';
import { findLocation } from '../locations';
import { extractProfileKeywords } from '../profile-keywords';

type ProfileRow = {
  skills: string[] | null;
  preferences: {
    country?: string | null;
    positions?: string[];
    locations?: string[];
    levels?: string[];
    employment_types?: string[];
  } | null;
};

export type IngestLocationPolicy = {
  location: string;
  includeRemoteSources: boolean;
};

export function resolveIngestLocationPolicy(
  preferences: ReadonlyArray<ProfileRow['preferences']>,
): IngestLocationPolicy {
  const locations = new Set<string>();
  let includeRemoteSources = false;
  let countryCode = '';

  for (const pref of preferences) {
    if (Array.isArray(pref?.locations)) {
      for (const name of pref.locations ?? []) {
        if (name === 'Remote') {
          includeRemoteSources = true;
          continue;
        }
        if (typeof name === 'string' && name.trim()) locations.add(name.trim());
      }
    }
    if (!countryCode && typeof pref?.country === 'string' && pref.country.trim()) {
      countryCode = pref.country.trim().toUpperCase();
    }
  }

  const nonGlobalLocations = [...locations].filter((name) => findLocation(name)?.country !== '*');
  const countryName = countryCode ? findCountry(countryCode)?.name : null;
  if (nonGlobalLocations.length === 1) {
    return { location: nonGlobalLocations[0], includeRemoteSources };
  }
  return { location: countryName ?? 'Indonesia', includeRemoteSources };
}

export type ProfileIngestPreferences = {
  positions: string[];
  wantsIntern: boolean;
};

export function resolveProfileIngestPreferences(
  row: ProfileRow | null,
): ProfileIngestPreferences {
  const positions = Array.isArray(row?.preferences?.positions)
    ? row.preferences.positions.filter((p) => typeof p === 'string' && p.trim())
    : [];
  const levels = Array.isArray(row?.preferences?.levels) ? row.preferences.levels : [];
  const employmentTypes = Array.isArray(row?.preferences?.employment_types)
    ? row.preferences.employment_types
    : [];
  return {
    positions,
    wantsIntern: levels.includes('intern') || employmentTypes.includes('internship'),
  };
}

export async function collectProfileIngestPreferences(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileIngestPreferences> {
  const { data, error } = await admin
    .from('profiles')
    .select('skills, preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return resolveProfileIngestPreferences((data ?? null) as ProfileRow | null);
}

export function buildInternshipSearchKeywords(positions: ReadonlyArray<string>): string[] {
  const keywords: string[] = [];
  for (const position of positions) {
    const clean = position.trim();
    if (!clean) continue;
    keywords.push(`${clean} intern`, `${clean} internship`, `${clean} magang`);
  }
  return keywords;
}

export async function collectIngestLocationPolicy(
  admin: SupabaseClient,
  userId?: string,
): Promise<IngestLocationPolicy> {
  let query = admin.from('profiles').select('preferences');
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ preferences: ProfileRow['preferences'] }>;
  return resolveIngestLocationPolicy(rows.map((row) => row.preferences));
}

function interleaveKeywordLists(lists: ReadonlyArray<ReadonlyArray<string>>): string[] {
  const result: string[] = [];
  const maxLen = lists.reduce((max, list) => Math.max(max, list.length), 0);
  for (let i = 0; i < maxLen; i += 1) {
    for (const list of lists) {
      if (i < list.length) {
        result.push(list[i]);
      }
    }
  }
  return result;
}

export async function collectAllUserKeywords(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('skills, preferences')
    .order('updated_at', { ascending: false, nullsFirst: false });
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as ProfileRow[];
  const positionLists: string[][] = [];
  const skillLists: string[][] = [];

  for (const row of rows) {
    const posExtracted = extractProfileKeywords({
      skills: [],
      preferences: {
        positions: Array.isArray(row.preferences?.positions) ? row.preferences.positions : [],
        locations: [],
        levels: [],
        work_modes: [],
        employment_types: [],
      },
    } as any);
    if (posExtracted.keywords.length > 0) {
      positionLists.push(posExtracted.keywords);
    }

    const skillExtracted = extractProfileKeywords({
      skills: Array.isArray(row.skills) ? row.skills : [],
      preferences: {
        positions: [],
        locations: [],
        levels: [],
        work_modes: [],
        employment_types: [],
      },
    } as any);
    if (skillExtracted.keywords.length > 0) {
      skillLists.push(skillExtracted.keywords);
    }
  }

  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const kw of [
    ...interleaveKeywordLists(positionLists),
    ...interleaveKeywordLists(skillLists),
  ]) {
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    keywords.push(kw);
  }
  return keywords;
}

export async function collectUserKeywords(
  admin: SupabaseClient,
  userId: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('skills, preferences')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) return [];
  const row = data as ProfileRow;
  const extracted = extractProfileKeywords({
    skills: Array.isArray(row.skills) ? row.skills : [],
    preferences: {
      positions: Array.isArray(row.preferences?.positions) ? row.preferences.positions : [],
      locations: [],
      levels: [],
      work_modes: [],
      employment_types: [],
    },
  } as any);
  return extracted.keywords;
}
