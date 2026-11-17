import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { JOB_STATUSES, EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_MODES } from '@/lib/contracts';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';
import {
  assertAllowedQuery,
  intValue,
  oneOf,
  searchTerm,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

const JOB_COLUMNS =
  'id, title, company, location, work_mode, employment_type, level, education, skills, description, deadline, status, first_seen_at, last_seen_at, last_fetched_at, updated_at';

const QUERY_KEYS = [
  'page',
  'limit',
  'q',
  'location',
  'work_mode',
  'employment_type',
  'level',
  'status',
] as const;

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
    const { data, error, count } = await query
      .order('last_fetched_at', { ascending: false, nullsFirst: false })
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
    });
  });
}
