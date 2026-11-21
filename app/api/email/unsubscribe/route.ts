import { NextResponse, type NextRequest } from 'next/server';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import { readUnsubscribeSecret, verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { fail } from '@/lib/http';
import { createAdminClient } from '@/lib/supabase';
import { assertAllowedQuery } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function confirmationPage(): string {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Berhenti Berlangganan - RakitKarier</title>
  </head>
  <body style="margin:0;padding:32px 20px;background:#f5f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
    <main style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dde4ee;border-radius:12px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:22px;">Notifikasi email dinonaktifkan</h1>
      <p style="margin:0 0 18px;">Kamu tidak akan menerima email lowongan dengan kecocokan ≥70% lagi. Preferensi ini tersimpan pada akunmu.</p>
      <a href="/recommendations" style="display:inline-block;background:#2456d6;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">Lihat Rekomendasi</a>
    </main>
  </body>
</html>`;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  try {
    assertAllowedQuery(params, ['token']);
  } catch {
    return fail(400, 'validation_error', 'Tautan berhenti berlangganan tidak valid.');
  }

  const token = params.get('token') ?? '';
  const secret = readUnsubscribeSecret();
  const userId = secret ? verifyUnsubscribeToken(token, secret) : null;
  if (!userId) {
    return fail(400, 'invalid_token', 'Tautan berhenti berlangganan tidak valid.');
  }

  const env = readSupabaseAdminEnv();
  if (!env) {
    return fail(503, 'service_unavailable', 'Layanan belum dikonfigurasi.');
  }

  try {
    const admin = createAdminClient(env);
    const { data, error } = await admin
      .from('profiles')
      .select('preferences')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throwDb(error);

    const preferences =
      data?.preferences && typeof data.preferences === 'object'
        ? (data.preferences as Record<string, unknown>)
        : {};
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        preferences: { ...preferences, email_match_alerts: false },
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (updateError) throwDb(updateError);

    return new NextResponse(confirmationPage(), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return fail(500, 'internal_error', 'Terjadi kesalahan internal.');
  }
}
