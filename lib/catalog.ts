import { ApiError } from './http';

export type CatalogEntry = {
  id: string;
  name: string;
  category: string;
  aliases: readonly string[];
};

export type CatalogSuggestion = {
  id: string;
  name: string;
  category: string;
};

export function normalizeCatalogText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function catalogId(name: string): string {
  return normalizeCatalogText(name).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function matchRank(entry: CatalogEntry, query: string): number | null {
  const name = normalizeCatalogText(entry.name);
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  const words = entry.name
    .split(/[\s/,&-]+/)
    .map(normalizeCatalogText)
    .filter((word) => word.length > 0);
  if (words.some((word) => word.startsWith(query))) return 2;
  if (entry.aliases.some((alias) => normalizeCatalogText(alias).startsWith(query))) return 3;
  if (name.includes(query)) return 4;
  return null;
}

export function searchCatalog(
  entries: readonly CatalogEntry[],
  query: string,
  limit = 8,
): CatalogSuggestion[] {
  const normalized = normalizeCatalogText(query);
  if (!normalized || limit < 1) return [];
  const scored: Array<{ entry: CatalogEntry; rank: number; index: number }> = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const rank = matchRank(entry, normalized);
    if (rank !== null) scored.push({ entry, rank, index });
  }
  scored.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.index - b.index ||
      a.entry.name.localeCompare(b.entry.name, 'id'),
  );
  return scored.slice(0, limit).map(({ entry }) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
  }));
}

export function buildCanonicalIndex(entries: readonly CatalogEntry[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    for (const candidate of [entry.name, ...entry.aliases]) {
      const key = normalizeCatalogText(candidate);
      if (!key) continue;
      const previous = index.get(key);
      if (previous && previous !== entry.name) {
        throw new Error(`Alias katalog bentrok: ${candidate} (${previous} / ${entry.name})`);
      }
      index.set(key, entry.name);
    }
  }
  return index;
}

export function canonicalizeCatalogValues(
  values: readonly string[],
  index: ReadonlyMap<string, string>,
): { values: string[]; invalid: string[] } {
  const canonical: string[] = [];
  const invalid: string[] = [];
  for (const value of values) {
    const resolved = index.get(normalizeCatalogText(value));
    if (!resolved) {
      invalid.push(value);
      continue;
    }
    if (!canonical.includes(resolved)) canonical.push(resolved);
  }
  return { values: canonical, invalid };
}

export function canonicalizeOrThrow(
  values: readonly string[],
  index: ReadonlyMap<string, string>,
  field: string,
): string[] {
  const result = canonicalizeCatalogValues(values, index);
  if (result.invalid.length > 0) {
    throw new ApiError(
      400,
      'validation_error',
      `Nilai ${field} tidak dikenal: ${result.invalid.join(', ')}. Pilih dari daftar yang tersedia.`,
      { field, invalid: result.invalid },
    );
  }
  return result.values;
}
