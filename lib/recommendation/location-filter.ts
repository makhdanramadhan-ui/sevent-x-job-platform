import { findCountry, isValidCountryCode } from '../countries';
import { findLocation, LOCATIONS, type LocationEntry } from '../locations';

export type JobLocationContext = {
  work_mode: string | null | undefined;
  location: string | null | undefined;
  description?: string | null;
};

export type LocationPreference = {
  country?: string | null;
  locations: ReadonlyArray<string>;
};

export function asLocationPreference(value: unknown): LocationPreference | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const country = typeof record.country === 'string' ? record.country : null;
  const locations = Array.isArray(record.locations)
    ? record.locations.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return { country, locations };
}

export type LocationFilterDecision = {
  eligible: boolean;
  reason: 'ok' | 'missing_preferences' | 'unknown_job_country' | 'country_mismatch' | 'location_mismatch' | 'remote_not_selected' | 'remote_not_open_to_country';
  jobCountry: string | null;
  jobEntry: LocationEntry | null;
};

const GLOBAL_REMOTE_RE = /\b(anywhere|worldwide|global|world|remote|seluruh dunia|semua negara|all countries|any country|international|global remote)\b/i;
const COUNTRY_ONLY_RE = /\b(only|only in|hanya|terbatas|restricted|exclusive)\b/i;

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase('id-ID')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function matchEntry(text: string): LocationEntry | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  let best: LocationEntry | null = null;
  let bestLength = 0;
  for (const entry of LOCATIONS) {
    if (entry.country === '*') continue;
    for (const candidate of [entry.name, ...entry.aliases]) {
      const key = normalizeText(candidate);
      if (key.length < 3 || key.length <= bestLength) continue;
      const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu');
      if (pattern.test(normalized)) {
        best = entry;
        bestLength = key.length;
      }
    }
  }
  return best;
}

function matchCountryCode(text: string): string | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  for (const [code, country] of [['ID', 'Indonesia'], ['BR', 'Brazil'], ['BR', 'Brasil'], ['US', 'United States'], ['US', 'USA'], ['US', 'Amerika Serikat']] as const) {
    const key = normalizeText(country);
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${key}($|[^\\p{L}\\p{N}])`, 'iu');
    if (pattern.test(normalized)) return code;
  }
  const found = findCountry(text);
  return found && isValidCountryCode(found.code) ? found.code : null;
}

function resolveJobLocation(job: JobLocationContext): { country: string | null; entry: LocationEntry | null } {
  const location = job.location?.trim() ?? '';
  if (!location) return { country: null, entry: null };
  const entry = matchEntry(location);
  const countryCode = entry && entry.country !== '*' ? entry.country : matchCountryCode(location);
  return { country: countryCode, entry };
}

function preferredEntries(preferences: LocationPreference): LocationEntry[] {
  const result: LocationEntry[] = [];
  for (const name of preferences.locations ?? []) {
    const entry = findLocation(name);
    if (entry) result.push(entry);
  }
  return result;
}

function matchesPreferredLocation(
  jobEntry: LocationEntry | null,
  jobCountry: string,
  prefs: LocationEntry[],
): boolean {
  if (!jobEntry) return prefs.some((p) => p.type === 'country' && p.country === jobCountry);
  return prefs.some((p) => {
    if (p.country === '*') return false;
    if (p.country !== jobCountry) return false;
    if (p.type === 'country' || p.name === 'Seluruh Indonesia') return true;
    return p.name === jobEntry.name || (Boolean(jobEntry.province) && p.name === jobEntry.province);
  });
}

export function isJobEligibleForLocationPreferences(
  job: JobLocationContext,
  rawPreferences: unknown,
): LocationFilterDecision {
  const preferences = asLocationPreference(rawPreferences);
  if (!preferences) {
    return { eligible: false, reason: 'missing_preferences', jobCountry: null, jobEntry: null };
  }
  const country = preferences.country?.trim().toUpperCase() ?? '';
  const prefs = preferredEntries(preferences);
  if (!isValidCountryCode(country) || prefs.length === 0) {
    return { eligible: false, reason: 'missing_preferences', jobCountry: null, jobEntry: null };
  }

  const { country: jobCountry, entry: jobEntry } = resolveJobLocation(job);
  const wantsRemote = prefs.some((p) => p.country === '*');
  const isRemote = job.work_mode === 'remote';

  if (isRemote) {
    if (!wantsRemote) {
      return { eligible: false, reason: 'remote_not_selected', jobCountry, jobEntry };
    }
    if (!jobCountry) {
      const description = `${job.location ?? ''} ${job.description ?? ''}`;
      if (GLOBAL_REMOTE_RE.test(description) && !COUNTRY_ONLY_RE.test(description)) {
        return { eligible: true, reason: 'ok', jobCountry: null, jobEntry: null };
      }
      return { eligible: false, reason: 'unknown_job_country', jobCountry, jobEntry };
    }
    if (jobCountry !== country) {
      return { eligible: false, reason: 'remote_not_open_to_country', jobCountry, jobEntry };
    }
    return { eligible: true, reason: 'ok', jobCountry, jobEntry };
  }

  if (!jobCountry) {
    return { eligible: false, reason: 'unknown_job_country', jobCountry, jobEntry };
  }
  if (jobCountry !== country) {
    return { eligible: false, reason: 'country_mismatch', jobCountry, jobEntry };
  }
  if (!matchesPreferredLocation(jobEntry, jobCountry, prefs)) {
    return { eligible: false, reason: 'location_mismatch', jobCountry, jobEntry };
  }
  return { eligible: true, reason: 'ok', jobCountry, jobEntry };
}

export function isProfileLocationReady(rawPreferences: unknown): boolean {
  const preferences = asLocationPreference(rawPreferences);
  if (!preferences) return false;
  const country = preferences.country?.trim().toUpperCase() ?? '';
  return isValidCountryCode(country) && preferences.locations.length > 0;
}
