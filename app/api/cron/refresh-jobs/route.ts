import { NextResponse, type NextRequest } from 'next/server';
import { readSupabaseAdminEnv } from '@/lib/env';
import { collectAllUserKeywords, runKeywordIngest } from '@/lib/ingest';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization')?.trim();
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get('x-cron-secret')?.trim();
  if (headerSecret && headerSecret === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Kredensial cron tidak valid.' } },
      { status: 401 },
    );
  }

  const env = readSupabaseAdminEnv();
  if (!env) {
    return NextResponse.json(
      { error: { code: 'service_unavailable', message: 'Layanan belum dikonfigurasi.' } },
      { status: 503 },
    );
  }

  try {
    const admin = createAdminClient(env);
    const keywords = await collectAllUserKeywords(admin);
    if (keywords.length === 0) {
      return NextResponse.json({ data: { ok: true, keywords: 0, ingested: 0, by_source: {} } });
    }
    const summary = await runKeywordIngest(admin, keywords, { respectThrottle: true });
    return NextResponse.json({
      data: {
        ok: true,
        keywords: keywords.length,
        keywords_fetched: summary.keywords_fetched.length,
        ingested: summary.ingested,
        ingest_errors: summary.ingest_errors,
        by_source: summary.by_source,
        linkedin_status: summary.linkedin?.status ?? null,
        linkedin_count: summary.linkedin?.payloads.length ?? 0,
        linkedin_reason: summary.linkedin?.reason ?? null,
        fillers: summary.fillers.map((f) => ({
          source: f.source_name,
          status: f.status,
          count: f.payloads.length,
          reason: f.reason,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'internal_error',
          message: error instanceof Error ? error.message : 'Terjadi kesalahan internal.',
        },
      },
      { status: 500 },
    );
  }
}
