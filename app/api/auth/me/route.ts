import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { ok, run } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('profiles')
      .select('user_id, updated_at')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throwDb(error);
    return ok({
      user: { id: auth.user.id, email: auth.user.email ?? null },
      auth_mode: auth.mode,
      has_profile: Boolean(data),
    });
  });
}
