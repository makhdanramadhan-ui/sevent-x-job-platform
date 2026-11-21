import { createHmac, timingSafeEqual } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_VERSION = '1';
const SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;

export function readUnsubscribeSecret(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | null {
  return env.EMAIL_UNSUBSCRIBE_SECRET?.trim() || null;
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function signUnsubscribeToken(userId: string, secret: string): string {
  if (!secret) throw new Error('missing_unsubscribe_secret');
  if (!UUID_PATTERN.test(userId)) throw new Error('invalid_user_id');

  const payload = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, sub: userId, iat: Date.now() }),
    'utf8',
  ).toString('base64url');

  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!SEGMENT_PATTERN.test(payload) || !SEGMENT_PATTERN.test(signature)) return null;

  const expected = signPayload(payload, secret);
  const receivedBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expected, 'base64url');
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!decoded || typeof decoded !== 'object') return null;

  const value = decoded as Record<string, unknown>;
  if (
    value.v !== TOKEN_VERSION ||
    typeof value.sub !== 'string' ||
    !UUID_PATTERN.test(value.sub) ||
    typeof value.iat !== 'number' ||
    !Number.isFinite(value.iat)
  ) {
    return null;
  }

  return value.sub;
}

export function buildUnsubscribeUrl(siteUrl: string, userId: string, secret: string): string {
  const url = new URL('/api/email/unsubscribe', siteUrl);
  url.searchParams.set('token', signUnsubscribeToken(userId, secret));
  return url.toString();
}
