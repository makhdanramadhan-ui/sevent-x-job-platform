import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ok, run } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    await auth.supabase.auth.signOut().catch(() => undefined);
    const response = ok({ signed_out: true });
    for (const cookie of req.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) response.cookies.delete(cookie.name);
    }
    return response;
  });
}
