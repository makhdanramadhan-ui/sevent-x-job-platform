import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';
import { uuidValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { jobId: rawJobId } = await context.params;
    const jobId = uuidValue(rawJobId, 'jobId');
    const { data, error } = await auth.supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', auth.user.id)
      .eq('job_id', jobId)
      .select('job_id')
      .maybeSingle();
    if (error) throwDb(error);
    return ok({ job_id: jobId, deleted: Boolean(data) });
  });
}
