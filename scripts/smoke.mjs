import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = process.env.SMOKE_PORT ?? '3417';
const base = `http://127.0.0.1:${port}`;
const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

if (!existsSync(path.join(root, '.next', 'BUILD_ID'))) {
  console.error('FAIL: .next/BUILD_ID tidak ada. Jalankan npm run build lebih dahulu.');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port, '-H', '127.0.0.1'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  },
);

let logs = '';
child.stdout.on('data', (chunk) => {
  logs += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  logs += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server berhenti dengan kode ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${base}/`, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server tidak siap dalam 40 detik.');
}

async function call(method, route, options = {}) {
  const headers = { ...(options.headers ?? {}) };
  const init = { method, headers, redirect: 'manual' };
  if (options.body !== undefined) {
    if (typeof options.body === 'string') {
      init.body = options.body;
    } else {
      init.body = JSON.stringify(options.body);
    }
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['content-type'] = 'application/json';
    }
  }
  const response = await fetch(`${base}${route}`, init);
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function expectError(label, request, status, code) {
  const response = await request;
  assert.equal(response.status, status, `${label}: status ${response.status} != ${status}`);
  assert.ok(response.json && typeof response.json === 'object', `${label}: body bukan JSON`);
  assert.ok(response.json.error, `${label}: envelope error tidak ada`);
  assert.equal(response.json.error.code, code, `${label}: kode ${response.json.error.code}`);
  assert.equal(typeof response.json.error.message, 'string', `${label}: pesan tidak ada`);
  assert.ok(!('stack' in response.json.error), `${label}: stack bocor`);
  console.log(`PASS ${label} -> ${status} ${code}`);
}

async function main() {
  await waitForServer();
  const invalidBearer = `Bearer ${'x'.repeat(24)}`;
  const id = '00000000-0000-4000-8000-000000000000';
  const validProfile = { full_name: 'Uji Backend' };

  const home = await call('GET', '/');
  assert.equal(home.status, 200, 'root: status');
  assert.match(home.text, /SEVENT X/, 'root: judul');
  assert.equal(home.headers.get('x-powered-by'), null, 'root: x-powered-by harus kosong');
  console.log('PASS GET / -> 200');

  await expectError('GET /api/auth/me anonim', call('GET', '/api/auth/me'), 401, 'unauthorized');
  await expectError('GET /api/jobs anonim', call('GET', '/api/jobs'), 401, 'unauthorized');
  await expectError(
    'GET /api/jobs detail anonim',
    call('GET', `/api/jobs/${id}`),
    401,
    'unauthorized',
  );
  await expectError('GET /api/profile anonim', call('GET', '/api/profile'), 401, 'unauthorized');
  await expectError(
    'PUT /api/profile anonim',
    call('PUT', '/api/profile', { body: validProfile }),
    401,
    'unauthorized',
  );
  await expectError(
    'DELETE /api/profile anonim',
    call('DELETE', '/api/profile'),
    401,
    'unauthorized',
  );
  await expectError('GET /api/bookmarks anonim', call('GET', '/api/bookmarks'), 401, 'unauthorized');
  await expectError(
    'POST /api/bookmarks anonim',
    call('POST', '/api/bookmarks', { body: { job_id: id } }),
    401,
    'unauthorized',
  );
  await expectError(
    'DELETE /api/bookmarks anonim',
    call('DELETE', `/api/bookmarks/${id}`),
    401,
    'unauthorized',
  );
  await expectError('GET /api/cv anonim', call('GET', '/api/cv'), 401, 'unauthorized');
  await expectError(
    'POST /api/cv anonim',
    call('POST', '/api/cv', { body: { title: 'CV', content: {} } }),
    401,
    'unauthorized',
  );
  await expectError('GET /api/cv detail anonim', call('GET', `/api/cv/${id}`), 401, 'unauthorized');

  const bearerStatus = hasSupabase ? 401 : 503;
  const bearerCode = hasSupabase ? 'unauthorized' : 'auth_not_configured';
  await expectError(
    'GET /api/jobs Bearer tidak valid',
    call('GET', '/api/jobs', { headers: { authorization: invalidBearer } }),
    bearerStatus,
    bearerCode,
  );

  await expectError(
    'POST /api/auth/login JSON rusak',
    call('POST', '/api/auth/login', { body: '{', headers: { 'content-type': 'application/json' } }),
    400,
    'invalid_json',
  );
  await expectError(
    'POST /api/auth/login field asing',
    call('POST', '/api/auth/login', {
      body: { email: 'uji@example.com', password: 'password123', extra: true },
    }),
    400,
    'unknown_field',
  );
  await expectError(
    'POST /api/auth/login email salah',
    call('POST', '/api/auth/login', { body: { email: 'bukan-email', password: 'password123' } }),
    400,
    'validation_error',
  );
  await expectError(
    'POST /api/auth/login password pendek',
    call('POST', '/api/auth/login', { body: { email: 'uji@example.com', password: 'pendek' } }),
    400,
    'validation_error',
  );
  await expectError(
    'POST /api/auth/login content-type salah',
    call('POST', '/api/auth/login', {
      body: '{"email":"uji@example.com","password":"password123"}',
      headers: { 'content-type': 'text/plain' },
    }),
    415,
    'unsupported_media_type',
  );
  await expectError(
    'POST /api/auth/login body terlalu besar',
    call('POST', '/api/auth/login', {
      body: JSON.stringify({ email: 'uji@example.com', password: 'password123', padding: 'a'.repeat(9000) }),
    }),
    413,
    'payload_too_large',
  );
  await expectError(
    'POST /api/auth/signup password pendek',
    call('POST', '/api/auth/signup', { body: { email: 'uji@example.com', password: 'pendek' } }),
    400,
    'validation_error',
  );
  await expectError(
    'POST /api/auth/signup field asing',
    call('POST', '/api/auth/signup', {
      body: { email: 'uji@example.com', password: 'password123', role: 'admin' },
    }),
    400,
    'unknown_field',
  );

  const loginStatus = hasSupabase ? 401 : 503;
  const loginCode = hasSupabase ? 'invalid_credentials' : 'auth_not_configured';
  await expectError(
    'POST /api/auth/login kredensial tidak valid',
    call('POST', '/api/auth/login', { body: { email: 'uji@example.com', password: 'password123' } }),
    loginStatus,
    loginCode,
  );

  console.log(`PASS smoke selesai (${hasSupabase ? 'Supabase env terdeteksi' : 'tanpa Supabase env'})`);
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  const tail = logs.trim().split('\n').slice(-20).join('\n');
  if (tail) console.error(tail);
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
