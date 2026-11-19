import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readSupabaseEnv } from './env';
import { ApiError } from './http';

export type SkillCatalogRow = {
  id: number;
  name: string;
  category: string;
  aliases: string[] | null;
};

export function createPublicSkillClient(): SupabaseClient {
  const env = readSupabaseEnv();
  if (!env) {
    throw new ApiError(503, 'service_unavailable', 'Layanan belum dikonfigurasi.');
  }
  return createClient(env.url, env.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function loadSkillCatalog(client: SupabaseClient): Promise<SkillCatalogRow[]> {
  const { data, error } = await client
    .from('skills')
    .select('id, name, category, aliases');
  if (error) {
    throw new ApiError(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
  return (data ?? []) as SkillCatalogRow[];
}

export async function tryLoadSkillCatalog(client: SupabaseClient): Promise<SkillCatalogRow[]> {
  try {
    return await loadSkillCatalog(client);
  } catch (error) {
    console.error('[skills] katalog tidak tersedia', {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export function rankSkillSuggestions(
  rows: SkillCatalogRow[],
  query: string,
  limit: number,
): Array<{ id: number; name: string; category: string }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ rank: number; name: string; id: number; category: string }> = [];
  for (const row of rows) {
    const name = row.name.toLowerCase();
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    const aliasLower = aliases.map((a) => a.toLowerCase());
    let rank = 0;
    if (name.startsWith(q)) {
      rank = 1;
    } else if (aliasLower.some((a) => a === q || a.startsWith(q))) {
      rank = 2;
    } else if (name.includes(q) || aliasLower.some((a) => a.includes(q))) {
      rank = 3;
    }
    if (rank > 0) {
      scored.push({ rank, name: row.name, id: row.id, category: row.category });
    }
  }
  scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, 'id'));
  return scored.slice(0, limit).map(({ id, name, category }) => ({ id, name, category }));
}

export function canonicalizeSkillNames(
  skills: string[],
  rows: SkillCatalogRow[],
): string[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const canonical = row.name;
    const nameKey = row.name.trim().toLowerCase();
    if (nameKey && !byKey.has(nameKey)) byKey.set(nameKey, canonical);
    const aliases = Array.isArray(row.aliases) ? row.aliases : [];
    for (const alias of aliases) {
      const key = alias.trim().toLowerCase();
      if (key && !byKey.has(key)) byKey.set(key, canonical);
    }
  }
  const result: string[] = [];
  const seen = new Set<string>();
  for (const skill of skills) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    const canonical = byKey.get(key) ?? trimmed;
    const canonicalKey = canonical.toLowerCase();
    if (seen.has(canonicalKey)) continue;
    seen.add(canonicalKey);
    result.push(canonical);
  }
  return result;
}
