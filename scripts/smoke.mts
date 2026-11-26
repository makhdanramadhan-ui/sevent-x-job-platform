import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { canonicalizeCatalogValues } from '../lib/catalog-core';
import { COUNTRIES } from '../lib/countries';
import { findLocation, LOCATION_CANONICAL, LOCATIONS, searchLocations } from '../lib/locations';
import { parseProfile } from '../lib/profile';
import { POSITION_CANONICAL, POSITIONS, searchPositions } from '../lib/positions';

type JsonRecord = Record<string, unknown>;

type CallOptions = {
  headers?: Record<string, string>;
  body?: string | JsonRecord;
};

type CheckResponse = {
  status: number;
  json: unknown;
  text: string;
  headers: Headers;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function objectAt(value: unknown, label: string): JsonRecord {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value), label);
  return value as JsonRecord;
}

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

const child: ChildProcess = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', port, '-H', '127.0.0.1'],
  {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
  },
);
assert.ok(child.stdout, 'FAIL: stdout proses Next.js tidak tersedia');
assert.ok(child.stderr, 'FAIL: stderr proses Next.js tidak tersedia');

let logs = '';
child.stdout.on('data', (chunk: Buffer) => {
  logs += chunk.toString();
});
child.stderr.on('data', (chunk: Buffer) => {
  logs += chunk.toString();
});

async function waitForServer(): Promise<void> {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server berhenti dengan kode ${child.exitCode}.`);
    }
    try {
      const response = await fetch(`${base}/`, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Server tidak siap dalam 40 detik.');
}

async function call(method: string, route: string, options: CallOptions = {}): Promise<CheckResponse> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  const init: RequestInit = { method, headers, redirect: 'manual' };
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
  return { status: response.status, json: parseJson(text), text, headers: response.headers };
}

async function expectError(
  label: string,
  request: Promise<CheckResponse>,
  status: number,
  code: string,
): Promise<void> {
  const response = await request;
  assert.equal(response.status, status, `${label}: status ${response.status} != ${status}`);
  const body = objectAt(response.json, `${label}: body bukan JSON`);
  const error = objectAt(body.error, `${label}: envelope error tidak ada`);
  assert.equal(error.code, code, `${label}: kode ${String(error.code)}`);
  assert.equal(typeof error.message, 'string', `${label}: pesan tidak ada`);
  assert.ok(!('stack' in error), `${label}: stack bocor`);
  console.log(`PASS ${label} -> ${status} ${code}`);
}

function captureError(action: () => void): Record<string, unknown> {
  try {
    action();
  } catch (error) {
    return error as Record<string, unknown>;
  }
  throw new Error('Expected validation error');
}

function checkCatalogs(): void {
  assert.ok(POSITIONS.length >= 250 && POSITIONS.length <= 450, 'ukuran katalog posisi');
  assert.ok(LOCATIONS.length >= 250, 'ukuran katalog lokasi');
  assert.equal(LOCATIONS.filter((entry) => entry.type === 'province').length, 38, 'jumlah provinsi');
  assert.equal(findLocation('Remote')?.country, '*', 'Remote country');
  assert.equal(findLocation('Hybrid'), null, 'Hybrid bukan lokasi');
  assert.ok(COUNTRIES.some((country) => country.code === 'ID'), 'katalog negara ID');
  assert.deepEqual(
    canonicalizeCatalogValues(['swe'], POSITION_CANONICAL).values,
    ['Software Engineer'],
    'alias swe',
  );
  assert.deepEqual(
    canonicalizeCatalogValues(['jaksel'], LOCATION_CANONICAL).values,
    ['Jakarta Selatan'],
    'alias jaksel',
  );
  assert.equal(searchPositions('iot')[0]?.name, 'IoT Engineer', 'pencarian iot');
  assert.equal(searchPositions('devsecops')[0]?.name, 'DevSecOps Engineer', 'pencarian devsecops');
  assert.equal(searchPositions('account executive')[0]?.name, 'Account Executive', 'pencarian ae');
  assert.equal(searchLocations('jogja', 'ID')[0]?.name, 'Yogyakarta', 'pencarian jogja');

  const parsedCustom = parseProfile({
    preferences: {
      country: 'ID',
      positions: ['swe', '  Custom Role Unik  ', 'Software Engineer'],
      locations: ['Bogor'],
    },
  });
  assert.deepEqual(
    parsedCustom.preferences.positions,
    ['Software Engineer', 'Custom Role Unik'],
    'posisi kanonik + kustom tanpa duplikat',
  );

  const invalidLocation = captureError(() =>
    parseProfile({ preferences: { country: 'ID', positions: [], locations: ['Kota Tidak Ada'] } }),
  );
  assert.equal(invalidLocation.status, 400, 'lokasi tak dikenal ditolak 400');
  assert.equal(invalidLocation.code, 'validation_error', 'lokasi tak dikenal kode error');

  const mismatch = captureError(() =>
    parseProfile({ preferences: { country: 'ID', positions: [], locations: ['Kuala Lumpur'] } }),
  );
  assert.equal(mismatch.status, 400, 'lokasi luar negara ditolak 400');
  console.log('PASS katalog: ' +
    `${POSITIONS.length} posisi, ${LOCATIONS.length} lokasi, ${COUNTRIES.length} negara`);
}

async function main(): Promise<void> {
  checkCatalogs();
  await waitForServer();
  const invalidBearer = `Bearer ${'x'.repeat(24)}`;
  const id = '00000000-0000-4000-8000-000000000000';
  const validProfile = { full_name: 'Uji Backend' };

  const home = await call('GET', '/');
  assert.equal(home.status, 200, 'root: status');
  assert.match(home.text, /RakitKarier/, 'root: judul');
  assert.equal(home.headers.get('x-powered-by'), null, 'root: x-powered-by harus kosong');
  console.log('PASS GET / -> 200');
  const catalogPositions = await call('GET', '/api/catalog?type=positions&q=iot&limit=8');
  assert.equal(catalogPositions.status, 200, 'GET /api/catalog positions: status');
  const positionData = objectAt(catalogPositions.json, 'GET /api/catalog positions: body').data;
  assert.ok(Array.isArray(positionData), 'GET /api/catalog positions: data');
  assert.equal(
    objectAt((positionData as unknown[])[0], 'item posisi').name,
    'IoT Engineer',
    'GET /api/catalog positions: urutan pertama',
  );
  const catalogLocations = await call('GET', '/api/catalog?type=locations&q=jogja&country=ID');
  assert.equal(catalogLocations.status, 200, 'GET /api/catalog locations: status');
  const locationData = objectAt(catalogLocations.json, 'GET /api/catalog locations: body').data;
  assert.equal(
    objectAt((locationData as unknown[])[0], 'item lokasi').name,
    'Yogyakarta',
    'GET /api/catalog locations: jogja',
  );
  const catalogCountries = await call('GET', '/api/catalog?type=countries&q=');
  assert.equal(catalogCountries.status, 200, 'GET /api/catalog countries: status');
  const countryData = objectAt(catalogCountries.json, 'GET /api/catalog countries: body').data;
  assert.equal(
    objectAt((countryData as unknown[])[0], 'item negara').id,
    'ID',
    'GET /api/catalog countries: default Indonesia',
  );
  await expectError(
    'GET /api/catalog type asing',
    call('GET', '/api/catalog?type=asal'),
    400,
    'validation_error',
  );

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
  await expectError(
    'POST /api/profile/avatar anonim',
    call('POST', '/api/profile/avatar'),
    401,
    'unauthorized',
  );
  await expectError(
    'DELETE /api/profile/avatar anonim',
    call('DELETE', '/api/profile/avatar'),
    401,
    'unauthorized',
  );

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
  await expectError(
    'POST /api/auth/forgot-password field asing',
    call('POST', '/api/auth/forgot-password', {
      body: { email: 'uji@example.com', extra: 1 },
    }),
    400,
    'unknown_field',
  );
  await expectError(
    'POST /api/auth/forgot-password email salah',
    call('POST', '/api/auth/forgot-password', { body: { email: 'bukan-email' } }),
    400,
    'validation_error',
  );
  await expectError(
    'POST /api/auth/forgot-password origin asing',
    call('POST', '/api/auth/forgot-password', {
      body: { email: 'uji@example.com' },
      headers: { origin: 'https://evil.example' },
    }),
    403,
    'csrf_rejected',
  );
  await expectError(
    'POST /api/auth/reset-password kode bukan 8 digit',
    call('POST', '/api/auth/reset-password', {
      body: { email: 'uji@example.com', code: '12a45678', password: 'Password1' },
    }),
    400,
    'validation_error',
  );
  await expectError(
    'POST /api/auth/reset-password password lemah',
    call('POST', '/api/auth/reset-password', {
      body: { email: 'uji@example.com', code: '12345678', password: 'abcdefgh' },
    }),
    400,
    'weak_password',
  );
  await expectError(
    'POST /api/auth/signup password tanpa kapital',
    call('POST', '/api/auth/signup', {
      body: { email: 'uji@example.com', password: 'abcdefgh' },
    }),
    400,
    'weak_password',
  );

  const loginStatus = hasSupabase ? 401 : 503;
  const loginCode = hasSupabase ? 'invalid_credentials' : 'auth_not_configured';
  await expectError(
    'POST /api/auth/login kredensial tidak valid',
    call('POST', '/api/auth/login', { body: { email: 'uji@example.com', password: 'password123' } }),
    loginStatus,
    loginCode,
  );

  await expectError(
    'GET /api/skills q kosong',
    call('GET', '/api/skills?q='),
    400,
    'validation_error',
  );

  if (hasSupabase) {
    const skills = await call('GET', '/api/skills?q=py&limit=5');
    assert.equal(skills.status, 200, 'GET /api/skills: status');
    const body = objectAt(skills.json, 'GET /api/skills: body bukan JSON');
    assert.ok(Array.isArray(body.data), 'GET /api/skills: data bukan array');
    for (const item of body.data as unknown[]) {
      const row = objectAt(item, 'GET /api/skills: item bukan objek');
      assert.equal(typeof row.id, 'number', 'GET /api/skills: id bukan number');
      assert.equal(typeof row.name, 'string', 'GET /api/skills: name bukan string');
      assert.equal(typeof row.category, 'string', 'GET /api/skills: category bukan string');
    }
    assert.equal(
      skills.headers.get('cache-control'),
      'public, s-maxage=3600, stale-while-revalidate=86400',
      'GET /api/skills: cache-control',
    );
    console.log('PASS GET /api/skills -> 200 (cache-control)');
  }

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
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
