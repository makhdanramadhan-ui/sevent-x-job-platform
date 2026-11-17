import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ok, readJson, run } from '@/lib/http';
import { parseProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

const PROFILE_COLUMNS =
  'user_id, full_name, headline, phone, location, links, skills, education, experiences, projects, organizations, achievements, preferences, created_at, updated_at';

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throwDb(error);
    return ok(data);
  });
}

export async function PUT(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const input = parseProfile(await readJson(req, 64 * 1024));
    const { data, error } = await auth.supabase
      .from('profiles')
      .upsert({ user_id: auth.user.id, ...input }, { onConflict: 'user_id' })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throwDb(error);
    return ok(data);
  });
}

export async function DELETE(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase.rpc('delete_my_data');
    if (error) throwDb(error);
    return ok({ cleared: data, auth_account_deleted: false });
  });
}
