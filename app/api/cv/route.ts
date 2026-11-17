import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ok, readJson, run } from '@/lib/http';
import { parseCvCreate } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const CV_COLUMNS = 'id, title, template_version, content, created_at, updated_at';

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('cv_documents')
      .select('id, title, template_version, created_at, updated_at')
      .eq('user_id', auth.user.id)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) throwDb(error);
    return ok({ items: data ?? [] });
  });
}

export async function POST(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const input = parseCvCreate(await readJson(req, 160 * 1024));
    const { data, error } = await auth.supabase
      .from('cv_documents')
      .insert({ user_id: auth.user.id, ...input })
      .select(CV_COLUMNS)
      .single();
    if (error) throwDb(error);
    return ok(data, 201);
  });
}
