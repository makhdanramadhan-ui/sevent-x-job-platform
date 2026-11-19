import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url =
    'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=backend+developer&location=Indonesia&start=0';
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      cache: 'no-store',
    });
    const body = await resp.text();
    return NextResponse.json({
      ok: resp.ok,
      status: resp.status,
      final_url: resp.url,
      length: body.length,
      has_job: body.includes('urn:li:jobPosting:'),
      has_authwall: resp.url.toLowerCase().includes('authwall') || body.slice(0, 500).toLowerCase().includes('authwall'),
      has_captcha: body.toLowerCase().includes('g-recaptcha') || body.toLowerCase().includes('security verification'),
      snippet: body.slice(0, 180).replace(/\s+/g, ' '),
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
