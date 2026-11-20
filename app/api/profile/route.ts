import { after, type NextRequest } from 'next/server';
import { readAvatarPath, removeAllUserAvatarObjects, setAvatarPath } from '@/lib/avatar';
import { requireAuth } from '@/lib/auth';
import { throwDb } from '@/lib/db';
import { readSupabaseAdminEnv } from '@/lib/env';
import { ok, readJson, run } from '@/lib/http';
import { collectUserKeywords, runKeywordIngest } from '@/lib/ingest';
import { extractProfileKeywords } from '@/lib/profile-keywords';
import { parseProfile } from '@/lib/profile';
import { canonicalizeSkillNames, tryLoadSkillCatalog } from '@/lib/skills';
import { createAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PROFILE_COLUMNS =
  'user_id, full_name, headline, phone, location, links, skills, education, experiences, projects, organizations, achievements, preferences, created_at, updated_at';

function keywordDiff(newKeywords: string[], oldKeywords: string[]): string[] {
  const oldSet = new Set(oldKeywords.map((k) => k.toLowerCase()));
  const result: string[] = [];
  const seen = new Set<string>();
  for (const kw of newKeywords) {
    const key = kw.toLowerCase();
    if (oldSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(kw);
  }
  return result;
}

export async function GET(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const { data, error } = await auth.supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) throwDb(error);
    return ok(data);
  });
}

export async function PUT(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const input = parseProfile(await readJson(req, 64 * 1024));
    const catalog = await tryLoadSkillCatalog(auth.supabase);
    const canonical = canonicalizeSkillNames(input.skills, catalog);
    const normalizedInput = { ...input, skills: canonical };

    let oldKeywords: string[] = [];
    const adminEnv = readSupabaseAdminEnv();
    if (adminEnv) {
      try {
        const admin = createAdminClient(adminEnv);
        oldKeywords = await collectUserKeywords(admin, auth.user.id);
      } catch {
        oldKeywords = [];
      }
    }

    const { data, error } = await auth.supabase
      .from('profiles')
      .upsert({ user_id: auth.user.id, ...normalizedInput }, { onConflict: 'user_id' })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throwDb(error);

    if (adminEnv) {
      const newKeywords = extractProfileKeywords({
        skills: Array.isArray(data?.skills) ? data.skills : normalizedInput.skills,
        preferences: (data?.preferences ?? normalizedInput.preferences) as any,
      } as any).keywords;
      const changed = keywordDiff(newKeywords, oldKeywords);
      if (changed.length > 0) {
        after(async () => {
          try {
            const admin = createAdminClient(adminEnv);
            const ingestOptions = { respectThrottle: true, userId: auth.user.id };
            await runKeywordIngest(admin, changed, ingestOptions);
          } catch {
            // background ingest failure must not affect profile save response
          }
        });
      }
    }

    return ok(data);
  });
}

export async function DELETE(req: NextRequest) {
  return run(async () => {
    const auth = await requireAuth(req);
    const adminEnv = readSupabaseAdminEnv();
    if (adminEnv) {
      await removeAllUserAvatarObjects(adminEnv, auth.user.id);
      if (readAvatarPath(auth.user)) {
        const appMeta = (auth.user.app_metadata ?? {}) as Record<string, unknown>;
        await setAvatarPath(adminEnv, auth.user.id, appMeta, null);
      }
    }
    const { data, error } = await auth.supabase.rpc('delete_my_data');
    if (error) throwDb(error);
    return ok({ cleared: data, auth_account_deleted: false });
  });
}
