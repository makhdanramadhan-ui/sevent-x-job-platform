import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ApiError, asObject, ok, readJson, rejectUnknownKeys, run } from '@/lib/http';
import { uuidValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('bookmarks')
      .select('job_id, created_at, jobs(*)')
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });
    if (error) throwDb(error);
    return ok({ items: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const body = asObject(await readJson(req, 8 * 1024), 'body');
    rejectUnknownKeys(body, ['job_id'], 'body');
    const jobId = uuidValue(body.job_id, 'job_id');
    const { error } = await auth.supabase
      .from('bookmarks')
      .upsert(
        { user_id: auth.user.id, job_id: jobId },
        { onConflict: 'user_id,job_id', ignoreDuplicates: true },
      );
    if (error) {
      if (error.code === '23503') {
        throw new ApiError(404, 'job_not_found', 'Lowongan tidak ditemukan.');
      }
      throwDb(error);
    }
    return ok({ job_id: jobId, saved: true }, 201);
  });
}
