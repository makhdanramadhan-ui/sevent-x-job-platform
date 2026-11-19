import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { ApiError, handleError } from '@/lib/http';
import { assertAllowedQuery, intValue } from '@/lib/validation';
import { createPublicSkillClient, loadSkillCatalog, rankSkillSuggestions } from '@/lib/skills';

export const dynamic = 'force-dynamic';

const QUERY_KEYS = ['q', 'limit'] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = new URL(req.url).searchParams;
    assertAllowedQuery(params, QUERY_KEYS);

    const rawQ = params.get('q');
    if (rawQ === null) {
      throw new ApiError(400, 'validation_error', 'Parameter q wajib diisi.', { field: 'q' });
    }
    const q = rawQ.trim();
    if (q.length < 1 || q.length > 50) {
      throw new ApiError(400, 'validation_error', 'Parameter q harus memiliki 1-50 karakter.', {
        field: 'q',
      });
    }

    const limit = intValue(params.get('limit'), 'limit', 1, 20, 10);
    const client = createPublicSkillClient();
    const rows = await loadSkillCatalog(client);
    const data = rankSkillSuggestions(rows, q, limit);

    return NextResponse.json(
      { data },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      },
    );
  } catch (error) {
    return handleError(error);
  }
}
