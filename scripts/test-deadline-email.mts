import assert from 'node:assert/strict';
import {
  buildDeadlineEmail,
  calculateDaysUntilDeadline,
  formatDeadlineDateId,
  getEligibleReminderDay,
  isDeadlineAlertsEnabled,
} from '../lib/email/deadline-message';
import {
  DeadlineNotificationsTableUnavailableError,
  isMissingDeadlineNotificationsTable,
  reminderNotificationKey,
  runDeadlineNotify,
  skippedDeadlineNotifyResult,
  type DeadlineNotifyDeps,
  type EmailBookmarkRow,
  type EmailProfilePreferenceRow,
  type SentDeadlineNotificationRow,
} from '../lib/email/deadline-runner';
import type { SmtpConfig } from '../lib/email/transport';

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
const REF_DATE = '2026-11-22';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const JOB_H3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const JOB_H1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const JOB_H2 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const JOB_NO_DEADLINE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const JOB_CLOSED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

type SendRecord = { to?: string; subject?: string; html?: string; text?: string };

function makeBookmark(
  userId: string,
  jobId: string,
  jobOverrides: Partial<NonNullable<EmailBookmarkRow['jobs']>> = {},
): EmailBookmarkRow {
  return {
    user_id: userId,
    job_id: jobId,
    jobs: {
      id: jobId,
      title: 'Software Engineer',
      company: 'Tech Corp',
      location: 'Jakarta',
      work_mode: 'hybrid',
      status: 'open',
      deadline: '2026-11-25', // default H-3 from 2026-11-22
      ...jobOverrides,
    },
  };
}

function createDeps(overrides: Partial<DeadlineNotifyDeps> = {}) {
  const state = {
    sends: [] as SendRecord[],
    records: [] as SentDeadlineNotificationRow[][],
    bookmarkCalls: 0,
    profileCalls: 0,
  };

  const deps: DeadlineNotifyDeps = {
    listBookmarks: async () => {
      state.bookmarkCalls += 1;
      return [];
    },
    listProfiles: async (userIds) => {
      state.profileCalls += 1;
      return userIds.map((user_id) => ({ user_id, preferences: {} }));
    },
    listSentReminders: async () => new Set<string>(),
    listSources: async (jobIds) =>
      jobIds.map((job_id) => ({
        id: `src-${job_id}`,
        job_id,
        source_name: 'Tech Careers',
        source_job_id: `ext-${job_id}`,
        source_url: `https://techcorp.example.com/apply/${job_id}`,
        published_at: '2026-11-01T00:00:00Z',
        fetched_at: '2026-11-02T00:00:00Z',
        created_at: '2026-11-02T00:00:00Z',
      })),
    getEmail: async (userId) => `${userId.slice(0, 8)}@example.com`,
    send: async (msg) => {
      state.sends.push(msg as SendRecord);
    },
    recordSent: async (rows) => {
      state.records.push(rows);
    },
    ...overrides,
  };

  return { deps, state };
}

console.log('=== TEST SUITE: DEADLINE EMAIL NOTIFICATIONS ===');

// --- Unit Helper Tests ---
{
  assert.equal(calculateDaysUntilDeadline('2026-11-25', '2026-11-22'), 3);
  assert.equal(calculateDaysUntilDeadline('2026-11-23', '2026-11-22'), 1);
  assert.equal(calculateDaysUntilDeadline('2026-11-24', '2026-11-22'), 2);
  assert.equal(calculateDaysUntilDeadline('2026-11-22', '2026-11-22'), 0);
  assert.equal(calculateDaysUntilDeadline('2026-11-20', '2026-11-22'), -2);
  assert.equal(calculateDaysUntilDeadline(null, '2026-11-22'), null);
  assert.equal(calculateDaysUntilDeadline('', '2026-11-22'), null);

  assert.equal(getEligibleReminderDay('2026-11-25', '2026-11-22'), 3);
  assert.equal(getEligibleReminderDay('2026-11-23', '2026-11-22'), 1);
  assert.equal(getEligibleReminderDay('2026-11-24', '2026-11-22'), null);
  assert.equal(getEligibleReminderDay(null, '2026-11-22'), null);

  assert.equal(formatDeadlineDateId('2026-11-25'), '25 November 2026');
  assert.equal(formatDeadlineDateId(null), 'Tidak dicantumkan');

  console.log('PASS: Date calculation & formatting helper tests');
}

// --- Test A: Lowongan tanpa deadline dilewati (skipped) ---
{
  const bookmarks = [
    makeBookmark(USER_A, JOB_NO_DEADLINE, { deadline: null }),
    makeBookmark(USER_A, 'empty-deadline', { deadline: '   ' }),
    makeBookmark(USER_A, JOB_CLOSED, { status: 'closed', deadline: '2026-11-25' }),
  ];

  const { deps, state } = createDeps({
    listBookmarks: async () => bookmarks,
  });

  const result = await runDeadlineNotify({
    smtpConfig: SMTP,
    unsubscribeSecret: SECRET,
    siteUrl: SITE_URL,
    referenceDate: REF_DATE,
    deps,
  });

  assert.equal(result.data.sent, 0);
  assert.equal(result.data.candidates, 0);
  assert.equal(result.data.skipped_no_deadline, 2);
  assert.equal(result.data.skipped, 'no_eligible_bookmarks');
  assert.equal(state.sends.length, 0);
  assert.equal(state.records.length, 0);

  console.log('PASS (a): Lowongan tanpa deadline atau berstatus closed dilewati');
}

// --- Test B: Lowongan H-3 dan H-1 disertakan sesuai reminder_day ---
{
  const bookmarks = [
    makeBookmark(USER_A, JOB_H3, { deadline: '2026-11-25' }), // H-3 -> eligible (day 3)
    makeBookmark(USER_A, JOB_H1, { deadline: '2026-11-23' }), // H-1 -> eligible (day 1)
    makeBookmark(USER_A, JOB_H2, { deadline: '2026-11-24' }), // H-2 -> not eligible
    makeBookmark(USER_A, 'h4-job', { deadline: '2026-11-26' }), // H-4 -> not eligible
    makeBookmark(USER_A, 'h0-job', { deadline: '2026-11-22' }), // H-0 -> not eligible
    makeBookmark(USER_A, 'past-job', { deadline: '2026-11-20' }), // Past -> not eligible
  ];

  const { deps, state } = createDeps({
    listBookmarks: async () => bookmarks,
  });

  const result = await runDeadlineNotify({
    smtpConfig: SMTP,
    unsubscribeSecret: SECRET,
    siteUrl: SITE_URL,
    referenceDate: REF_DATE,
    deps,
  });

  assert.equal(result.data.ok, true);
  assert.equal(result.data.candidates, 2);
  assert.equal(result.data.sent, 2);
  assert.equal(result.data.skipped_not_reminder_day, 4);
  assert.equal(state.sends.length, 2);

  const flatRecords = state.records.flat();
  assert.equal(flatRecords.length, 2);

  const h3Record = flatRecords.find((r) => r.job_id === JOB_H3);
  assert.ok(h3Record);
  assert.equal(h3Record.reminder_day, 3);

  const h1Record = flatRecords.find((r) => r.job_id === JOB_H1);
  assert.ok(h1Record);
  assert.equal(h1Record.reminder_day, 1);

  console.log('PASS (b): Lowongan H-3 dan H-1 disertakan sesuai reminder_day (3 dan 1)');
}

// --- Test C: Lowongan yang sudah pernah terkirim dilewati (no duplicate) ---
{
  const bookmarks = [
    makeBookmark(USER_A, JOB_H3, { deadline: '2026-11-25' }), // H-3
    makeBookmark(USER_A, JOB_H1, { deadline: '2026-11-23' }), // H-1
  ];

  // Simulasi: JOB_H3 untuk reminder_day 3 SUDAH PERNAH terkirim sebelumnya
  const sentSet = new Set([reminderNotificationKey(USER_A, JOB_H3, 3)]);

  const { deps, state } = createDeps({
    listBookmarks: async () => bookmarks,
    listSentReminders: async () => sentSet,
  });

  const result = await runDeadlineNotify({
    smtpConfig: SMTP,
    unsubscribeSecret: SECRET,
    siteUrl: SITE_URL,
    referenceDate: REF_DATE,
    deps,
  });

  assert.equal(result.data.sent, 1);
  assert.equal(result.data.skipped_already_sent, 1);
  assert.equal(state.sends.length, 1);

  // Hanya JOB_H1 (reminder_day 1) yang terkirim
  const flatRecords = state.records.flat();
  assert.equal(flatRecords.length, 1);
  assert.equal(flatRecords[0].job_id, JOB_H1);
  assert.equal(flatRecords[0].reminder_day, 1);

  // Jika keduanya sudah terkirim, tidak ada email yang terkirim
  sentSet.add(reminderNotificationKey(USER_A, JOB_H1, 1));
  const { deps: deps2, state: state2 } = createDeps({
    listBookmarks: async () => bookmarks,
    listSentReminders: async () => sentSet,
  });

  const result2 = await runDeadlineNotify({
    smtpConfig: SMTP,
    unsubscribeSecret: SECRET,
    siteUrl: SITE_URL,
    referenceDate: REF_DATE,
    deps: deps2,
  });

  assert.equal(result2.data.sent, 0);
  assert.equal(result2.data.skipped_already_sent, 2);
  assert.equal(result2.data.skipped, 'all_already_sent');
  assert.equal(state2.sends.length, 0);

  console.log('PASS (c): Lowongan yang sudah pernah terkirim di bookmark_deadline_notifications dilewati');
}

// --- Test D: Pengguna yang mematikan notifikasi dilewati ---
{
  assert.equal(isDeadlineAlertsEnabled({ email_deadline_alerts: false }), false);
  assert.equal(isDeadlineAlertsEnabled({ email_match_alerts: false }), false);
  assert.equal(isDeadlineAlertsEnabled({ email_deadline_alerts: true }), true);
  assert.equal(isDeadlineAlertsEnabled({}), true);
  assert.equal(isDeadlineAlertsEnabled(null), true);

  const bookmarks = [
    makeBookmark(USER_A, JOB_H3, { deadline: '2026-11-25' }),
    makeBookmark(USER_B, JOB_H3, { deadline: '2026-11-25' }),
  ];

  // USER_A mematikan email_deadline_alerts, USER_B membiarkan aktif
  const { deps, state } = createDeps({
    listBookmarks: async () => bookmarks,
    listProfiles: async (userIds) =>
      userIds.map((uid) => ({
        user_id: uid,
        preferences: uid === USER_A ? { email_deadline_alerts: false } : {},
      })),
  });

  const result = await runDeadlineNotify({
    smtpConfig: SMTP,
    unsubscribeSecret: SECRET,
    siteUrl: SITE_URL,
    referenceDate: REF_DATE,
    deps,
  });

  assert.equal(result.data.sent, 1);
  assert.equal(result.data.skipped_opt_out, 1);
  assert.equal(state.sends.length, 1);
  assert.ok(state.sends[0].to?.includes(USER_B.slice(0, 8)));

  console.log('PASS (d): Pengguna yang mematikan notifikasi dilewati');
}

// --- Test E: Format subject dan body email valid ---
{
  const email = buildDeadlineEmail(
    {
      id: 'job-123',
      title: 'Frontend <Lead> & Architect',
      company: 'Tokopedia & Gojek',
      location: 'Jakarta',
      workMode: 'hybrid',
      deadline: '2026-11-25',
      reminderDay: 3,
      sourceUrl: 'https://careers.tokopedia.com/apply/123',
      sourceName: 'Tokopedia Careers',
    },
    {
      applyUrl: 'https://careers.tokopedia.com/apply/123',
      profileUrl: 'https://rakitkarier.vercel.app/profile',
      cvUrl: 'https://rakitkarier.vercel.app/cv',
      unsubscribeUrl: 'https://rakitkarier.vercel.app/api/email/unsubscribe?token=abc',
    },
  );

  // 1. Verifikasi subjek
  assert.equal(
    email.subject,
    '⏳ [Pengingat Tenggat] Pendaftaran Lowongan Akan Ditutup: Frontend <Lead> & Architect di Tokopedia & Gojek',
  );

  // 2. Verifikasi body HTML
  assert.ok(email.html.includes('25 November 2026'), 'HTML harus memuat tanggal tenggat');
  assert.ok(email.html.includes('H-3: Pendaftaran Ditutup dalam 3 Hari'), 'HTML harus memuat badge H-3');
  assert.ok(
    email.html.includes('&lt;Lead&gt; &amp; Architect'),
    'Karakter khusus HTML di title harus di-escape',
  );
  assert.ok(
    email.html.includes('Tokopedia &amp; Gojek'),
    'Karakter khusus HTML di company harus di-escape',
  );
  assert.ok(
    email.html.includes('https://careers.tokopedia.com/apply/123'),
    'HTML harus memuat tombol / tautan Lamar Sekarang ke sumber asli',
  );
  assert.ok(
    email.html.includes('https://rakitkarier.vercel.app/cv'),
    'HTML harus memuat tautan buat/perbarui CV di RakitKarier',
  );
  assert.ok(
    email.html.includes('https://rakitkarier.vercel.app/profile'),
    'HTML harus memuat tautan profil / preferensi',
  );
  assert.ok(
    email.html.includes('https://rakitkarier.vercel.app/api/email/unsubscribe?token=abc'),
    'HTML harus memuat tautan berhenti berlangganan',
  );

  // 3. Verifikasi plain text
  assert.ok(email.text.includes('Frontend <Lead> & Architect'), 'Plain text title');
  assert.ok(email.text.includes('25 November 2026'), 'Plain text deadline date');
  assert.ok(
    email.text.includes('https://careers.tokopedia.com/apply/123'),
    'Plain text apply url',
  );
  assert.ok(email.text.includes('https://rakitkarier.vercel.app/cv'), 'Plain text CV url');
  assert.ok(
    email.text.includes('https://rakitkarier.vercel.app/api/email/unsubscribe?token=abc'),
    'Plain text unsubscribe url',
  );

  // 4. Verifikasi variasi H-1
  const emailH1 = buildDeadlineEmail(
    {
      id: 'job-h1',
      title: 'Backend Engineer',
      company: 'Bukalapak',
      location: null,
      workMode: null,
      deadline: '2026-11-23',
      reminderDay: 1,
    },
    {
      applyUrl: 'https://rakitkarier.vercel.app/jobs/job-h1',
      profileUrl: 'https://rakitkarier.vercel.app/profile',
      cvUrl: 'https://rakitkarier.vercel.app/cv',
      unsubscribeUrl: 'https://rakitkarier.vercel.app/api/email/unsubscribe?token=xyz',
    },
  );

  assert.ok(emailH1.html.includes('H-1: Pendaftaran Ditutup Besok!'), 'HTML memuat badge H-1');
  assert.ok(emailH1.html.includes('23 November 2026'), 'HTML memuat tanggal H-1');

  console.log('PASS (e): Format subjek dan body email valid (HTML escaping, tanggal, action links)');
}

// --- Test Missing Table Safety ---
{
  assert.equal(
    isMissingDeadlineNotificationsTable({ code: '42P01', message: 'relation does not exist' }),
    true,
  );
  assert.equal(
    isMissingDeadlineNotificationsTable({ code: 'PGRST205', message: 'table not in schema cache' }),
    true,
  );
  assert.equal(
    isMissingDeadlineNotificationsTable({ message: 'relation bookmark_deadline_notifications does not exist' }),
    true,
  );
  assert.equal(
    isMissingDeadlineNotificationsTable({ code: '23505', message: 'duplicate key value' }),
    false,
  );

  const fallback = skippedDeadlineNotifyResult('notifications_table_missing');
  assert.equal(fallback.data.ok, true);
  assert.equal(fallback.skipped, 'notifications_table_missing');

  console.log('PASS: Penanganan error missing notifications table aman');
}

console.log('\nALL DEADLINE EMAIL TESTS PASSED SUCCESSFULLY!');
