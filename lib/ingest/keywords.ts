import type { SupabaseClient } from '@supabase/supabase-js';
import { extractProfileKeywords } from '../profile-keywords';

type ProfileRow = {
  skills: string[] | null;
  preferences: { positions?: string[] } | null;
};

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
