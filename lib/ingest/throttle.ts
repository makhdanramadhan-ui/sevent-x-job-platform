import type { SupabaseClient } from '@supabase/supabase-js';

const INGEST_BUCKET = 'job_ingest_keyword';
const INGEST_WINDOW_SECONDS = 6 * 60 * 60;


const PROFILE_TRIGGER_BUCKET = 'job_ingest_profile_trigger';
const PROFILE_TRIGGER_WINDOW_SECONDS = 15 * 60;

export async function claimProfileIngestTrigger(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  if (!userId.trim()) return false;
  const { data, error } = await admin.rpc('consume_rate_limit', {
    bucket: PROFILE_TRIGGER_BUCKET,
    key: userId,
    max: 1,
    window_seconds: PROFILE_TRIGGER_WINDOW_SECONDS,
  });
  if (error) {
    throw new Error(`consume_rate_limit failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object' || !('allowed' in row)) return false;
  return row.allowed === true;
}

export async function claimKeywordThrottle(
  admin: SupabaseClient,
  keyword: string,
): Promise<boolean> {
  const key = keyword.trim().toLowerCase();
  if (!key) return false;
  const { data, error } = await admin.rpc('consume_rate_limit', {
    bucket: INGEST_BUCKET,
    key,
    max: 1,
    window_seconds: INGEST_WINDOW_SECONDS,
  });
  if (error) {
    throw new Error(`consume_rate_limit failed: ${error.message}`);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return false;
  const allowed = (row as { allowed?: unknown }).allowed;
  return allowed === true;
}

export async function filterThrottledKeywords(
  admin: SupabaseClient,
  keywords: string[],
): Promise<string[]> {
  const allowed: string[] = [];
  for (const keyword of keywords) {
    try {
      if (await claimKeywordThrottle(admin, keyword)) {
        allowed.push(keyword);
      }
    } catch {
      // If throttle check fails, skip claiming this keyword to avoid hammering.
    }
  }
  return allowed;
}
