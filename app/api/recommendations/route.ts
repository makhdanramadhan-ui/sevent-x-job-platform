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
import type {
  RecommendationFilters,
  RecommendationJobInput,
  RecommendationProfileInput,
} from '@/lib/recommendation-contract';
import { assertAllowedQuery, intValue, oneOf } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const PROFILE_RECOMMENDATION_COLUMNS = 'skills, education, experiences, projects, preferences';
const JOB_RECOMMENDATION_COLUMNS =
  'id, title, company, location, work_mode, employment_type, level, education, skills, status, deadline';

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

    const [profileResult, jobsResult] = await Promise.all([
      auth.supabase
        .from('profiles')
        .select(PROFILE_RECOMMENDATION_COLUMNS)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
      auth.supabase
        .from('jobs')
        .select(JOB_RECOMMENDATION_COLUMNS)
        .order('last_fetched_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .limit(50),
    ]);

    if (profileResult.error) throwDb(profileResult.error);
    if (jobsResult.error) throwDb(jobsResult.error);

    const profile = (profileResult.data as RecommendationProfileInput) ?? null;
    const jobs = ((jobsResult.data as RecommendationJobInput[] | null) ?? []);

    const ranked = rankJobs({ profile, jobs }, { filters });

    return ok({
      contract_version: ranked.contract_version,
      items: ranked.items.slice(0, limit),
    });
  });
}
