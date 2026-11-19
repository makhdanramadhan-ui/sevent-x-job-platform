const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  linkedin_guest: 'LinkedIn',
  remotive_api: 'Remotive',
  jobicy_api: 'Jobicy',
  himalayas_api: 'Himalayas',
  arbeitnow_api: 'Arbeitnow',
  themuse_api: 'The Muse',
  jobdata_api: 'JobData',
  adzuna_api: 'Adzuna',
  test_fixture_feed: 'Sumber Terverifikasi',
};

export function displaySourceName(sourceName: string | null | undefined): string {
  if (!sourceName) return 'Sumber Asli';
  const key = sourceName.trim().toLowerCase();
  return SOURCE_DISPLAY_NAMES[key] ?? sourceName;
}
