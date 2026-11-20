import { createClient } from '@supabase/supabase-js';
import { canonicalizeCatalogValues } from '../lib/catalog-core';
import { COUNTRIES } from '../lib/countries';
import { findLocation, LOCATION_CANONICAL } from '../lib/locations';
import { POSITION_CANONICAL } from '../lib/positions';

type Preferences = Record<string, unknown> & {
  country?: string;
  positions?: string[];
  locations?: string[];
};

type ProfileRow = {
  user_id: string;
  location: string | null;
  preferences: Preferences | null;
};

type Report = {
  mode: 'dry-run' | 'apply';
  profilesScanned: number;
  profilesUpdated: number;
  positionsCanonicalized: number;
  positionsDropped: number;
  locationsCanonicalized: number;
  locationsDropped: number;
  countriesBackfilled: number;
  examples: {
    positionsDropped: string[];
    locationsDropped: string[];
    countriesBackfilled: string[];
  };
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('UNTESTED: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  process.exit(2);
}

const VALID_COUNTRIES = new Set(COUNTRIES.map((country) => country.code));
const PAGE_SIZE = 500;

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function resolveCountry(
  existing: unknown,
  locations: readonly string[],
  domisili: string | null,
): string {
  if (typeof existing === 'string' && VALID_COUNTRIES.has(existing)) return existing;
  for (const name of locations) {
    const location = findLocation(name);
    if (location && location.country !== '*') return location.country;
  }
  const home = domisili ? findLocation(domisili) : null;
  return home && home.country !== '*' && VALID_COUNTRIES.has(home.country) ? home.country : '';
}

function transformProfile(row: ProfileRow, report: Report): Preferences | null {
  const preferences = row.preferences && typeof row.preferences === 'object' ? row.preferences : {};
  const oldPositions = asStringList(preferences.positions);
  const oldLocations = asStringList(preferences.locations);

  const positions = canonicalizeCatalogValues(oldPositions, POSITION_CANONICAL);
  const locations = canonicalizeCatalogValues(oldLocations, LOCATION_CANONICAL);
  const country = resolveCountry(preferences.country, locations.values, row.location);

  const keptLocations = locations.values.filter((name) => {
    const location = findLocation(name);
    return location && (location.country === country || location.country === '*');
  });

  const countryChanged = country !== (typeof preferences.country === 'string' ? preferences.country : '');
  const next: Preferences = {
    ...preferences,
    country,
    positions: positions.values,
    locations: keptLocations,
  };

  const changed =
    countryChanged ||
    positions.values.join('\n') !== oldPositions.join('\n') ||
    keptLocations.join('\n') !== oldLocations.join('\n');
  if (!changed) return null;

  report.positionsCanonicalized += positions.values.filter(
    (value) => !oldPositions.includes(value),
  ).length;
  report.positionsDropped += positions.invalid.length;
  report.locationsCanonicalized += keptLocations.filter(
    (value) => !oldLocations.includes(value),
  ).length;
  report.locationsDropped += locations.invalid.length + (locations.values.length - keptLocations.length);
  if (countryChanged && country) report.countriesBackfilled += 1;

  if (positions.invalid.length && report.examples.positionsDropped.length < 5) {
    report.examples.positionsDropped.push(...positions.invalid.slice(0, 5 - report.examples.positionsDropped.length));
  }
  const droppedLocations = [...locations.invalid, ...locations.values.filter((value) => !keptLocations.includes(value))];
  if (droppedLocations.length && report.examples.locationsDropped.length < 5) {
    report.examples.locationsDropped.push(...droppedLocations.slice(0, 5 - report.examples.locationsDropped.length));
  }
  if (countryChanged && country && report.examples.countriesBackfilled.length < 5) {
    report.examples.countriesBackfilled.push(`${row.user_id.slice(0, 8)} -> ${country}`);
  }
  return next;
}

async function main(): Promise<void> {
  const report: Report = {
    mode: APPLY ? 'apply' : 'dry-run',
    profilesScanned: 0,
    profilesUpdated: 0,
    positionsCanonicalized: 0,
    positionsDropped: 0,
    locationsCanonicalized: 0,
    locationsDropped: 0,
    countriesBackfilled: 0,
    examples: { positionsDropped: [], locationsDropped: [], countriesBackfilled: [] },
  };

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, location, preferences')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal membaca profil: ${error.message}`);
    const rows = (data ?? []) as ProfileRow[];
    if (rows.length === 0) break;

    for (const row of rows) {
      report.profilesScanned += 1;
      const next = transformProfile(row, report);
      if (!next) continue;
      if (APPLY) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ preferences: next })
          .eq('user_id', row.user_id);
        if (updateError) throw new Error(`Gagal update ${row.user_id}: ${updateError.message}`);
      }
      report.profilesUpdated += 1;
    }
    if (rows.length < PAGE_SIZE) break;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
