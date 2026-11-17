import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, unknown>;
type CookieJar = Map<string, string>;

type TestUser = {
  id?: string;
  email: string;
  password: string;
};

type IngestReference = {
  jobId: string;
  sourceJobId: string;
  fetchedAt: string;
};

type CallOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  jar?: CookieJar;
  origin?: string;
  mutation?: boolean;
};

type FetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

type CheckResponse = {
  status: number;
  json: unknown;
  text: string;
  headers: Headers;
};

type IngestPayload = {
  source: {
    name: string;
    job_id: string;
    url: string;
    fetched_at: string;
  };
  job: {
    id?: string;
    title: string;
    company: string;
    location: string;
    work_mode: string;
    employment_type: string;
    level: string;
    skills: string[];
    description: string;
    status: string;
  };
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

function arrayAt(value: unknown, label: string): unknown[] {
  assert.ok(Array.isArray(value), label);
  return value;
}

function stringAt(value: unknown, label: string): string {
  assert.ok(typeof value === 'string', label);
  return value;
}

function dataOf(response: CheckResponse, label: string): JsonRecord {
  return objectAt(objectAt(response.json, label).data, `${label} data`);
}

const explicitBase = process.env.SEVENT_BASE_URL;
const port = process.env.INTEGRATION_PORT ?? '3418';
const base = new URL(explicitBase ?? `http://127.0.0.1:${port}`);
const origin = base.origin;
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const password =
  process.env.SEVENT_TEST_PASSWORD ?? `Check-${randomBytes(12).toString('base64url')}`;
const emailA = process.env.SEVENT_TEST_EMAIL_A ?? '';
const emailB = process.env.SEVENT_TEST_EMAIL_B ?? '';

if (!supabaseUrl || !anonKey) {
  console.error('UNTESTED: NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY wajib diisi.');
  process.exit(2);
}
if (!serviceKey && (!emailA || !emailB)) {
  console.error(
    'UNTESTED: isi SUPABASE_SERVICE_ROLE_KEY atau SEVENT_TEST_EMAIL_A, SEVENT_TEST_EMAIL_B, SEVENT_TEST_PASSWORD.',
  );
  process.exit(2);
}

const createdUsers: string[] = [];
const createdJobIds: string[] = [];
let serverProcess: ChildProcess | null = null;

async function ensureServer(): Promise<void> {
  if (explicitBase) return;
  const root = process.cwd();
  if (!existsSync(path.join(root, '.next', 'BUILD_ID'))) {
    throw new Error('.next/BUILD_ID tidak ada. Jalankan npm run build lebih dahulu.');
  }
  let logs = '';
  const child = spawn(
    process.execPath,
    [
      path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-p',
      port,
      '-H',
      '127.0.0.1',
    ],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
    },
  );
  serverProcess = child;
  assert.ok(child.stdout, 'FAIL: stdout proses Next.js tidak tersedia');
  assert.ok(child.stderr, 'FAIL: stderr proses Next.js tidak tersedia');
  child.stdout.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr.on('data', (chunk: Buffer) => {
    logs += chunk.toString();
  });
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server berhenti dengan kode ${child.exitCode}. ${logs.slice(-500)}`);
    }
    try {
      const response = await fetch(`${origin}/`, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server tidak siap dalam 40 detik. ${logs.slice(-500)}`);
}

async function stopServer(): Promise<void> {
  const child = serverProcess;
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise<void>((resolve) => setTimeout(resolve, 400));
  if (child.exitCode === null) child.kill('SIGKILL');
}

function cookieJar(response: CheckResponse): CookieJar {
  const jar: CookieJar = new Map();
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0];
    const separator = pair.indexOf('=');
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  return jar;
}

function cookieHeader(jar: CookieJar): string {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function call(route: string, options: CallOptions = {}): Promise<CheckResponse> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.jar) headers.cookie = cookieHeader(options.jar);
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.mutation !== false && options.method && options.method !== 'GET') {
    headers.origin = options.origin ?? origin;
  }
  const response = await fetch(`${origin}${route}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  const text = await response.text();
  return { status: response.status, json: parseJson(text), text, headers: response.headers };
}

async function adminFetch(route: string, options: FetchOptions = {}): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}${route}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase admin ${route} gagal (${response.status}): ${text.slice(0, 300)}`);
  }
  return parseJson(text);
}

async function anonFetch(
  route: string,
  options: FetchOptions = {},
): Promise<{ status: number; json: unknown; text: string }> {
  const response = await fetch(`${supabaseUrl}${route}`, {
    method: options.method ?? 'POST',
    headers: {
      apikey: anonKey,
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  return { status: response.status, json: parseJson(text), text };
}

async function createUser(label: string): Promise<TestUser | null> {
  if (!serviceKey) return null;
  const email = `sevent-check-${label}-${Date.now()}-${randomBytes(4).toString('hex')}@example.com`;
  const created = objectAt(
    await adminFetch('/auth/v1/admin/users', {
      body: {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: `Uji ${label}` },
      },
    }),
    `create user ${label}`,
  );
  const user = objectAt(created.user ?? created, `create user ${label} user`);
  const id = stringAt(user.id, `create user ${label} id`);
  createdUsers.push(id);
  return { id, email, password };
}

async function login(user: TestUser): Promise<CookieJar> {
  const response = await call('/api/auth/login', {
    method: 'POST',
    body: { email: user.email, password: user.password },
  });
  assert.equal(response.status, 200, `login ${user.email}: status ${response.status} ${response.text}`);
  const jar = cookieJar(response);
  assert.ok(jar.size > 0, 'login harus menulis cookie sesi');
  return jar;
}

async function expectError(
  label: string,
  response: CheckResponse,
  status: number,
  code: string,
): Promise<void> {
  assert.equal(response.status, status, `${label}: status ${response.status} ${response.text}`);
  const error = objectAt(objectAt(response.json, `${label}: envelope error`).error, `${label}: error`);
  assert.equal(error.code, code, `${label}: kode ${String(error.code)}`);
  console.log(`PASS ${label} -> ${status} ${code}`);
}

function buildPayload(sourceJobId: string, fetchedAt: string, title = 'Backend Engineer Uji'): IngestPayload {
  return {
    source: {
      name: 'sevent-check',
      job_id: sourceJobId,
      url: 'https://example.com/lowongan-uji',
      fetched_at: fetchedAt,
    },
    job: {
      title,
      company: 'SEVENT Check',
      location: 'Jakarta',
      work_mode: 'hybrid',
      employment_type: 'full_time',
      level: 'mid',
      skills: ['TypeScript', 'PostgreSQL'],
      description: 'Lowongan sintetis untuk pemeriksaan RLS.',
      status: 'open',
    },
  };
}

async function rpcIngest(payload: IngestPayload): Promise<string> {
  const result = await adminFetch('/rest/v1/rpc/ingest_job', { body: { payload } });
  const jobId: unknown = Array.isArray(result) ? result[0] : result;
  assert.ok(typeof jobId === 'string', 'ingest_job harus mengembalikan UUID');
  return jobId;
}

async function ingestJob(): Promise<IngestReference | null> {
  if (!serviceKey) return null;
  const sourceJobId = `check-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const fetchedAt = new Date().toISOString();
  const jobId = await rpcIngest(buildPayload(sourceJobId, fetchedAt));
  createdJobIds.push(jobId);
  const source = arrayAt(
    await adminFetch(
      `/rest/v1/job_sources?select=source_name,source_url,fetched_at&job_id=eq.${jobId}`,
    ),
    'sumber',
  );
  assert.equal(source.length, 1, 'satu sumber harus tersimpan');
  assert.equal(objectAt(source[0], 'sumber').source_name, 'sevent-check', 'provenance sumber');
  console.log(`PASS ingest_job idempoten -> ${jobId}`);
  return { jobId, sourceJobId, fetchedAt };
}

async function checkConcurrency(): Promise<IngestReference | null> {
  if (!serviceKey) return null;
  const sourceJobId = `check-concurrent-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const fetchedAt = new Date().toISOString();
  const payload = buildPayload(sourceJobId, fetchedAt);
  const results = await Promise.all(Array.from({ length: 8 }, () => rpcIngest(payload)));
  const unique = [...new Set(results)];
  assert.equal(unique.length, 1, `ingest konkuren menghasilkan ${unique.length} lowongan berbeda`);
  const jobId = unique[0];
  createdJobIds.push(jobId);
  const sources = arrayAt(
    await adminFetch(
      `/rest/v1/job_sources?select=job_id,source_job_id&source_name=eq.sevent-check&source_job_id=eq.${sourceJobId}`,
    ),
    'sumber konkuren',
  );
  assert.equal(sources.length, 1, 'ingest konkuren harus menghasilkan satu sumber');
  assert.equal(objectAt(sources[0], 'sumber konkuren').job_id, jobId, 'sumber harus menunjuk lowongan yang dikembalikan');
  console.log('PASS ingest_job konkuren satu lowongan');
  return { jobId, sourceJobId, fetchedAt };
}

async function checkStale(reference: IngestReference | null): Promise<void> {
  if (!reference) return;
  const staleAt = new Date(Date.parse(reference.fetchedAt) - 3600 * 1000).toISOString();
  const returned = await rpcIngest(buildPayload(reference.sourceJobId, staleAt, 'Judul Usang'));
  assert.equal(returned, reference.jobId, 'payload usang harus mengembalikan lowongan yang sama');
  const jobs = arrayAt(
    await adminFetch(`/rest/v1/jobs?select=title,last_fetched_at&id=eq.${reference.jobId}`),
    'jobs usang',
  );
  assert.equal(objectAt(jobs[0], 'jobs usang').title, 'Backend Engineer Uji', 'payload usang tidak boleh menimpa judul baru');
  const sources = arrayAt(
    await adminFetch(
      `/rest/v1/job_sources?select=fetched_at&source_name=eq.sevent-check&source_job_id=eq.${reference.sourceJobId}`,
    ),
    'sumber usang',
  );
  assert.equal(
    Date.parse(stringAt(objectAt(sources[0], 'sumber usang').fetched_at, 'fetched_at')),
    Date.parse(reference.fetchedAt),
    'fetched_at tidak boleh mundur',
  );
  console.log('PASS ingest_job payload usang diabaikan');
}

async function checkCrossSourceStale(reference: IngestReference | null): Promise<void> {
  if (!reference) return;
  const sourceJobId = `check-alt-${Date.now()}-${randomBytes(3).toString('hex')}`;
  const staleAt = new Date(Date.parse(reference.fetchedAt) - 3600 * 1000).toISOString();
  const payload = buildPayload(sourceJobId, staleAt, 'Judul Sumber Lama');
  payload.job.id = reference.jobId;
  const returned = await rpcIngest(payload);
  assert.equal(returned, reference.jobId, 'sumber baru harus menempel ke job kanonis');
  const jobs = arrayAt(
    await adminFetch(`/rest/v1/jobs?select=title,last_fetched_at&id=eq.${reference.jobId}`),
    'jobs sumber lama',
  );
  const job = objectAt(jobs[0], 'jobs sumber lama');
  assert.equal(job.title, 'Backend Engineer Uji', 'sumber baru usang tidak boleh menimpa judul');
  assert.equal(
    Date.parse(stringAt(job.last_fetched_at, 'last_fetched_at')),
    Date.parse(reference.fetchedAt),
    'last_fetched_at tidak boleh mundur oleh sumber baru',
  );
  const sources = arrayAt(
    await adminFetch(
      `/rest/v1/job_sources?select=job_id&source_name=eq.sevent-check&source_job_id=eq.${sourceJobId}`,
    ),
    'sumber baru',
  );
  assert.equal(sources.length, 1, 'sumber baru tetap tersimpan sebagai provenance');
  assert.equal(objectAt(sources[0], 'sumber baru').job_id, reference.jobId, 'sumber baru menunjuk job kanonis');
  console.log('PASS ingest_job sumber baru usang tidak menimpa job kanonis');
}

async function cleanup(): Promise<void> {
  if (!serviceKey) return;
  for (const jobId of createdJobIds) {
    await adminFetch(`/rest/v1/jobs?id=eq.${jobId}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
  }
  for (const userId of createdUsers) {
    await adminFetch(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  }
}

async function main(): Promise<void> {
  await ensureServer();
  const health = await call('/api/jobs');
  if (health.status === 503) {
    throw new Error('Server berjalan tanpa konfigurasi Supabase; isi .env.local lalu restart.');
  }

  let userA: TestUser | null = emailA ? { email: emailA.toLowerCase(), password } : null;
  let userB: TestUser | null = emailB ? { email: emailB.toLowerCase(), password } : null;
  if (serviceKey) {
    userA = await createUser('a');
    userB = await createUser('b');
  }
  assert.ok(userA && userB, 'dua akun uji wajib tersedia');
  const jarA = await login(userA);
  const jarB = await login(userB);
  console.log('PASS login dua akun dengan cookie sesi');

  await expectError(
    'POST /api/auth/login origin asing',
    await call('/api/auth/login', {
      method: 'POST',
      body: { email: userA.email, password: userA.password },
      origin: 'https://evil.example',
    }),
    403,
    'csrf_rejected',
  );

  const meA = await call('/api/auth/me', { jar: jarA });
  assert.equal(meA.status, 200, 'me A');
  const meAUser = objectAt(dataOf(meA, 'me A').user, 'me A user');
  assert.equal(meAUser.email, userA.email, 'me A harus mengembalikan akun A');
  console.log('PASS GET /api/auth/me cookie');

  const profile = {
    full_name: 'Pengguna Uji A',
    headline: 'Backend',
    skills: ['TypeScript'],
    preferences: {
      positions: ['Backend Engineer'],
      locations: ['Jakarta'],
      levels: ['mid'],
      work_modes: ['hybrid', 'remote'],
      employment_types: ['full_time'],
    },
  };
  const putA = await call('/api/profile', { method: 'PUT', jar: jarA, body: profile });
  assert.equal(putA.status, 200, `PUT profile A: ${putA.text}`);
  assert.equal(dataOf(putA, 'PUT profile A').full_name, profile.full_name);
  const getB = await call('/api/profile', { jar: jarB });
  assert.equal(getB.status, 200, 'GET profile B');
  assert.equal(objectAt(getB.json, 'GET profile B').data, null, 'B tidak boleh melihat profil A');
  console.log('PASS isolasi profil dua akun');

  await expectError(
    'PUT /api/profile origin asing',
    await call('/api/profile', {
      method: 'PUT',
      jar: jarA,
      body: profile,
      origin: 'https://evil.example',
    }),
    403,
    'csrf_rejected',
  );
  await expectError(
    'PUT /api/profile field asing',
    await call('/api/profile', { method: 'PUT', jar: jarA, body: { ...profile, admin: true } }),
    400,
    'unknown_field',
  );

  const cv = await call('/api/cv', {
    method: 'POST',
    jar: jarA,
    body: { title: 'CV Uji A', content: { sections: [{ heading: 'Ringkasan', body: 'Uji' }] } },
  });
  assert.equal(cv.status, 201, `POST cv: ${cv.text}`);
  const cvId = stringAt(dataOf(cv, 'POST cv').id, 'cv id');
  const cvB = await call(`/api/cv/${cvId}`, { jar: jarB });
  assert.equal(cvB.status, 404, 'B tidak boleh membaca CV A');
  const cvuB = await call(`/api/cv/${cvId}`, { method: 'PUT', jar: jarB, body: { title: 'Hijack' } });
  assert.equal(cvuB.status, 404, 'B tidak boleh mengubah CV A');
  const cvdB = await call(`/api/cv/${cvId}`, { method: 'DELETE', jar: jarB });
  assert.equal(cvdB.status, 404, 'B tidak boleh menghapus CV A');
  const cvA = await call(`/api/cv/${cvId}`, { jar: jarA });
  assert.equal(cvA.status, 200, 'A membaca CV sendiri');
  console.log('PASS isolasi CRUD CV dua akun');

  await expectError(
    'GET /api/jobs query asing',
    await call('/api/jobs?nope=1', { jar: jarA }),
    400,
    'unknown_query',
  );

  const ingestResult = await ingestJob();
  const jobId = ingestResult?.jobId ?? null;
  const jobsA = await call('/api/jobs?limit=50', { jar: jarA });
  assert.equal(jobsA.status, 200, 'GET jobs A');
  const jobsData = dataOf(jobsA, 'GET jobs A');
  assert.ok(Array.isArray(jobsData.items), 'items jobs');
  if (jobId) {
    const search = await call('/api/jobs?q=Backend&status=open&limit=5', { jar: jarA });
    assert.equal(search.status, 200, `search jobs: ${search.text}`);
    const searchItems = arrayAt(dataOf(search, 'search jobs').items, 'search items');
    assert.ok(
      searchItems.some((item) => objectAt(item, 'job item').id === jobId),
      'filter q/status harus menemukan lowongan uji',
    );
    const detailA = await call(`/api/jobs/${jobId}`, { jar: jarA });
    assert.equal(detailA.status, 200, 'detail job A');
    assert.equal(arrayAt(dataOf(detailA, 'detail job A').job_sources, 'job_sources').length, 1, 'detail memuat provenance sumber');
    const detailB = await call(`/api/jobs/${jobId}`, { jar: jarB });
    assert.equal(detailB.status, 200, 'B juga boleh membaca lowongan');

    const bookmarkB = await call('/api/bookmarks', {
      method: 'POST',
      jar: jarB,
      body: { job_id: jobId },
    });
    assert.equal(bookmarkB.status, 201, 'B menyimpan lowongan');
    const listA = await call('/api/bookmarks', { jar: jarA });
    assert.equal(listA.status, 200, 'A melihat bookmark sendiri');
    assert.equal(arrayAt(dataOf(listA, 'list bookmark A').items, 'items bookmark A').length, 0, 'bookmark B tidak terlihat oleh A');
    const deleteA = await call(`/api/bookmarks/${jobId}`, { method: 'DELETE', jar: jarA });
    assert.equal(deleteA.status, 200, 'hapus bookmark A');
    assert.equal(dataOf(deleteA, 'hapus bookmark A').deleted, false, 'A tidak dapat menghapus bookmark B');
    const listB = await call('/api/bookmarks', { jar: jarB });
    assert.equal(arrayAt(dataOf(listB, 'list bookmark B').items, 'items bookmark B').length, 1, 'bookmark B tetap ada');
    const deleteB = await call(`/api/bookmarks/${jobId}`, { method: 'DELETE', jar: jarB });
    assert.equal(dataOf(deleteB, 'hapus bookmark B').deleted, true, 'B menghapus bookmark sendiri');
    const bookmarkA = await call('/api/bookmarks', {
      method: 'POST',
      jar: jarA,
      body: { job_id: jobId },
    });
    assert.equal(bookmarkA.status, 201, 'A menyimpan lowongan untuk uji penghapusan profil');
    console.log('PASS isolasi bookmark dua akun');
  } else {
    console.log('SKIP lowongan/bookmark: SUPABASE_SERVICE_ROLE_KEY tidak tersedia');
  }

  const concurrent = await checkConcurrency();
  await checkStale(concurrent);
  await checkCrossSourceStale(concurrent);

  const deleted = await call('/api/profile', { method: 'DELETE', jar: jarA });
  assert.equal(deleted.status, 200, `delete profile A: ${deleted.text}`);
  assert.equal(dataOf(deleted, 'delete profile A').auth_account_deleted, false, 'akun Auth tidak dihapus');
  const profileAfter = await call('/api/profile', { jar: jarA });
  assert.equal(objectAt(profileAfter.json, 'profil setelah DELETE').data, null, 'profil harus kosong setelah DELETE');
  const cvAfter = await call('/api/cv', { jar: jarA });
  assert.equal(arrayAt(dataOf(cvAfter, 'cv setelah DELETE').items, 'items cv').length, 0, 'dokumen CV harus ikut terhapus');
  const bookmarksAfter = await call('/api/bookmarks', { jar: jarA });
  assert.equal(arrayAt(dataOf(bookmarksAfter, 'bookmark setelah DELETE').items, 'items bookmark').length, 0, 'bookmark harus ikut terhapus');
  console.log('PASS DELETE /api/profile membersihkan profil, CV, dan bookmark');

  const logout = await call('/api/auth/logout', { method: 'POST', jar: jarA });
  assert.equal(logout.status, 200, `logout: ${logout.text}`);
  const meLoggedOut = await call('/api/auth/me', { jar: jarA });
  assert.equal(meLoggedOut.status, 401, 'sesi harus tidak valid setelah logout');
  console.log('PASS logout mencabut sesi cookie');

  if (anonKey && userA) {
    const tokenResponse = await anonFetch('/auth/v1/token?grant_type=password', {
      body: { email: userA.email, password: userA.password },
    });
    assert.equal(tokenResponse.status, 200, `token Bearer: ${tokenResponse.text}`);
    const token = objectAt(tokenResponse.json, 'token Bearer').access_token;
    assert.ok(typeof token === 'string' && token.length > 20, 'access token Bearer');
    const bearer = await call('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
    assert.equal(bearer.status, 200, `Bearer me: ${bearer.text}`);
    assert.equal(dataOf(bearer, 'Bearer me').auth_mode, 'bearer', 'mode Bearer');
    console.log('PASS verifikasi Bearer server-side');
  }

  console.log('PASS integrasi Supabase selesai');
}

try {
  await main();
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((error: unknown) => {
    console.error(`WARN cleanup: ${error instanceof Error ? error.message : String(error)}`);
  });
  await stopServer();
}
