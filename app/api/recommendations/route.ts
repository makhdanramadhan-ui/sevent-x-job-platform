import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
  type EmploymentType,
  type ExperienceLevel,
  type WorkMode,
} from '@/lib/contracts';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';
import { rankJobs } from '@/lib/recommendation';
import { buildEmptyHint } from '@/lib/recommendation/empty-hint';
import { attachJobContext, filterEligibleJobs, type JobSourceRow } from '@/lib/recommendation/job-context';
import { filterRelevantJobs } from '@/lib/recommendation/relevance';
import { asLocationPreference } from '@/lib/recommendation/location-filter';
import { isProfileRecommendationReady } from '@/lib/recommendation/profile-readiness';
import type {
  RecommendationFilters,
  RecommendationJobInputWithContext,
  RecommendationProfileInput,
} from '@/lib/recommendation-contract';
import { assertAllowedQuery, intValue, oneOf } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const PROFILE_RECOMMENDATION_COLUMNS = 'skills, education, experiences, projects, preferences, updated_at';
const JOB_RECOMMENDATION_COLUMNS =
  'id, title, company, company_logo_url, location, work_mode, employment_type, level, education, skills, status, deadline, last_fetched_at, description';

const QUERY_KEYS = ['limit', 'work_mode', 'employment_type', 'level'] as const;

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const params = new URL(req.url).searchParams;
    assertAllowedQuery(params, QUERY_KEYS);

    const limit = intValue(params.get('limit'), 'limit', 1, 50, 50);
    const workModeParam = params.get('work_mode');
    const employmentTypeParam = params.get('employment_type');
    const levelParam = params.get('level');

    const filters: RecommendationFilters = {
      work_modes: workModeParam
        ? [oneOf(workModeParam, 'work_mode', WORK_MODES) as WorkMode]
        : [],
      employment_types: employmentTypeParam
        ? [oneOf(employmentTypeParam, 'employment_type', EMPLOYMENT_TYPES) as EmploymentType]
        : [],
      levels: levelParam
        ? [oneOf(levelParam, 'level', EXPERIENCE_LEVELS) as ExperienceLevel]
        : [],
    };

    const profileResult = await auth.supabase
      .from('profiles')
      .select(PROFILE_RECOMMENDATION_COLUMNS)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (profileResult.error) throwDb(profileResult.error);

    const profile = (profileResult.data as RecommendationProfileInput) ?? null;

    if (!isProfileRecommendationReady(profile)) {
      return ok({
        contract_version: 1,
        items: [],
        reason: 'profile_incomplete',
        profile_state: 'empty',
      });
    }

    const jobsResult = await auth.supabase
      .from('jobs')
      .select(JOB_RECOMMENDATION_COLUMNS)
      .order('last_fetched_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(500);
    if (jobsResult.error) throwDb(jobsResult.error);

    const allJobs = (jobsResult.data as RecommendationJobInputWithContext[] | null) ?? [];
    const relevance = filterRelevantJobs(allJobs, profile);
    const selection = filterEligibleJobs(relevance.relevant, profile?.preferences);
    const eligible = selection.eligible;
    const diagnostics = selection.diagnostics;
    const relevanceDiagnostics = relevance.diagnostics;
    const ranked = rankJobs({ profile, jobs: eligible }, {
      filters,
      locationTiers: selection.tiers,
      nearbyLabels: selection.nearbyLabels,
    });
    const topItems = ranked.items.slice(0, limit);
    const topIds = topItems.map((item) => item.job_id);
    const cardsById = new Map(eligible.map((job) => [job.id, job]));
    const jobCards = topIds
      .map((id) => cardsById.get(id))
      .filter((job): job is RecommendationJobInputWithContext => Boolean(job))
      .map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        company_logo_url: job.company_logo_url ?? null,
        location: job.location,
        work_mode: job.work_mode,
        employment_type: job.employment_type,
        level: job.level,
        status: job.status,
        last_fetched_at: job.last_fetched_at ?? null,
      }));

    let sourceRows: JobSourceRow[] = [];
    if (topIds.length > 0) {
      const sourceResult = await auth.supabase
        .from('job_sources')
        .select('job_id, source_name, source_url, fetched_at')
        .in('job_id', topIds);
      if (sourceResult.error) throwDb(sourceResult.error);
      sourceRows = (sourceResult.data ?? []) as JobSourceRow[];
    }

    const items = await attachJobContext(auth.supabase, topItems, sourceRows, jobCards);

    let profileState: 'ready' | 'ingest_pending' = 'ready';
    if (topItems.length === 0) {
      const updatedAtRaw =
        profile && typeof profile === 'object' && 'updated_at' in profile
          ? profile.updated_at
          : null;
      const updatedAt = typeof updatedAtRaw === 'string' ? Date.parse(updatedAtRaw) : NaN;
      if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 15 * 60 * 1000) {
        profileState = 'ingest_pending';
      }

    }

    const prefRecord = profile?.preferences ?? null;
    const emptyHint =
      topItems.length === 0
        ? buildEmptyHint({
            totalCandidates: allJobs.length,
            diagnostics,
            locations: asLocationPreference(prefRecord)?.locations ?? [],
            positions: Array.isArray(prefRecord?.positions) ? prefRecord.positions : [],
            ingestPending: profileState === 'ingest_pending',
          })
        : null;

    const response = ok({
      contract_version: ranked.contract_version,
      items,
      profile_state: profileState,
      location_diagnostics: diagnostics,
      location_counts: selection.locationCounts,
      location_notes: Object.fromEntries(selection.nearbyLabels),
      empty_hint: emptyHint,
      relevance_diagnostics: relevanceDiagnostics,
    });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  });
}
