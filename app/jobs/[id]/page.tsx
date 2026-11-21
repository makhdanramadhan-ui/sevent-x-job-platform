import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  formatDateId,
  formatDateTimeId,
  JOB_STATUS_LABELS,
  WORK_MODE_LABELS,
} from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import { JobDetailAuthSection } from '@/components/ui/job-detail-auth-section';
import {
  CopySourceUrlButton,
  DetailCompanyLogo,
  JobDetailTopActions,
  SourceSiteLogo,
} from '@/components/ui/job-detail-islands';
import { isEmailProviderUser } from '@/lib/auth';
import type { JobDetail, JobStatus } from '@/lib/contracts';
import { readSupabaseEnv } from '@/lib/env';
import { type DescriptionBlock, parseJobDescriptionBlocks } from '@/lib/job-description';
import { displaySourceName } from '@/lib/job-source';
import { createCookieClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EXTRA_HEADING_PREFIXES = [
  'Why Join',
  'Why Work With',
  'Why Work at',
  'Why Us',
  'Why You Will Love',
  "Why You'll Love",
  'Preferred Skills',
  'Required Skills',
  'Core Skills',
  'Technical Skills',
  'Key Skills',
  'Skills & Experience',
  'Skills and Experience',
  'Skills & Qualifications',
  'Skills and Qualifications',
  'Nice to Have',
  'Nice-to-Have',
  'Bonus Points',
  'Good to Have',
  'What We Offer',
  "What We're Looking For",
  'What We Are Looking For',
  'What You Get',
  "What You'll Get",
  'What You Will Need',
  "What You'll Need",
  'Your Responsibilities',
  'Primary Responsibilities',
  'Duties & Responsibilities',
  'Duties and Responsibilities',
  'Core Responsibilities',
  'Job Summary',
  'Position Summary',
  'Role Summary',
  'Overview',
  'How to Apply',
  'Application Process',
  'Hiring Process',
  'Interview Process',
  'Compensation & Benefits',
  'Compensation and Benefits',
  'Compensation',
  'Salary & Benefits',
  'Perks & Benefits',
  'Work Schedule',
  'Schedule & Hours',
  'Equal Opportunity',
  'Tentang Posisi Ini',
  'Keahlian yang Dibutuhkan',
  'Nilai Tambah',
  'Cara Melamar',
  'Proses Rekrutmen',
];

const INLINE_EXTRA_HEADING_RE = new RegExp(
  `(^|[.!?]\\s+)(${EXTRA_HEADING_PREFIXES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}(?:\\s+[A-Z0-9][A-Za-z0-9&/'-]*){0,4}\\??)(?:\\s*:)?(?=\\s+[A-Z0-9]|\\s*$)`,
  'g',
);

const SMALL_TITLE_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  '&',
  '/',
  'dan',
  'yang',
  'di',
  'ke',
  'dari',
  'untuk',
  'pada',
]);

function isLikelySubheading(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 4 || trimmed.length > 76) return false;
  if (/[.!]$/.test(trimmed)) return false;

  const cleaned = trimmed.replace(/:$/, '').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 9) return false;

  if (cleaned.endsWith('?') && words.length <= 8) {
    return true;
  }

  const lower = cleaned.toLowerCase();
  if (
    EXTRA_HEADING_PREFIXES.some(
      (prefix) =>
        lower === prefix.toLowerCase() || lower.startsWith(`${prefix.toLowerCase()} `),
    ) ||
    /^about\s+[a-z0-9]/i.test(cleaned)
  ) {
    return words.length <= 7;
  }

  if (words.length >= 2 && words.length <= 6 && !/[,;()]/.test(cleaned)) {
    const capitalizedCount = words.filter(
      (word, idx) =>
        /^[A-Z0-9]/.test(word) || (idx > 0 && SMALL_TITLE_WORDS.has(word.toLowerCase())),
    ).length;
    if (capitalizedCount === words.length && words.some((w) => /^[A-Z]/.test(w))) {
      return true;
    }
  }

  return false;
}

function enhanceDescriptionBlocks(blocks: DescriptionBlock[]): DescriptionBlock[] {
  const result: DescriptionBlock[] = [];

  for (const block of blocks) {
    if (block.type !== 'paragraph') {
      result.push(block);
      continue;
    }

    const trimmed = block.text.trim();
    if (isLikelySubheading(trimmed)) {
      result.push({ type: 'heading', text: trimmed.replace(/:$/, '').trim() });
      continue;
    }

    const injected = trimmed.replace(
      INLINE_EXTRA_HEADING_RE,
      (_full, prefix: string, header: string) => {
        const lead = prefix ? `${prefix.trimEnd()}\n` : '';
        return `${lead}@@HEADING@@${header.replace(/:$/, '').trim()}\n`;
      },
    );

    if (!injected.includes('@@HEADING@@')) {
      result.push(block);
      continue;
    }

    for (const part of injected.split('\n')) {
      const piece = part.trim();
      if (!piece) continue;
      if (piece.startsWith('@@HEADING@@')) {
        result.push({ type: 'heading', text: piece.slice('@@HEADING@@'.length).trim() });
      } else if (isLikelySubheading(piece)) {
        result.push({ type: 'heading', text: piece.replace(/:$/, '').trim() });
      } else {
        result.push({ type: 'paragraph', text: piece });
      }
    }
  }

  return result;
}

function extractSourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function statusBadgeClass(status: JobStatus): string {
  if (status === 'open') return 'badge badge-open';
  if (status === 'closed') return 'badge badge-closed';
  return 'badge';
}

async function getServerJobDetail(jobId: string): Promise<{
  authenticated: boolean;
  job: JobDetail | null;
  isBookmarked: boolean;
}> {
  if (!UUID_RE.test(jobId)) {
    return { authenticated: false, job: null, isBookmarked: false };
  }

  const env = readSupabaseEnv();
  if (!env) {
    return { authenticated: false, job: null, isBookmarked: false };
  }

  const store = await cookies();
  const hasSessionCookie = store
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('auth-token'));
  if (!hasSessionCookie) {
    return { authenticated: false, job: null, isBookmarked: false };
  }

  try {
    const supabase = await createCookieClient(env);
    const [authRes, jobRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from('jobs')
        .select('*, job_sources(*)')
        .eq('id', jobId)
        .order('fetched_at', { referencedTable: 'job_sources', ascending: false })
        .maybeSingle(),
    ]);

    const { data: authData, error: authErr } = authRes;
    if (authErr || !authData.user) {
      return { authenticated: false, job: null, isBookmarked: false };
    }
    if (!authData.user.email_confirmed_at && isEmailProviderUser(authData.user)) {
      return { authenticated: false, job: null, isBookmarked: false };
    }

    if (jobRes.error || !jobRes.data) {
      return { authenticated: true, job: null, isBookmarked: false };
    }

    const bmRes = await supabase
      .from('bookmarks')
      .select('job_id')
      .eq('user_id', authData.user.id)
      .eq('job_id', jobId)
      .maybeSingle();

    return {
      authenticated: true,
      job: jobRes.data as JobDetail,
      isBookmarked: Boolean(bmRes.data),
    };
  } catch {
    return { authenticated: false, job: null, isBookmarked: false };
  }
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverResult = await getServerJobDetail(id);

  if (!serverResult.authenticated || !serverResult.job) {
    return (
      <div style={{ minHeight: '78vh' }}>
        <JobDetailAuthSection />
      </div>
    );
  }

  const { job, isBookmarked } = serverResult;
  const descriptionBlocks = job.description
    ? enhanceDescriptionBlocks(parseJobDescriptionBlocks(job.description))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <JobDetailTopActions jobId={job.id} initialBookmarked={isBookmarked} />

      {/* Main Header Card: gunakan <header> agar <h1> tidak berada di dalam <section> */}
      <header className="ledger-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={statusBadgeClass(job.status)}>
              {JOB_STATUS_LABELS[job.status] ?? job.status}
            </span>
            <span className="badge">{WORK_MODE_LABELS[job.work_mode]}</span>
            <span className="badge">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</span>
            <span className="badge">{EXPERIENCE_LEVEL_LABELS[job.level]}</span>
          </div>
          <span className="job-timestamp">
            Terakhir diambil: {formatDateTimeId(job.last_fetched_at)}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              className="page-title"
              style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginBottom: 6 }}
            >
              {job.title}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: '1.08rem',
                fontWeight: 600,
                color: 'var(--ink-secondary)',
              }}
            >
              {job.company} ·{' '}
              <span style={{ fontWeight: 400 }}>
                {job.location || 'Lokasi tidak dicantumkan'}
              </span>
            </p>
          </div>
          <DetailCompanyLogo company={job.company} logoUrl={job.company_logo_url} />
        </div>

        {/* Key Metadata Grid */}
        <div className="job-meta-grid">
          <div className="job-meta-tile">
            <span className="job-meta-tile__icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </span>
            <div className="job-meta-tile__body">
              <span className="job-meta-tile__label">Syarat Pendidikan</span>
              <span
                className={`job-meta-tile__value ${!job.education ? 'job-meta-tile__value--muted' : ''}`}
              >
                {job.education || 'Tidak dicantumkan'}
              </span>
            </div>
          </div>

          <div className="job-meta-tile">
            <span className="job-meta-tile__icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <div className="job-meta-tile__body">
              <span className="job-meta-tile__label">Tenggat Pendaftaran</span>
              <span
                className={`job-meta-tile__value ${!job.deadline ? 'job-meta-tile__value--muted' : ''}`}
              >
                {formatDateId(job.deadline)}
              </span>
            </div>
          </div>

          <div className="job-meta-tile">
            <span className="job-meta-tile__icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
            <div className="job-meta-tile__body">
              <span className="job-meta-tile__label">Tersedia Sejak</span>
              <span className="job-meta-tile__value">{formatDateTimeId(job.first_seen_at)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Skills & Description */}
      <div className="job-detail-layout">
        <section className="ledger-card job-detail-main" aria-labelledby="heading-description">
          <h2
            id="heading-description"
            className="font-editorial"
            style={{ fontSize: '1.3rem', marginBottom: 14 }}
          >
            Deskripsi &amp; Kualifikasi Lowongan
          </h2>
          {descriptionBlocks.length > 0 ? (
            <div className="job-desc-content">
              {descriptionBlocks.map((block, index) => {
                const isLast = index === descriptionBlocks.length - 1;
                if (block.type === 'heading') {
                  return (
                    <h3
                      key={`${index}-${block.text}`}
                      className={`job-desc-heading ${index === 0 ? 'job-desc-heading--first' : ''}`}
                    >
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul
                      key={`list-${index}`}
                      className="job-desc-list"
                      style={{ marginBottom: isLast ? 0 : 14 }}
                    >
                      {block.items.map((item, itemIdx) => (
                        <li
                          key={`item-${index}-${itemIdx}`}
                          style={{
                            marginBottom: itemIdx === block.items.length - 1 ? 0 : 6,
                          }}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p
                    key={`para-${index}`}
                    className="job-desc-para"
                    style={{ marginBottom: isLast ? 0 : 14 }}
                  >
                    {block.text}
                  </p>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              Deskripsi lengkap dapat dilihat langsung pada halaman resmi perusahaan di bagian
              samping.
            </p>
          )}
        </section>

        {/* Sticky Right Sidebar: Original Sources, Skills & CV Studio */}
        <aside className="job-detail-sidebar" aria-label="Informasi pelamaran dan keahlian">
          <section className="ledger-card" aria-labelledby="heading-sources">
            <h2
              id="heading-sources"
              className="font-editorial"
              style={{ fontSize: '1.3rem', marginBottom: 8 }}
            >
              Tautan Resmi Pelamaran
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Klik tombol di bawah untuk membuka halaman rekrutmen resmi dan mengirim lamaranmu
              secara langsung.
            </p>

            {!job.job_sources || job.job_sources.length === 0 ? (
              <div className="state-panel state-panel-empty">
                <strong style={{ fontWeight: 500 }}>Tautan Pendaftaran Belum Tersedia</strong>
                <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: 'var(--p-muted)' }}>
                  Saat ini tautan menuju halaman pendaftaran resmi untuk lowongan ini belum
                  tersedia.
                </p>
              </div>
            ) : (
              <div className="form-stack">
                {job.job_sources.map((src) => {
                  const hasValidUrl =
                    typeof src.source_url === 'string' &&
                    (src.source_url.startsWith('http://') ||
                      src.source_url.startsWith('https://'));
                  const sourceLabel = displaySourceName(src.source_name);
                  const sourceHost = hasValidUrl ? extractSourceHost(src.source_url) : null;

                  return (
                    <div key={src.id} className="job-source-card">
                      <div className="job-source-card__head">
                        <div className="job-source-card__brand">
                          <SourceSiteLogo host={sourceHost} />
                          <div className="job-source-card__title-wrap">
                            <strong className="job-source-card__name">{sourceLabel}</strong>
                            {sourceHost ? (
                              <span className="job-source-card__host">{sourceHost}</span>
                            ) : null}
                          </div>
                        </div>
                        <span className="job-source-card__verified">
                          <span className="job-source-card__verified-dot" aria-hidden="true" />
                          Portal Resmi
                        </span>
                      </div>

                      <div className="job-source-card__meta">
                        <div className="job-source-card__meta-item">
                          <span className="job-source-card__meta-label">Dipublikasikan</span>
                          <span className="job-source-card__meta-value">
                            {formatDateId(src.published_at)}
                          </span>
                        </div>
                        <div className="job-source-card__meta-item">
                          <span className="job-source-card__meta-label">Diperbarui</span>
                          <span className="job-source-card__meta-value">
                            {formatDateTimeId(src.fetched_at)}
                          </span>
                        </div>
                      </div>

                      {hasValidUrl ? (
                        <>
                          <CopySourceUrlButton sourceUrl={src.source_url} />
                          <a
                            href={src.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                          >
                            <ButtonText>Buka &amp; Lamar di {sourceLabel}</ButtonText>
                          </a>
                        </>
                      ) : (
                        <p className="form-error-text" style={{ margin: 0 }}>
                          Tautan sumber asli tidak tersedia atau tidak valid.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {job.skills && job.skills.length > 0 ? (
            <section className="ledger-card" aria-labelledby="heading-skills">
              <h2
                id="heading-skills"
                className="font-editorial"
                style={{ fontSize: '1.1rem', marginBottom: 12 }}
              >
                Keahlian yang Dibutuhkan
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {job.skills.map((skill) => (
                  <span key={skill} className="badge">
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ledger-card job-detail-cv-card" aria-labelledby="heading-cv-prep">
            <h2
              id="heading-cv-prep"
              className="font-editorial"
              style={{ fontSize: '1.08rem', marginBottom: 6 }}
            >
              Siapkan CV Sebelum Melamar
            </h2>
            <p
              style={{
                margin: '0 0 14px',
                fontSize: '0.84rem',
                color: 'var(--ink-secondary)',
                lineHeight: 1.55,
              }}
            >
              Sesuaikan ringkasan pengalaman dan keahlianmu dengan kualifikasi posisi ini agar
              lamaran lebih menonjol.
            </p>
            <Link
              href="/cv"
              prefetch={false}
              className="btn btn-outline btn-sm"
              style={{ width: '100%' }}
            >
              <ButtonText>Buka Studio CV</ButtonText>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
