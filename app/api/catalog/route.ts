import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { findCountry, searchCountries } from '@/lib/countries';
import { ApiError, handleError } from '@/lib/http';
import { searchLocations } from '@/lib/locations';
import { searchPositions } from '@/lib/positions';
import { assertAllowedQuery, intValue } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const QUERY_KEYS = ['type', 'q', 'limit', 'country'] as const;
const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = new URL(req.url).searchParams;
    assertAllowedQuery(params, QUERY_KEYS);

    const type = params.get('type');
    if (type !== 'positions' && type !== 'locations' && type !== 'countries') {
      throw new ApiError(400, 'validation_error', 'Parameter type tidak valid.', { field: 'type' });
    }

    const q = (params.get('q') ?? '').trim();
    if (q.length > 50) {
      throw new ApiError(400, 'validation_error', 'Parameter q maksimal 50 karakter.', {
        field: 'q',
      });
    }
    const limit = intValue(params.get('limit'), 'limit', 1, 20, 8);

    let country: string | undefined;
    const rawCountry = params.get('country');
    if (rawCountry !== null && rawCountry.trim().length > 0) {
      const match = findCountry(rawCountry.trim());
      if (!match) {
        throw new ApiError(400, 'validation_error', 'Negara tidak dikenal.', { field: 'country' });
      }
      country = match.code;
    }

    let data: Array<{ id: string; name: string; category: string }>;
    if (type === 'countries') {
      data =
        q.length === 0
          ? [{ id: 'ID', name: 'Indonesia', category: 'Negara' }]
          : searchCountries(q, limit).map(({ code, name }) => ({
              id: code,
              name,
              category: 'Negara',
            }));
    } else if (type === 'locations') {
      data = searchLocations(q, country).map(({ id, name, category }) => ({ id, name, category }));
    } else {
      data = searchPositions(q, limit);
    }

    return NextResponse.json({ data }, { status: 200, headers: CACHE_HEADERS });
  } catch (error) {
    return handleError(error);
  }
}
