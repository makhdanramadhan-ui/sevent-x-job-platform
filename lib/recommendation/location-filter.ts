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
  wantsRemote?: boolean;
};

export function asLocationPreference(value: unknown): LocationPreference | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const country = typeof record.country === 'string' ? record.country : null;
  const locations = Array.isArray(record.locations)
    ? record.locations.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  const wantsRemote =
    (Array.isArray(record.work_modes) &&
      record.work_modes.some((mode) => typeof mode === 'string' && mode.trim().toLowerCase() === 'remote')) ||
    locations.some((name) => name.trim().toLowerCase() === 'remote');
  return { country, locations, wantsRemote };
}

export type LocationMatchTier = 'exact' | 'remote' | 'nearby';

export type LocationFilterDecision = {
  eligible: boolean;
  reason: 'ok' | 'missing_preferences' | 'unknown_job_country' | 'country_mismatch' | 'location_mismatch' | 'remote_not_selected' | 'remote_not_open_to_country';
  jobCountry: string | null;
  jobEntry: LocationEntry | null;
  matchTier: 'exact' | 'remote' | null;
};

const GLOBAL_REMOTE_RE = /\b(anywhere|worldwide|global|world|remote|seluruh dunia|semua negara|all countries|any country|international|global remote)\b/i;
const COUNTRY_ONLY_RE = /\b(only|only in|hanya|terbatas|restricted|exclusive)\b/i;

const JABODETABEK_NAMES: Record<string, true> = {
  'DKI Jakarta': true,
  'Jakarta Selatan': true,
  'Jakarta Pusat': true,
  'Jakarta Barat': true,
  'Jakarta Timur': true,
  'Jakarta Utara': true,
  'Kepulauan Seribu': true,
  Bogor: true,
  Depok: true,
  Bekasi: true,
  Tangerang: true,
  'Tangerang Selatan': true,
  'Kabupaten Bogor': true,
  'Kabupaten Bekasi': true,
  'Kabupaten Tangerang': true,
};

export const NEARBY_FALLBACK_MIN_MATCHES = 6;

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
    return (
      p.name === jobEntry.name ||
      (Boolean(jobEntry.province) && p.name === jobEntry.province) ||
      (jobEntry.type === 'province' && Boolean(p.province) && jobEntry.name === p.province)
    );
  });
}

function isJabodetabekEntry(entry: LocationEntry): boolean {
  return entry.country === 'ID' && (entry.province === 'DKI Jakarta' || JABODETABEK_NAMES[entry.name] === true);
}

export function isJobEligibleForLocationPreferences(
  job: JobLocationContext,
  rawPreferences: unknown,
): LocationFilterDecision {
  const preferences = asLocationPreference(rawPreferences);
  if (!preferences) {
    return { eligible: false, reason: 'missing_preferences', jobCountry: null, jobEntry: null, matchTier: null };
  }
  const country = preferences.country?.trim().toUpperCase() ?? '';
  const prefs = preferredEntries(preferences);
  if (!isValidCountryCode(country) || prefs.length === 0) {
    return { eligible: false, reason: 'missing_preferences', jobCountry: null, jobEntry: null, matchTier: null };
  }

  const { country: jobCountry, entry: jobEntry } = resolveJobLocation(job);
  const wantsRemote = preferences.wantsRemote === true || prefs.some((p) => p.country === '*');
  const isRemote = job.work_mode === 'remote';

  if (isRemote) {
    if (!wantsRemote) {
      return { eligible: false, reason: 'remote_not_selected', jobCountry, jobEntry, matchTier: null };
    }
    if (!jobCountry) {
      const description = `${job.location ?? ''} ${job.description ?? ''}`;
      if (GLOBAL_REMOTE_RE.test(description) && !COUNTRY_ONLY_RE.test(description)) {
        return { eligible: true, reason: 'ok', jobCountry: null, jobEntry: null, matchTier: 'remote' };
      }
      return { eligible: false, reason: 'unknown_job_country', jobCountry, jobEntry, matchTier: null };
    }
    if (jobCountry !== country) {
      return { eligible: false, reason: 'remote_not_open_to_country', jobCountry, jobEntry, matchTier: null };
    }
    return { eligible: true, reason: 'ok', jobCountry, jobEntry, matchTier: 'remote' };
  }

  if (!jobCountry) {
    return { eligible: false, reason: 'unknown_job_country', jobCountry, jobEntry, matchTier: null };
  }
  if (jobCountry !== country) {
    return { eligible: false, reason: 'country_mismatch', jobCountry, jobEntry, matchTier: null };
  }
  if (!matchesPreferredLocation(jobEntry, jobCountry, prefs)) {
    return { eligible: false, reason: 'location_mismatch', jobCountry, jobEntry, matchTier: null };
  }
  return { eligible: true, reason: 'ok', jobCountry, jobEntry, matchTier: 'exact' };
}

export type NearbyLocationMatch = { matched: boolean; label: string | null };

/**
 * Cocokan lowongan di provinsi induk atau wilayah Jabodetabek sebagai cadangan
 * ketika lokasi persis preferensi tidak tersedia. Tidak pernah mencakup seluruh Indonesia.
 */
export function findNearbyLocationMatch(
  job: JobLocationContext,
  rawPreferences: unknown,
): NearbyLocationMatch {
  const preferences = asLocationPreference(rawPreferences);
  if (!preferences) return { matched: false, label: null };
  const country = preferences.country?.trim().toUpperCase() ?? '';
  if (!isValidCountryCode(country)) return { matched: false, label: null };

  const anchors = preferredEntries(preferences).filter(
    (entry) => entry.country === 'ID' && entry.type !== 'country' && entry.name !== 'Seluruh Indonesia',
  );
  if (anchors.length === 0) return { matched: false, label: null };

  const { country: jobCountry, entry: jobEntry } = resolveJobLocation(job);
  if (jobCountry !== country || !jobEntry) return { matched: false, label: null };

  for (const anchor of anchors) {
    const sameProvince = Boolean(jobEntry.province) && jobEntry.province === anchor.province;
    const sameRegion = isJabodetabekEntry(anchor) && isJabodetabekEntry(jobEntry);
    if (sameProvince || sameRegion) {
      return { matched: true, label: `Lokasi terdekat: ${jobEntry.name}` };
    }
  }
  return { matched: false, label: null };
}

export type LocationSelection<T> = {
  jobs: T[];
  tiers: Map<string, LocationMatchTier>;
  nearbyLabels: Map<string, string>;
  diagnostics: Record<string, number>;
  counts: Record<LocationMatchTier, number>;
};

/**
 * Memilih lowongan yang lolos filter keras negara/lokasi, ditambah lowongan
 * di provinsi induk atau wilayah Jabodetabek (diberi tier 'nearby' agar tetap
 * berada di bawah lokasi persis saat skornya setara, namun tidak membuang
 * lowongan skor tinggi di kota penyangga seperti Kota Tangerang/BSD/Depok/Bekasi/Bogor).
 */
export function selectLocationEligibleJobs<T extends { id: string } & JobLocationContext>(
  jobs: ReadonlyArray<T>,
  rawPreferences: unknown,
): LocationSelection<T> {
  const tiers = new Map<string, LocationMatchTier>();
  const nearbyLabels = new Map<string, string>();
  const diagnostics: Record<string, number> = {};
  const primary: T[] = [];
  const leftovers: T[] = [];

  for (const job of jobs) {
    const decision = isJobEligibleForLocationPreferences(job, rawPreferences);
    diagnostics[decision.reason] = (diagnostics[decision.reason] ?? 0) + 1;
    if (decision.eligible) {
      primary.push(job);
      tiers.set(job.id, decision.matchTier ?? 'exact');
    } else {
      leftovers.push(job);
    }
  }

  for (const job of leftovers) {
    const nearby = findNearbyLocationMatch(job, rawPreferences);
    if (!nearby.matched) continue;
    primary.push(job);
    tiers.set(job.id, 'nearby');
    if (nearby.label) nearbyLabels.set(job.id, nearby.label);
    diagnostics.nearby_fallback = (diagnostics.nearby_fallback ?? 0) + 1;
  }

  const counts: Record<LocationMatchTier, number> = { exact: 0, remote: 0, nearby: 0 };
  for (const tier of tiers.values()) counts[tier] += 1;

  return { jobs: primary, tiers, nearbyLabels, diagnostics, counts };
}

export function isProfileLocationReady(rawPreferences: unknown): boolean {
  const preferences = asLocationPreference(rawPreferences);
  if (!preferences) return false;
  const country = preferences.country?.trim().toUpperCase() ?? '';
  return isValidCountryCode(country) && preferences.locations.length > 0;
}
