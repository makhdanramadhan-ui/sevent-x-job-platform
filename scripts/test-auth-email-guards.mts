import assert from 'node:assert/strict';
import { assertEmailConfirmed, isEmailProviderUser } from '../lib/auth';
import { ApiError } from '../lib/http';
import type { User } from '@supabase/supabase-js';

function makeUser(partial: Partial<User>): User {
  return {
    id: 'u1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...partial,
  } as User;
}

const emailUnconfirmed = makeUser({
  app_metadata: { provider: 'email' },
  email_confirmed_at: undefined,
  confirmed_at: undefined,
});

try {
  assertEmailConfirmed(emailUnconfirmed);
  assert.fail('expected ApiError');
} catch (e) {
  assert.ok(e instanceof ApiError);
  assert.equal(e.status, 401);
  assert.equal(e.code, 'email_not_confirmed');
  console.log('PASS requireAuth/guard: unconfirmed email-provider -> 401 email_not_confirmed');
}

const emailConfirmed = makeUser({
  app_metadata: { provider: 'email' },
  email_confirmed_at: new Date().toISOString(),
});
assert.doesNotThrow(() => assertEmailConfirmed(emailConfirmed));
console.log('PASS guard: confirmed email-provider allowed');

const oauthUser = makeUser({
  app_metadata: { provider: 'google', providers: ['google'] },
  email_confirmed_at: undefined,
});
assert.doesNotThrow(() => assertEmailConfirmed(oauthUser));
console.log('PASS guard: oauth unconfirmed not blocked by email-confirm guard');

assert.equal(isEmailProviderUser(emailUnconfirmed), true);
assert.equal(isEmailProviderUser(oauthUser), false);
console.log('PASS isEmailProviderUser classification');

console.log('ALL AUTH EMAIL GUARD TESTS PASSED');
