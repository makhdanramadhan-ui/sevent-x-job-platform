import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';

export const dynamic = 'force-dynamic';

function readHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('profiles')
      .select('user_id, updated_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throwDb(error);

    const meta = (auth.user.user_metadata ?? {}) as Record<string, unknown>;
    const nameRaw = meta.full_name ?? meta.name;
    const name = typeof nameRaw === 'string' && nameRaw.trim() ? nameRaw.trim() : null;
    const avatar_url = readHttpsUrl(meta.avatar_url ?? meta.picture);

    return ok({
      user: { id: auth.user.id, email: auth.user.email ?? null, name, avatar_url },
      auth_mode: auth.mode,
      has_profile: Boolean(data),
    });
  });
}
