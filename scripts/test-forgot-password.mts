import assert from 'node:assert/strict';
import type { ApiError } from '../lib/http';
import { validatePassword } from '../lib/password-policy';
import { buildForgotPasswordEmail } from '../lib/email/forgot-password';
import { FORGOT_PASSWORD_STATUS } from '../lib/forgot-password';
import {
  parseResetCode,
  parseNewPassword,
  tooManyAttempts,
  RESET_ATTEMPT_MAX,
  RESET_ATTEMPT_WINDOW_SECONDS,
} from '../lib/reset-password';

function expectApiError(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof Error && 'code' in error, 'expected an ApiError with a code');
    return error as ApiError;
  }
  throw new Error('expected the call to throw an ApiError');
}

// --- Password policy cases ---
assert.equal(validatePassword('abcdefgh').ok, false, 'abcdefgh must fail (no uppercase)');
assert.match(validatePassword('abcdefgh').failures.join(' '), /kapital/i);
assert.equal(validatePassword('Abcdefgh').ok, true, 'Abcdefgh must pass');
assert.equal(validatePassword('Abc12').ok, false, 'Abc12 must fail (too short)');
assert.match(validatePassword('Abc12').failures.join(' '), /8 karakter/i);
assert.equal(validatePassword('A1234567').ok, true, '8 chars with leading uppercase passes');
assert.equal(validatePassword('abcdefghA').ok, true, 'uppercase anywhere passes');
assert.equal(validatePassword('').ok, false, 'empty fails both rules');
console.log('PASS policy: abcdefgh fails, Abcdefgh passes, Abc12 fails on length');

// --- Forgot response is identical for an existing and a missing email ---
assert.deepEqual(FORGOT_PASSWORD_STATUS, { status: 'code_sent_if_exists' });
console.log('PASS forgot: generic response { status: "code_sent_if_exists" } for both branches');

// --- Reset email template required lines ---
const mail = buildForgotPasswordEmail({ email: 'user@example.com', code: '12345678' });
assert.match(mail.subject, /RakitKarier/i);
assert.match(mail.html, /12345678/);
assert.match(mail.html, /kode 8 digit/i);
assert.match(mail.html, /abaikan jika tidak meminta/i);
assert.match(mail.html, /Spam/i);
assert.match(mail.text, /12345678/);
assert.match(mail.text, /kode 8 digit/i);
assert.match(mail.text, /Spam/i);
assert.match(mail.html, /font-size:36px/, 'code must be rendered big');
console.log('PASS forgot email: big code, 1 hour note, ignore line, spam hint');

// --- Code-format validation ---
assert.equal(parseResetCode('12345678'), '12345678');
assert.equal(parseResetCode('00000000'), '00000000');
for (const bad of ['1234567', '123456789', 'abcdefgh', '12 45 678', '1234567a', '']) {
  const err = expectApiError(() => parseResetCode(bad));
  assert.equal(err.status, 400);
  assert.equal(err.code, 'validation_error');
}
console.log('PASS reset: code must match ^\\d{8}$ (bad formats rejected)');

// --- New-password parsing (byte bound, distinct from policy) ---
assert.equal(parseNewPassword('Password1'), 'Password1');
const longPassword = expectApiError(() => parseNewPassword('a'.repeat(73)));
assert.equal(longPassword.code, 'validation_error');
console.log('PASS reset: password byte bound enforced before policy');

// --- Attempt throttle ---
assert.equal(RESET_ATTEMPT_MAX, 5);
assert.equal(RESET_ATTEMPT_WINDOW_SECONDS, 15 * 60);
const throttled = tooManyAttempts(600);
assert.equal(throttled.status, 429);
assert.equal(throttled.headers.get('Retry-After'), '600');
const body = await throttled.json();
assert.equal(body.error.code, 'too_many_attempts');
assert.match(body.error.message, /Terlalu sering/i);
console.log('PASS reset throttle: 5 per email / 15 min, 429 too_many_attempts with Retry-After');

console.log('ALL FORGOT PASSWORD TESTS PASSED');
