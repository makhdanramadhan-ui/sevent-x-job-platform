import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIP(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIPv4(ip);
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice(7));
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower.startsWith('ff')
  );
}

/** Tolak URL non-HTTPS dan host yang mengarah ke jaringan internal (cegah SSRF). */
async function isSafeTarget(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:') return false;
  if (url.port && url.port !== '443') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return false;
  }
  if (isIP(host)) return !isPrivateIP(host);

  try {
    const records = await lookup(host, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateIP(r.address));
  } catch {
    return false;
  }
}

function notFound(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('url');
  if (!raw || raw.length > 2048) return new Response(null, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let upstream: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (!(await isSafeTarget(target))) return new Response(null, { status: 400 });

      const res = await fetch(target, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8' },
        cache: 'no-store',
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return notFound();
        target = new URL(location, target);
        continue;
      }
      upstream = res;
      break;
    }

    if (!upstream || !upstream.ok || !upstream.body) return notFound();

    const contentType = (upstream.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) return notFound();

    const declaredLength = Number(upstream.headers.get('content-length') ?? '0');
    if (declaredLength > MAX_BYTES) return notFound();

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return notFound();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        // Cache di browser 1 hari, di CDN Vercel 7 hari.
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        // SVG bisa berisi script; kunci agar tidak bisa dieksekusi bila dibuka langsung.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return notFound();
  } finally {
    clearTimeout(timer);
  }
}
