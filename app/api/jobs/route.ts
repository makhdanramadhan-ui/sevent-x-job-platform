import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_MODES } from '@/lib/contracts';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';
import { extractProfileKeywords } from '@/lib/profile-keywords';
import { rankJobs } from '@/lib/recommendation';
import { buildEmptyHint } from '@/lib/recommendation/empty-hint';
import { filterEligibleJobs } from '@/lib/recommendation/job-context';
import { asLocationPreference, isProfileLocationReady } from '@/lib/recommendation/location-filter';
import { filterRelevantJobs } from '@/lib/recommendation/relevance';
import type { RecommendationProfileInput } from '@/lib/recommendation-contract';
import {
  assertAllowedQuery,
  intValue,
  oneOf,
  searchTerm,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const JOB_COLUMNS =
  'id, title, company, company_logo_url, location, work_mode, employment_type, level, education, skills, description, deadline, status, first_seen_at, last_seen_at, last_fetched_at, updated_at';
const PROFILE_COLUMNS = 'skills, preferences, updated_at';

const QUERY_KEYS = [
  'page',
  'limit',
  'q',
  'location',
  'work_mode',
  'employment_type',
  'level',
  'status',
  'sort',
] as const;

const SORT_OPTIONS = ['relevance', 'newest'] as const;

function hasExplicitSearch(params: URLSearchParams): boolean {
  for (const key of QUERY_KEYS) {
    if (key === 'page' || key === 'limit' || key === 'sort') continue;
    const value = params.get(key);
    if (value !== null && value.trim().length > 0) return true;
  }
  return false;
}

function jobTimestampMs(job: {
  last_fetched_at?: string | null;
  first_seen_at?: string | null;
  updated_at?: string | null;
}): number {
  const raw = job.last_fetched_at ?? job.first_seen_at ?? job.updated_at;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function keywordRelevanceScore(
  job: { title?: string | null; company?: string | null },
  q: string | null,
): number {
  if (!q) return 0;
  const needle = q.trim().toLowerCase();
  if (!needle) return 0;
  const title = (job.title ?? '').toLowerCase();
  const company = (job.company ?? '').toLowerCase();
  let score = 0;
  if (title === needle) score += 100;
  else if (title.startsWith(needle)) score += 60;
  else if (title.includes(needle)) score += 30;
  if (company.includes(needle)) score += 15;
  return score;
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const params = new URL(req.url).searchParams;
    assertAllowedQuery(params, QUERY_KEYS);

    const page = intValue(params.get('page'), 'page', 1, 1000, 1);
    const limit = intValue(params.get('limit'), 'limit', 1, 50, 20);
    const q = searchTerm(params.get('q'), 'q', 100);
    const location = searchTerm(params.get('location'), 'location', 100);
    const workMode = params.get('work_mode');
    const employmentType = params.get('employment_type');
    const level = params.get('level');
    const status = params.get('status');
    const rawSort = params.get('sort');
    const sort = rawSort ? oneOf(rawSort, 'sort', SORT_OPTIONS) : 'newest';

    const explicit = hasExplicitSearch(params);

    if (!explicit && sort === 'relevance') {
      const { data: profile, error: profileError } = await auth.supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (profileError) throwDb(profileError);

      const preferenceRow = (profile ?? {}) as { preferences?: Record<string, unknown> };
      const keywordState = extractProfileKeywords(profile as any);
      if (keywordState.isEmpty || !isProfileLocationReady(preferenceRow.preferences)) {
        return ok({
          items: [],
          total: 0,
          page,
          limit,
          pages: 0,
          profile_state: 'empty',
          reason: 'profile_incomplete',
        });
      }

      const { data: jobs, error: jobsError } = await auth.supabase
        .from('jobs')
        .select(JOB_COLUMNS)
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(500);
      if (jobsError) throwDb(jobsError);

      const relevance = filterRelevantJobs(jobs ?? [], profile as RecommendationProfileInput);
      const selection = filterEligibleJobs(relevance.relevant, preferenceRow.preferences);
      const ranked = rankJobs(
        { profile: profile as RecommendationProfileInput, jobs: selection.eligible },
        { locationTiers: selection.tiers, nearbyLabels: selection.nearbyLabels },
      );
      const scoreById = new Map(ranked.items.map((item) => [item.job_id, item.score]));
      const jobById = new Map(selection.eligible.map((job) => [job.id, job]));
      const ordered = ranked.items
        .map((item) => jobById.get(item.job_id))
        .filter((job): job is NonNullable<typeof job> => Boolean(job));
      const total = ordered.length;
      const from = (page - 1) * limit;
      const items = ordered.slice(from, from + limit).map((job) => ({
        ...job,
        match_score: scoreById.get(job.id) ?? 0,
        location_note: selection.nearbyLabels.get(job.id) ?? null,
      }));
      const pages = total === 0 ? 0 : Math.ceil(total / limit);

      let profileState: 'ready' | 'ingest_pending' = 'ready';
      if (total === 0) {
        const updatedAtRaw =
          profile && typeof profile === 'object' && 'updated_at' in profile
            ? profile.updated_at
            : null;
        const updatedAt = typeof updatedAtRaw === 'string' ? Date.parse(updatedAtRaw) : NaN;
        if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 15 * 60 * 1000) {
          profileState = 'ingest_pending';
        }

      }

      const prefRecord = preferenceRow.preferences ?? {};
      const rawPositions = prefRecord.positions;
      const positions = Array.isArray(rawPositions)
        ? rawPositions.filter((item): item is string => typeof item === 'string')
        : [];
      const emptyHint =
        total === 0
          ? buildEmptyHint({
              totalCandidates: jobs?.length ?? 0,
              keywordMatches: relevance.relevant.length,
              diagnostics: selection.diagnostics,
              locations: asLocationPreference(prefRecord)?.locations ?? [],
              positions,
              ingestPending: profileState === 'ingest_pending',
            })
          : null;

      return ok({
        items,
        total,
        page,
        limit,
        pages,
        sort,
        profile_state: profileState,
        location_diagnostics: selection.diagnostics,
        location_counts: selection.locationCounts,
        location_notes: Object.fromEntries(selection.nearbyLabels),
        relevance_diagnostics: relevance.diagnostics,
        empty_hint: emptyHint,
      });
    }

    let query = auth.supabase.from('jobs').select(JOB_COLUMNS, { count: 'exact' });
    if (q) query = query.or(`title.ilike.%${q}%,company.ilike.%${q}%`);
    if (location) query = query.ilike('location', `%${location}%`);
    if (workMode) query = query.eq('work_mode', oneOf(workMode, 'work_mode', WORK_MODES));
    if (employmentType) {
      query = query.eq(
        'employment_type',
        oneOf(employmentType, 'employment_type', EMPLOYMENT_TYPES),
      );
    }
    if (level) query = query.eq('level', oneOf(level, 'level', EXPERIENCE_LEVELS));
    if (status) query = query.eq('status', oneOf(status, 'status', JOB_STATUSES));

    const from = (page - 1) * limit;
    if (sort === 'newest' || from >= 200) {
      const { data, error, count } = await query
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .order('first_seen_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, from + limit - 1);
      if (error) throwDb(error);

      const total = count ?? 0;
      return ok({
        items: data ?? [],
        total,
        page,
        limit,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
        sort,
        profile_state: explicit ? 'explicit_search' : 'all_newest',
      });
    }

    const [{ data, error, count }, profileRes] = await Promise.all([
      query
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(0, 199),
      auth.supabase
        .from('profiles')
        .select('skills, preferences')
        .eq('user_id', auth.user.id)
        .maybeSingle(),
    ]);
    if (error) throwDb(error);

    const candidates = (data ?? []) as Array<Record<string, any>>;
    const profileScoreById = new Map<string, number>();
    if (!profileRes.error && profileRes.data) {
      const keywordState = extractProfileKeywords(profileRes.data as any);
      if (!keywordState.isEmpty) {
        const ranked = rankJobs({
          profile: profileRes.data as RecommendationProfileInput,
          jobs: candidates as any,
        });
        for (const item of ranked.items) {
          profileScoreById.set(item.job_id, item.score);
        }
      }
    }

    const sortedCandidates = [...candidates].sort((a, b) => {
      const aScore = keywordRelevanceScore(a, q) + (profileScoreById.get(a.id) ?? 0);
      const bScore = keywordRelevanceScore(b, q) + (profileScoreById.get(b.id) ?? 0);
      if (bScore !== aScore) return bScore - aScore;
      const timeDiff = jobTimestampMs(b) - jobTimestampMs(a);
      if (timeDiff !== 0) return timeDiff;
      return String(a.id).localeCompare(String(b.id));
    });

    const total = count ?? sortedCandidates.length;
    return ok({
      items: sortedCandidates.slice(from, from + limit),
      total,
      page,
      limit,
      pages: total === 0 ? 0 : Math.ceil(total / limit),
      sort,
      profile_state: 'explicit_search',
    });
  });
}
