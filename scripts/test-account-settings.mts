import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  ACCOUNT_SETTINGS_MAX_ATTEMPTS,
  canDeleteAccount,
  constantTimeEqualHex,
  digestAccountCode,
  generateOtpCode,
  isSessionInvalidated,
  mapChallengeConsumeError,
  readTokenIat,
} from '../lib/account-settings';
import { buildAccountSettingsEmail } from '../lib/email/account-settings';

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

// OTP format
for (let i = 0; i < 20; i += 1) {
  const code = generateOtpCode();
  assert.match(code, /^\d{8}$/);
}
console.log('PASS account-settings: generateOtpCode returns 8 digits');

// Digest binding
const secret = 'test-secret-0123456789';
const digestA = digestAccountCode(secret, 'cid-1', 'user-1', 'password', 'current', 'a@b.com', '12345678');
const digestB = digestAccountCode(secret, 'cid-1', 'user-1', 'password', 'current', 'a@b.com', '12345678');
const digestC = digestAccountCode(secret, 'cid-2', 'user-1', 'password', 'current', 'a@b.com', '12345678');
const digestD = digestAccountCode(secret, 'cid-1', 'user-1', 'email', 'current', 'a@b.com', '12345678');
const digestE = digestAccountCode(secret, 'cid-1', 'user-1', 'email', 'new', 'new@b.com', '12345678');
assert.equal(digestA, digestB);
assert.notEqual(digestA, digestC);
assert.notEqual(digestA, digestD);
assert.notEqual(digestA, digestE);
assert.equal(digestA.length, 64);
assert.match(digestA, /^[0-9a-f]{64}$/);
console.log('PASS account-settings: digest bound to challenge/user/action/purpose/email/code');

// constant-time compare
assert.equal(constantTimeEqualHex(digestA, digestB), true);
assert.equal(constantTimeEqualHex(digestA, digestC), false);
assert.equal(constantTimeEqualHex('abc', 'abcd'), false);
console.log('PASS account-settings: constantTimeEqualHex');

// canDeleteAccount
assert.equal(canDeleteAccount({ email_confirmed_at: '2026-01-01T00:00:00Z', email: 'u@x.com' } as any), true);
assert.equal(canDeleteAccount({ email_confirmed_at: null, email: 'u@x.com' } as any), false);
assert.equal(canDeleteAccount({ email_confirmed_at: '2026-01-01T00:00:00Z', email: '' } as any), false);
console.log('PASS account-settings: canDeleteAccount requires verified email');

// session invalidation
const oldToken = makeJwt({ iat: 1000 });
const newToken = makeJwt({ iat: 2000 });
const invalidatedUser = { app_metadata: { sessions_invalidated_at: new Date(1500 * 1000).toISOString() } } as any;
assert.equal(isSessionInvalidated(invalidatedUser, oldToken), true);
assert.equal(isSessionInvalidated(invalidatedUser, newToken), false);
assert.equal(isSessionInvalidated({ app_metadata: {} } as any, oldToken), false);
assert.equal(readTokenIat(oldToken), 1000);
console.log('PASS account-settings: session invalidation uses token iat');

// challenge error mapping
assert.equal(mapChallengeConsumeError('expired').status, 400);
assert.equal(mapChallengeConsumeError('expired').code, 'invalid_code');
assert.equal(mapChallengeConsumeError('consumed').code, 'invalid_code');
assert.equal(mapChallengeConsumeError('not_found').code, 'invalid_code');
assert.equal(mapChallengeConsumeError('mismatch').code, 'invalid_code');
assert.equal(mapChallengeConsumeError('too_many_attempts').status, 429);
assert.equal(mapChallengeConsumeError('too_many_attempts').code, 'too_many_attempts');
console.log('PASS account-settings: challenge consume errors mapped safely');

assert.equal(ACCOUNT_SETTINGS_MAX_ATTEMPTS, 5);

// email templates
for (const purpose of ['current', 'new'] as const) {
  const mail = buildAccountSettingsEmail({ action: 'email', email: 'user@example.com', code: '12345678', purpose });
  assert.match(mail.subject, /RakitKarier/i);
  assert.match(mail.html, /12345678/);
  assert.match(mail.html, /15 menit/);
  assert.match(mail.html, /Abaikan/i);
  assert.match(mail.text, /12345678/);
}
const pwdMail = buildAccountSettingsEmail({ action: 'password', email: 'user@example.com', code: '87654321', purpose: 'current' });
assert.match(pwdMail.subject, /password/i);
assert.match(pwdMail.html, /87654321/);
const delMail = buildAccountSettingsEmail({ action: 'delete', email: 'user@example.com', code: '11223344', purpose: 'current' });
assert.match(delMail.subject.toLowerCase(), /hapus akun/);
assert.match(delMail.html, /11223344/);
assert.match(delMail.html, /15 menit/);
console.log('PASS account-settings: email templates include code, expiry, ignore hint');

// Route handlers exist and reject bad auth (smoke, no Supabase env needed for early rejection).
{
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    const { GET } = await import('../app/api/account/settings/route');
    const res = await GET(new NextRequest('http://localhost/api/account/settings', { method: 'GET' }));
    assert.equal(res.status, 401);
  } finally {
    if (prevUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    if (prevAnon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = prevAnon;
  }
}
console.log('PASS account-settings: GET rejects unauthenticated request');

console.log('ALL ACCOUNT SETTINGS TESTS PASSED');
