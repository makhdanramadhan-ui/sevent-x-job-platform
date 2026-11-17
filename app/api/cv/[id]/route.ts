import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ApiError, ok, readJson, run } from '@/lib/http';
import { parseCvUpdate } from '@/lib/profile';
import { uuidValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const CV_COLUMNS = 'id, title, template_version, content, created_at, updated_at';

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { id } = await context.params;
    const documentId = uuidValue(id, 'id');
    const { data, error } = await auth.supabase
      .from('cv_documents')
      .select(CV_COLUMNS)
      .eq('id', documentId)
      .maybeSingle();
    if (error) throwDb(error);
    if (!data) throw new ApiError(404, 'not_found', 'Dokumen CV tidak ditemukan.');
    return ok(data);
  });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { id } = await context.params;
    const documentId = uuidValue(id, 'id');
    const patch = parseCvUpdate(await readJson(req, 160 * 1024));
    const { data, error } = await auth.supabase
      .from('cv_documents')
      .update(patch)
      .eq('id', documentId)
      .select(CV_COLUMNS)
      .maybeSingle();
    if (error) throwDb(error);
    if (!data) throw new ApiError(404, 'not_found', 'Dokumen CV tidak ditemukan.');
    return ok(data);
  });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { id } = await context.params;
    const documentId = uuidValue(id, 'id');
    const { data, error } = await auth.supabase
      .from('cv_documents')
      .delete()
      .eq('id', documentId)
      .select('id')
      .maybeSingle();
    if (error) throwDb(error);
    if (!data) throw new ApiError(404, 'not_found', 'Dokumen CV tidak ditemukan.');
    return ok({ id: documentId, deleted: true });
  });
}
