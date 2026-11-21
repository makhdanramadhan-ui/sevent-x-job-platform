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

  const chosen = [...locations].find((name) => findLocation(name)?.country !== '*');
  if (chosen) return { location: chosen, includeRemoteSources };
  const countryName = countryCode ? findCountry(countryCode)?.name : null;
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

export async function collectAllUserKeywords(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from('profiles')
    .select('skills, preferences');
  if (error) {
    throw new Error(error.message);
  }
  const rows = (data ?? []) as ProfileRow[];
  const seen = new Set<string>();
  const keywords: string[] = [];
  for (const row of rows) {
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
    for (const kw of extracted.keywords) {
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      keywords.push(kw);
    }
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
