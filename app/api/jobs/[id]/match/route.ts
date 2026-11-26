import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ApiError, ok, run } from '@/lib/http';
import { evaluateSingleJobMatch } from '@/lib/job-match';
import type {
  RecommendationJobInput,
  RecommendationProfileInput,
} from '@/lib/recommendation-contract';
import { uuidValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const PROFILE_COLUMNS = 'skills, education, experiences, projects, preferences';
const JOB_COLUMNS =
  'id, title, company, location, work_mode, employment_type, level, education, skills, status, deadline, description';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { id } = await context.params;
    const jobId = uuidValue(id, 'id');

    const [profileResult, jobResult] = await Promise.all([
      auth.supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('user_id', auth.user.id)
        .maybeSingle(),
      auth.supabase.from('jobs').select(JOB_COLUMNS).eq('id', jobId).maybeSingle(),
    ]);

    if (profileResult.error) throwDb(profileResult.error);
    if (jobResult.error) throwDb(jobResult.error);
    if (!jobResult.data) {
      throw new ApiError(404, 'job_not_found', 'Lowongan tidak ditemukan.');
    }

    const match = evaluateSingleJobMatch(
      (profileResult.data as RecommendationProfileInput | null) ?? null,
      jobResult.data as RecommendationJobInput,
    );

    return ok(match);
  });
}
