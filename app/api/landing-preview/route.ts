import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { readSupabaseAdminEnv, readSupabaseEnv } from '@/lib/env';
import { ok, run } from '@/lib/http';
import { rankJobs } from '@/lib/recommendation';
import type {
  RecommendationItem,
  RecommendationJobInput,
  RecommendationProfileInput,
} from '@/lib/recommendation-contract';
import { createAdminClient, createBearerClient, createCookieClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const JOB_COLUMNS =
  'id, title, company, company_logo_url, location, work_mode, employment_type, level, education, skills, status, deadline, last_fetched_at, updated_at';
const PROFILE_COLUMNS = 'skills, education, experiences, projects, preferences';
const SOURCE_COLUMNS = 'job_id, source_name, published_at, fetched_at';

type AuthState = 'guest' | 'without_profile' | 'ready';
type PreviewMode = 'recommendations' | 'recent';

type JobRow = {
  id: string;
  title: string;
  company: string;
  company_logo_url: string | null;
  location: string | null;
  work_mode: string;
  employment_type: string;
  level: string;
  education: string | null;
  skills: string[] | null;
  status: string;
  deadline: string | null;
  last_fetched_at: string | null;
  updated_at: string;
};

type SourceRow = {
  job_id: string;
  source_name: string | null;
  published_at: string | null;
  fetched_at: string | null;
};

type PreviewJob = Omit<JobRow, 'skills' | 'education'> & {
  source_name: string | null;
  source_published_at: string | null;
  source_fetched_at: string | null;
  matched?: string[];
  missing?: string[];
};

async function optionalAuth(req: NextRequest) {
  const env = readSupabaseEnv();
  if (!env) return null;

  const authorization = req.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    const token = match?.[1] ?? '';
    if (token.length < 10 || token.length > 8192) return null;
    const supabase = createBearerClient(env, token);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { user: data.user };
  }

  const store = await cookies();
  const hasSessionCookie = store
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
  if (!hasSessionCookie) return null;

  const supabase = await createCookieClient(env);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { user: data.user };
}

function hasBidangOrSkills(profile: RecommendationProfileInput): boolean {
  const skills = Array.isArray(profile?.skills) ? profile.skills : [];
  const positions = Array.isArray(profile?.preferences?.positions)
    ? profile.preferences.positions
    : [];
  return (
    skills.some((skill) => typeof skill === 'string' && skill.trim().length > 0) ||
    positions.some((position) => typeof position === 'string' && position.trim().length > 0)
  );
}

function emptyPayload(reason?: string) {
  return {
    mode: 'recent' as PreviewMode,
    auth_state: 'guest' as AuthState,
    count: 0,
    total_jobs: 0,
    source_count: 0,
    updated_at: null,
    jobs: [] as PreviewJob[],
    ...(reason ? { reason } : {}),
  };
}

function toPreviewJob(job: JobRow, source: SourceRow | undefined): PreviewJob {
  const { skills: _skills, education: _education, ...rest } = job;
  return {
    ...rest,
    source_name: source?.source_name ?? null,
    source_published_at: source?.published_at ?? null,
    source_fetched_at: source?.fetched_at ?? null,
  };
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const adminEnv = readSupabaseAdminEnv();
    if (!adminEnv) return ok(emptyPayload('service_unavailable'));

    const admin = createAdminClient(adminEnv);
    const auth = await optionalAuth(req);
    let mode: PreviewMode = 'recent';
    let authState: AuthState = auth ? 'without_profile' : 'guest';
    let rankedItems: RecommendationItem[] = [];
    let profile: RecommendationProfileInput = null;

    if (auth) {
      const profileResult = await admin
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', auth.user.id)
        .maybeSingle();
      if (!profileResult.error && hasBidangOrSkills(profileResult.data as RecommendationProfileInput)) {
        profile = (profileResult.data as RecommendationProfileInput) ?? null;
        mode = 'recommendations';
        authState = 'ready';
      }
    }

    const jobsResult = await admin
      .from('jobs')
      .select(JOB_COLUMNS)
      .order('last_fetched_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(mode === 'recommendations' ? 50 : 3);
    if (jobsResult.error) return ok(emptyPayload('data_unavailable'));

    const jobs = (jobsResult.data ?? []) as JobRow[];
    if (mode === 'recommendations' && profile) {
      rankedItems = rankJobs({
        profile,
        jobs: jobs as RecommendationJobInput[],
      }).items;
    }

    const selectedJobs =
      mode === 'recommendations'
        ? rankedItems
            .map((item) => jobs.find((job) => job.id === item.job_id))
            .filter((job): job is JobRow => Boolean(job))
            .slice(0, 3)
        : jobs.slice(0, 3);

    const [countResult, sourceResult] = await Promise.all([
      admin.from('jobs').select('id', { count: 'exact', head: true }),
      admin.from('job_sources').select('source_name'),
    ]);

    const ids = selectedJobs.map((job) => job.id);
    const selectedSourcesResult = ids.length
      ? await admin
          .from('job_sources')
          .select(SOURCE_COLUMNS)
          .in('job_id', ids)
          .order('fetched_at', { ascending: false, nullsFirst: false })
      : null;

    const sourcesByJob = new Map<string, SourceRow>();
    for (const source of (selectedSourcesResult?.data ?? []) as SourceRow[]) {
      if (!sourcesByJob.has(source.job_id)) sourcesByJob.set(source.job_id, source);
    }

    const rankedByJob = new Map(rankedItems.map((item) => [item.job_id, item]));
    const previewJobs = selectedJobs.map((job) => {
      const base = toPreviewJob(job, sourcesByJob.get(job.id));
      const ranked = rankedByJob.get(job.id);
      return ranked ? { ...base, matched: ranked.matched, missing: ranked.missing } : base;
    });

    const sourceNames = new Set(
      ((sourceResult.data ?? []) as Array<{ source_name: string | null }>)
        .map((row) => row.source_name)
        .filter((name): name is string => Boolean(name)),
    );
    const latest = jobs[0]?.last_fetched_at ?? jobs[0]?.updated_at ?? null;

    return ok({
      mode,
      auth_state: authState,
      count: mode === 'recommendations' ? rankedItems.length : previewJobs.length,
      total_jobs: countResult.count ?? 0,
      source_count: sourceNames.size,
      updated_at: latest,
      jobs: previewJobs,
    });
  });
}
