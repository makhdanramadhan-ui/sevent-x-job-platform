import type { NextRequest } from 'next/server';
import { resolveAvatar } from '@/lib/avatar';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ok, run } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('profiles')
      .select('user_id, full_name, updated_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throwDb(error);

    const meta = (auth.user.user_metadata ?? {}) as Record<string, unknown>;
    const profileRaw = data?.full_name;
    const metaRaw = meta.full_name ?? meta.name;
    const profileName = typeof profileRaw === 'string' ? profileRaw.trim() : '';
    const metaName = typeof metaRaw === 'string' ? metaRaw.trim() : '';
    const name = profileName || metaName || auth.user.email || null;
    const { avatar_url, avatar_source } = resolveAvatar(readSupabaseAdminEnv(), auth.user);

    return ok({
      user: { id: auth.user.id, email: auth.user.email ?? null, name, avatar_url, avatar_source },
      auth_mode: auth.mode,
      has_profile: Boolean(data),
    });
  });
}
