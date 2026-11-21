import assert from 'node:assert/strict';
import {
  isEmailAlertsEnabled,
  MATCH_EMAIL_THRESHOLD,
  selectDigestCandidates,
} from '../lib/email/digest';
import { buildDigestEmail } from '../lib/email/message';
import {
  runMatchNotify,
  type EmailJobRow,
  type EmailProfileRow,
  type MatchNotifyDeps,
  type SentNotificationRow,
} from '../lib/email/runner';
import { readSmtpConfig, type SmtpConfig } from '../lib/email/transport';
import { readUnsubscribeSecret, signUnsubscribeToken, verifyUnsubscribeToken } from '../lib/email/unsubscribe';

const SMTP: SmtpConfig = {
  host: 'smtp.example.com',
  port: 465,
  user: 'noreply@example.com',
  pass: 'not-a-real-password',
  from: 'RakitKarier <noreply@example.com>',
  secure: true,
};
const SECRET = 'test-hmac-secret';
const SITE_URL = 'https://rakitkarier.vercel.app';
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JOB_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JOB_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type SendRecord = { to?: string; subject?: string; html?: string; text?: string };

function makeProfile(overrides: Partial<EmailProfileRow> = {}): EmailProfileRow {
  return {
    user_id: USER_ID,
    skills: ['TypeScript'],
    education: [],
    experiences: [],
    projects: [],
    preferences: {
      country: 'ID',
      positions: ['Backend Developer'],
      locations: ['DKI Jakarta'],
      levels: ['mid'],
      work_modes: ['onsite'],
      employment_types: ['full_time'],
      email_match_alerts: true,
    },
    ...overrides,
  };
}

function makeJob(overrides: Partial<EmailJobRow> = {}): EmailJobRow {
  return {
    id: JOB_A,
    title: 'Backend Developer',
    company: 'Acme',
    location: 'Jakarta Selatan, Indonesia',
    work_mode: 'onsite',
    employment_type: 'full_time',
    level: 'mid',
    education: null,
    skills: ['TypeScript'],
    status: 'open',
    deadline: '2030-01-01',
    description: null,
    ...overrides,
  };
}

function createDeps(overrides: Partial<MatchNotifyDeps> = {}) {
  const state = {
    sends: [] as SendRecord[],
    records: [] as SentNotificationRow[][],
    profileCalls: 0,
    jobCalls: 0,
  };
  const deps: MatchNotifyDeps = {
    listProfiles: async () => {
      state.profileCalls += 1;
      return [];
    },
    listJobs: async () => {
      state.jobCalls += 1;
      return [];
    },
    listSentPairs: async () => new Set<string>(),
    listSources: async () => [],
    getEmail: async () => 'throwaway@example.com',
    send: async (message) => {
      state.sends.push(message as SendRecord);
    },
    recordSent: async (rows) => {
      state.records.push(rows);
    },
    ...overrides,
  };
  return { deps, state };
}

function withoutEmailFlag(profile: EmailProfileRow): EmailProfileRow {
  const preferences = { ...(profile.preferences as Record<string, unknown>) };
  delete preferences.email_match_alerts;
  return { ...profile, preferences };
}

assert.equal(MATCH_EMAIL_THRESHOLD, 70, 'Ambang batas harus 70');

const thresholdResult = selectDigestCandidates({
  items: [
    { job_id: JOB_A, score: 69, matched: ['TypeScript'] },
    { job_id: JOB_B, score: 70, matched: ['TypeScript'] },
  ],
  jobs: [makeJob({ id: JOB_A }), makeJob({ id: JOB_B })],
  sourcesByJobId: new Map(),
  sentJobIds: new Set(),
});
assert.deepEqual(
  thresholdResult.map((job) => job.jobId),
  [JOB_B],
  '69 tidak boleh dikirim; 70 harus dikirim',
);
console.log('PASS threshold: 69 skipped, 70 included');

const dedupResult = selectDigestCandidates({
  items: [
    { job_id: JOB_A, score: 90, matched: ['TypeScript'] },
    { job_id: JOB_B, score: 80, matched: ['TypeScript'] },
  ],
  jobs: [makeJob({ id: JOB_A }), makeJob({ id: JOB_B })],
  sourcesByJobId: new Map(),
  sentJobIds: new Set([JOB_A]),
});
assert.deepEqual(
  dedupResult.map((job) => job.jobId),
  [JOB_B],
  'Lowongan yang sudah tercatat tidak boleh dikirim ulang',
);
console.log('PASS dedup: previously sent job skipped');

const capItems = Array.from({ length: 8 }, (_, index) => ({
  job_id: `job-${index}`,
  score: 95 - index,
  matched: ['TypeScript'],
}));
const capJobs = Array.from({ length: 8 }, (_, index) =>
  makeJob({ id: `job-${index}`, title: `Backend Developer ${index}` }),
);
const capResult = selectDigestCandidates({
  items: capItems,
  jobs: capJobs,
  sourcesByJobId: new Map(),
  sentJobIds: new Set(),
});
assert.equal(capResult.length, 5, 'Satu digest maksimal 5 lowongan');
assert.deepEqual(
  capResult.map((job) => job.score),
  [95, 94, 93, 92, 91],
  'Skor tertinggi harus tampil lebih dulu',
);
console.log('PASS digest cap: 5 jobs, highest score first');

assert.equal(isEmailAlertsEnabled({ email_match_alerts: false }), false);
assert.equal(isEmailAlertsEnabled({}), true, 'Nilai bawaan opt-in harus true');
const optedOut = createDeps({
  listProfiles: async () => [
    makeProfile({
      preferences: {
        country: 'ID',
        positions: ['Backend Developer'],
        locations: ['DKI Jakarta'],
        levels: [],
        work_modes: ['onsite'],
        employment_types: [],
        email_match_alerts: false,
      },
    }),
  ],
  listJobs: async () => [makeJob()],
});
const optedOutResult = await runMatchNotify({
  smtpConfig: SMTP,
  unsubscribeSecret: SECRET,
  siteUrl: SITE_URL,
  deps: optedOut.deps,
});
assert.equal(optedOutResult.data.sent, 0);
assert.equal(optedOut.state.sends.length, 0);
assert.equal(optedOut.state.records.length, 0);
assert.equal(optedOut.state.jobCalls, 0);
console.log('PASS opt-out: opted-out user gets no email and no write');

const missingKeyRun = createDeps({
  listProfiles: async () => [withoutEmailFlag(makeProfile())],
  listJobs: async () => [makeJob()],
});
const missingKeyResult = await runMatchNotify({
  smtpConfig: SMTP,
  unsubscribeSecret: SECRET,
  siteUrl: SITE_URL,
  deps: missingKeyRun.deps,
});
assert.equal(missingKeyResult.data.opted_in_profiles, 1, 'Kunci yang hilang harus tetap opt-in');
assert.equal(missingKeyResult.data.sent, 1);
assert.equal(missingKeyRun.state.sends.length, 1);
console.log('PASS default opt-in: missing email_match_alerts key still opts user in');

const noJobsRun = createDeps({
  listProfiles: async () => [makeProfile()],
  listJobs: async () => [],
});
const noJobsResult = await runMatchNotify({
  smtpConfig: SMTP,
  unsubscribeSecret: SECRET,
  siteUrl: SITE_URL,
  deps: noJobsRun.deps,
});
assert.equal(noJobsResult.skipped, 'no_open_jobs');
assert.equal(noJobsResult.data.opted_in_profiles, 1, 'Skip result harus mempertahankan jumlah profil');
console.log('PASS skip reporting: opted-in profile count preserved on skip');

assert.equal(readSmtpConfig({}), null);
assert.equal(
  readSmtpConfig({
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_USER: 'rakitkarier@gmail.com',
    MAIL_FROM: 'RakitKarier <rakitkarier@gmail.com>',
  }),
  null,
  'SMTP_PASS wajib ada',
);
const noSmtp = createDeps();
const noSmtpResult = await runMatchNotify({
  smtpConfig: null,
  unsubscribeSecret: SECRET,
  siteUrl: SITE_URL,
  deps: noSmtp.deps,
});
assert.equal(noSmtpResult.skipped, 'smtp_not_configured');
assert.equal(noSmtp.state.profileCalls, 0);
assert.equal(noSmtp.state.sends.length, 0);
assert.equal(noSmtp.state.records.length, 0);
console.log('PASS smtp skip: no read, no send, no recorded notification');

const token = signUnsubscribeToken(USER_ID, SECRET);
assert.equal(verifyUnsubscribeToken(token, SECRET), USER_ID);
const lastCharacter = token.at(-1) ?? 'A';
const tamperedToken = `${token.slice(0, -1)}${lastCharacter === 'A' ? 'B' : 'A'}`;
assert.equal(verifyUnsubscribeToken(tamperedToken, SECRET), null);
assert.equal(verifyUnsubscribeToken(token, 'another-secret'), null);
console.log('PASS unsubscribe token: valid accepted, tampered/wrong secret rejected');

assert.equal(readUnsubscribeSecret({ CRON_SECRET: 'cron-only-secret' }), null);
assert.equal(readUnsubscribeSecret({ EMAIL_UNSUBSCRIBE_SECRET: 'dedicated-secret' }), 'dedicated-secret');
console.log('PASS secret isolation: unsubscribe no longer falls back to CRON_SECRET');

const message = buildDigestEmail(
  [
    {
      jobId: JOB_A,
      title: 'Backend Developer',
      company: 'Acme',
      location: 'Jakarta',
      workMode: 'onsite',
      score: 78,
      reasons: ['Syarat skill terpenuhi: TypeScript'],
      sourceName: 'LinkedIn',
      sourceUrl: 'https://www.linkedin.com/jobs/view/1',
    },
  ],
  {
    recommendationsUrl: `${SITE_URL}/recommendations`,
    unsubscribeUrl: `${SITE_URL}/api/email/unsubscribe?token=${token}`,
  },
);
assert.equal(message.subject, 'RakitKarier: 1 lowongan cocok untukmu (≥70%)');
assert.match(message.text, /Lowongan ini cocok karena akurasi kecocokan dengan profilmu 78% \(di atas 70%\)/);
assert.match(message.text, /Detail & Sumber Asli: https:\/\/www\.linkedin\.com\/jobs\/view\/1/);
assert.match(message.html, /Berhenti berlangganan/);
assert.match(message.html, /Lihat semua rekomendasi/);
console.log('PASS email content: subject, reason, source link, footer');

const sentRun = createDeps({
  listProfiles: async () => [makeProfile()],
  listJobs: async () => [makeJob()],
  listSources: async () => [
    {
      job_id: JOB_A,
      source_name: 'linkedin_guest',
      source_url: 'https://www.linkedin.com/jobs/view/2',
      fetched_at: '2026-11-20T00:00:00.000Z',
    },
  ],
});
const sentResult = await runMatchNotify({
  smtpConfig: SMTP,
  unsubscribeSecret: SECRET,
  siteUrl: SITE_URL,
  deps: sentRun.deps,
});
assert.equal(sentResult.data.sent, 1, 'Runner must send a ready user with a >=70 match');
assert.equal(sentRun.state.sends.length, 1);
assert.equal(sentResult.data.candidates, 1);
assert.equal(sentRun.state.records.length, 1);
assert.equal(sentRun.state.records[0]?.[0]?.job_id, JOB_A);
assert.match(sentRun.state.sends[0]?.subject ?? '', /^RakitKarier: 1 lowongan/);
assert.match(sentRun.state.sends[0]?.html ?? '', /LinkedIn/);
console.log('PASS runner: send then record notification');

console.log('ALL MATCH EMAIL TESTS PASSED');
