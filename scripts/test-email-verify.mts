import assert from 'node:assert/strict';
import { GET as confirmGet } from '../app/auth/confirm/route';
import { NextRequest } from 'next/server';

async function run() {
  // /auth/confirm redirects for missing/invalid params
  const r1 = await confirmGet(new NextRequest('http://localhost/auth/confirm'));
  assert.equal(r1.status, 302);
  const loc1 = r1.headers.get('location') || '';
  assert.match(loc1, /\/login\?verify=invalid/);
  console.log('PASS confirm: missing params -> /login?verify=invalid');

  const r2 = await confirmGet(
    new NextRequest('http://localhost/auth/confirm?token_hash=bogus&type=signup'),
  );
  assert.equal(r2.status, 302);
  const loc2 = r2.headers.get('location') || '';
  assert.match(loc2, /\/login\?verify=invalid/);
  console.log('PASS confirm: bogus token -> /login?verify=invalid');

  console.log('ALL EMAIL VERIFY TESTS PASSED');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
