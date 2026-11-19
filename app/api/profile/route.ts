import type { NextRequest } from 'next/server';
import { readAvatarPath, removeAllUserAvatarObjects, setAvatarPath } from '@/lib/avatar';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ok, readJson, run } from '@/lib/http';
import { parseProfile } from '@/lib/profile';
import { canonicalizeSkillNames, tryLoadSkillCatalog } from '@/lib/skills';

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
    const catalog = await tryLoadSkillCatalog(auth.supabase);
    const canonical = canonicalizeSkillNames(input.skills, catalog);
    const { data, error } = await auth.supabase
      .from('profiles')
      .upsert({ user_id: auth.user.id, ...input, skills: canonical }, { onConflict: 'user_id' })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throwDb(error);
    return ok(data);
  });
}

export async function DELETE(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const adminEnv = readSupabaseAdminEnv();
    if (adminEnv) {
      await removeAllUserAvatarObjects(adminEnv, auth.user.id);
      if (readAvatarPath(auth.user)) {
        const appMeta = (auth.user.app_metadata ?? {}) as Record<string, unknown>;
        await setAvatarPath(adminEnv, auth.user.id, appMeta, null);
      }
    }
    const { data, error } = await auth.supabase.rpc('delete_my_data');
    if (error) throwDb(error);
    return ok({ cleared: data, auth_account_deleted: false });
  });
}
