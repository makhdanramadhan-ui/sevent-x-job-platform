import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ApiError, ok, run } from '@/lib/http';
import { uuidValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { id } = await context.params;
    const jobId = uuidValue(id, 'id');
    const { data, error } = await auth.supabase
      .from('jobs')
      .select('*, job_sources(*)')
      .eq('id', jobId)
      .order('fetched_at', { referencedTable: 'job_sources', ascending: false })
      .maybeSingle();
    if (error) throwDb(error);
    if (!data) throw new ApiError(404, 'job_not_found', 'Lowongan tidak ditemukan.');
    return ok(data);
  });
}
