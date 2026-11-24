import assert from 'node:assert/strict';
import { checkSystemHealth } from '../lib/health';

const FIXED_DATE = new Date('2026-11-24T03:30:00.000Z');

// 1. Healthy state when DB responds and SMTP is configured
const healthyReport = await checkSystemHealth({
  isSupabaseConfigured: () => true,
  pingDatabase: async () => {},
  isSmtpConfigured: () => true,
  now: () => FIXED_DATE,
});
assert.equal(healthyReport.status, 'healthy');
assert.equal(healthyReport.timestamp, '2026-11-24T03:30:00.000Z');
assert.equal(healthyReport.checks.database.status, 'ok');
assert.equal(typeof healthyReport.checks.database.latency_ms, 'number');
assert.equal(healthyReport.checks.email.status, 'configured');
console.log('PASS healthy: DB ok + SMTP configured -> healthy');

// 2. Healthy even if SMTP is unconfigured (web still serves jobs)
const noSmtpReport = await checkSystemHealth({
  isSupabaseConfigured: () => true,
  pingDatabase: async () => {},
  isSmtpConfigured: () => false,
  now: () => FIXED_DATE,
});
assert.equal(noSmtpReport.status, 'healthy');
assert.equal(noSmtpReport.checks.database.status, 'ok');
assert.equal(noSmtpReport.checks.email.status, 'unconfigured');
console.log('PASS degraded-email: DB ok + SMTP unconfigured -> healthy');

// 3. Unhealthy when Supabase env is missing
const unconfiguredReport = await checkSystemHealth({
  isSupabaseConfigured: () => false,
  pingDatabase: async () => {
    throw new Error('should not be called');
  },
  isSmtpConfigured: () => true,
  now: () => FIXED_DATE,
});
assert.equal(unconfiguredReport.status, 'unhealthy');
assert.equal(unconfiguredReport.checks.database.status, 'unconfigured');
console.log('PASS unconfigured: missing Supabase env -> unhealthy');

// 4. Unhealthy when DB query fails, without leaking raw error message
const dbErrorReport = await checkSystemHealth({
  isSupabaseConfigured: () => true,
  pingDatabase: async () => {
    throw new Error('secret-connection-string-leak');
  },
  isSmtpConfigured: () => true,
  now: () => FIXED_DATE,
});
assert.equal(dbErrorReport.status, 'unhealthy');
assert.equal(dbErrorReport.checks.database.status, 'error');
assert.equal(JSON.stringify(dbErrorReport).includes('secret-connection-string-leak'), false);
console.log('PASS db-error: DB failure -> unhealthy without leaking error text');

console.log('ALL HEALTH CHECK TESTS PASSED');
