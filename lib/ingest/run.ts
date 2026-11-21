import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalizeCatalogValues, normalizeCatalogText } from '../catalog-core';
import { loadSkillCatalog } from '../skills';
import type { IngestPayload } from './normalize';
import { enrichMissingCompanyLogos } from './logo-fallback';
import {
  buildInternshipSearchKeywords,
  collectIngestLocationPolicy,
  collectProfileIngestPreferences,
  collectUserKeywords,
} from './keywords';
import {
  fetchHimalayasPublicApi,
  fetchJobicyPublicApi,
  fetchLinkedinGuestJobs,
  fetchRemotivePublicApi,
  type SourceFetchResult,
} from './sources';
import { claimProfileIngestTrigger, filterThrottledKeywords } from './throttle';

export type IngestRunSummary = {
  keywords_requested: string[];
  keywords_fetched: string[];
  linkedin: SourceFetchResult | null;
  internshipLinkedin: SourceFetchResult | null;
  internshipKeywords: string[];
  fillers: SourceFetchResult[];
  ingested: number;
  ingest_errors: number;
  by_source: Record<string, number>;
};

const LINKEDIN_MIN_RESULTS_BEFORE_FILLERS = 6;
const MAX_LINKEDIN_KEYWORDS_PER_RUN = 8;
const LINKEDIN_LIMIT_PER_KEYWORD = 4;
const FILLER_LIMIT = 8;

async function ingestPayload(
  admin: SupabaseClient,
  payload: IngestPayload,
): Promise<string | null> {
  const { data, error } = await admin.rpc('ingest_job', { payload });
  if (error) {
    throw new Error(error.message);
  }
  if (typeof data === 'string' && data.trim()) return data.trim();
  return null;
}

function dedupePayloads(payloads: IngestPayload[]): IngestPayload[] {
  const seen = new Set<string>();
  const result: IngestPayload[] = [];
  for (const payload of payloads) {
    const key = `${payload.source.name}::${payload.source.job_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(payload);
  }
  return result;
}

export async function runKeywordIngest(
  admin: SupabaseClient,
  keywords: string[],
  options: { respectThrottle?: boolean; forceFillers?: boolean; userId?: string; internshipKeywords?: string[] } = {},
): Promise<IngestRunSummary> {
  const uniqueKeywords = Array.from(
    new Set(
      keywords
        .map((k) => k.replace(/\s+/g, ' ').trim())
        .filter((k) => k.length > 0),
    ),
  ).slice(0, 20);

  let keywordsToFetch = uniqueKeywords.slice(0, MAX_LINKEDIN_KEYWORDS_PER_RUN);
  if (options.respectThrottle !== false) {
    keywordsToFetch = await filterThrottledKeywords(admin, keywordsToFetch);
  }

  const summary: IngestRunSummary = {
    keywords_requested: uniqueKeywords,
    keywords_fetched: keywordsToFetch,
    linkedin: null,
    internshipLinkedin: null,
    internshipKeywords: Array.from(
      new Set((options.internshipKeywords ?? []).map((k) => k.trim()).filter(Boolean)),
    ).slice(0, MAX_LINKEDIN_KEYWORDS_PER_RUN),
    fillers: [],
    ingested: 0,
    ingest_errors: 0,
    by_source: {},
  };

  let locationPolicy = { location: 'Indonesia', includeRemoteSources: false };
  try {
    locationPolicy = await collectIngestLocationPolicy(admin, options.userId);
  } catch {
  }

  const allPayloads: IngestPayload[] = [];

  if (keywordsToFetch.length > 0) {
    const linkedin = await fetchLinkedinGuestJobs({
      keywords: keywordsToFetch,
      location: locationPolicy.location,
      limitPerKeyword: LINKEDIN_LIMIT_PER_KEYWORD,
      fetchDetail: true,
      delaySeconds: 1.2,
    });
    summary.linkedin = linkedin;
    if (linkedin.payloads.length > 0) {
      allPayloads.push(...linkedin.payloads);
    }
  }

  if (summary.internshipKeywords.length > 0) {
    const internship = await fetchLinkedinGuestJobs({
      keywords: summary.internshipKeywords,
      location: locationPolicy.location,
      limitPerKeyword: LINKEDIN_LIMIT_PER_KEYWORD,
      fetchDetail: true,
      delaySeconds: 1.2,
      experienceLevel: '1',
      jobType: 'I',
    });
    summary.internshipLinkedin = internship;
    if (internship.payloads.length > 0) {
      allPayloads.push(...internship.payloads);
    }
  }

  const linkedinCount = summary.linkedin?.payloads.length ?? 0;
  const shouldFetchFillers =
    locationPolicy.includeRemoteSources &&
    (keywordsToFetch.length === 0 ||
      linkedinCount < LINKEDIN_MIN_RESULTS_BEFORE_FILLERS ||
      summary.linkedin?.status === 'BLOCKED' ||
      summary.linkedin?.status === 'FAILED');

  if (shouldFetchFillers) {
    const [himalayas, jobicy, remotive] = await Promise.all([
      fetchHimalayasPublicApi({ limit: FILLER_LIMIT }),
      fetchJobicyPublicApi({ limit: FILLER_LIMIT }),
      fetchRemotivePublicApi({ limit: FILLER_LIMIT }),
    ]);
    summary.fillers = [himalayas, jobicy, remotive];
    for (const result of summary.fillers) {
      if (result.payloads.length > 0) {
        allPayloads.push(...result.payloads);
      }
    }
  }

  const uniquePayloads = dedupePayloads(allPayloads);
  const skillRows = await loadSkillCatalog(admin).catch(() => []);
  const skillIndex = new Map<string, string>();
  for (const row of skillRows) {
    for (const candidate of [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
      const key = normalizeCatalogText(candidate);
      if (key && !skillIndex.has(key)) skillIndex.set(key, row.name);
    }
  }
  if (skillIndex.size > 0) {
    for (const payload of uniquePayloads) {
      payload.job.skills = canonicalizeCatalogValues(payload.job.skills, skillIndex).values;
    }
  }
  await enrichMissingCompanyLogos(uniquePayloads);
  for (const payload of uniquePayloads) {
    try {
      await ingestPayload(admin, payload);
      summary.ingested += 1;
      summary.by_source[payload.source.name] = (summary.by_source[payload.source.name] ?? 0) + 1;
    } catch {
      summary.ingest_errors += 1;
    }
  }

  return summary;
}

export type ProfileIngestTriggerResult = {
  started: boolean;
  reason: 'started' | 'already_running' | 'no_keywords' | 'failed';
  keywords: string[];
  summary: IngestRunSummary | null;
};

/**
 * Memicu ingest LinkedIn untuk lokasi dan posisi pada profil pengguna.
 * Kunci per pengguna mencegah dua permintaan menjalankan ingest bersamaan.
 */
export async function triggerProfileIngest(
  admin: SupabaseClient,
  userId: string,
): Promise<ProfileIngestTriggerResult> {
  let claimed: boolean;
  try {
    claimed = await claimProfileIngestTrigger(admin, userId);
  } catch {
    return { started: false, reason: 'already_running', keywords: [], summary: null };
  }
  if (!claimed) {
    return { started: false, reason: 'already_running', keywords: [], summary: null };
  }

  let keywords: string[] = [];
  let internshipKeywords: string[] = [];
  try {
    keywords = await collectUserKeywords(admin, userId);
    const preferences = await collectProfileIngestPreferences(admin, userId);
    internshipKeywords = preferences.wantsIntern
      ? buildInternshipSearchKeywords(preferences.positions)
      : [];
  } catch {
    return { started: false, reason: 'failed', keywords: [], summary: null };
  }
  if (keywords.length === 0 && internshipKeywords.length === 0) {
    return { started: false, reason: 'no_keywords', keywords: [], summary: null };
  }

  try {
    const summary = await runKeywordIngest(admin, keywords, {
      respectThrottle: false,
      userId,
      internshipKeywords,
    });
    return { started: true, reason: 'started', keywords, summary };
  } catch {
    return { started: false, reason: 'failed', keywords, summary: null };
  }
}
