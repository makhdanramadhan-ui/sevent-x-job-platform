import { createClient } from '@supabase/supabase-js';
import { canonicalizeCatalogValues, normalizeCatalogText } from '../lib/catalog-core';
import { loadSkillCatalog } from '../lib/skills';

type JobRow = { id: string; skills: string[] | null };

type Report = {
  mode: 'dry-run' | 'apply';
  jobsScanned: number;
  jobsUpdated: number;
  skillsBefore: number;
  skillsAfter: number;
  canonicalized: number;
  dropped: number;
  examples: Array<{ job_id: string; before: string[]; after: string[] }>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 500;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi.');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main(): Promise<void> {
  const rows = await loadSkillCatalog(supabase);
  const index = new Map<string, string>();
  for (const row of rows) {
    for (const candidate of [row.name, ...(Array.isArray(row.aliases) ? row.aliases : [])]) {
      const key = normalizeCatalogText(candidate);
      if (key && !index.has(key)) index.set(key, row.name);
    }
  }

  const report: Report = {
    mode: APPLY ? 'apply' : 'dry-run',
    jobsScanned: 0,
    jobsUpdated: 0,
    skillsBefore: 0,
    skillsAfter: 0,
    canonicalized: 0,
    dropped: 0,
    examples: [],
  };

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, skills')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal membaca jobs: ${error.message}`);
    const jobs = (data ?? []) as JobRow[];
    if (jobs.length === 0) break;

    for (const job of jobs) {
      report.jobsScanned += 1;
      const before = Array.isArray(job.skills) ? job.skills.filter((s) => typeof s === 'string') : [];
      const resolved = canonicalizeCatalogValues(before, index);
      const after = resolved.values;
      report.skillsBefore += before.length;
      report.skillsAfter += after.length;
      report.canonicalized += after.filter((skill) => !before.includes(skill)).length;
      report.dropped += before.length - after.length;
      if (before.join('\n') === after.join('\n')) continue;

      report.jobsUpdated += 1;
      if (report.examples.length < 12) {
        report.examples.push({ job_id: job.id, before, after });
      }
      if (APPLY) {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ skills: after })
          .eq('id', job.id);
        if (updateError) throw new Error(`Gagal update ${job.id}: ${updateError.message}`);
      }
    }
    if (jobs.length < PAGE_SIZE) break;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
