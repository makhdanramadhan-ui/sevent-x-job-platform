'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  type ApiCallError,
  apiFetch,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  formatDateId,
  formatDateTimeId,
  WORK_MODE_LABELS,
} from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { EmptyState, ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Badge, Button, JobStatusBadge } from '@/components/ui/forms';
import type { BookmarkRecord, JobDetail } from '@/lib/contracts';
import { type DescriptionBlock, parseJobDescriptionBlocks } from '@/lib/job-description';
import { displaySourceName } from '@/lib/job-source';

function BackToFeedLink() {
  return (
    <Link
      href="/jobs"
      className="btn btn-outline btn-sm"
      aria-label="Kembali ke Feed Lowongan"
      title="Kembali ke Feed Lowongan"
      style={{
        width: 38,
        height: 38,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    </Link>
  );
}

function getCompanyInitials(company: string): string {
  const words = company
    .replace(/\b(PT|CV|Tbk|Indonesia|Persero|Inc|Ltd|LLC|Corp|GmbH)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    const fallback = company.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 2).toUpperCase();
    return fallback || 'RK';
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isUsableLogoUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return !/static\.licdn\.com|ghost|spacer/i.test(trimmed);
}

function extractSourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

function SourceSiteLogo({ host }: { host: string | null }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;

  return (
    <span className="job-source-card__icon" aria-hidden="true">
      {faviconUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={faviconUrl}
          alt=""
          width={20}
          height={20}
          decoding="async"
          className="job-source-card__logo-img"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth === 0) {
              setFailed(true);
            }
          }}
        />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
    </span>
  );
}

const EXTRA_HEADING_PREFIXES = [
  'Why Join',
  'Why Work With',
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

  // Question subheadings like "Why Join Coalition Technologies?" or "What Will You Do?"
  if (cleaned.endsWith('?') && words.length <= 8) {
    return true;
  }

  // Known heading prefixes (e.g. "Preferred Skills", "About Coalition Technologies")
  const lower = cleaned.toLowerCase();
  if (
    EXTRA_HEADING_PREFIXES.some((prefix) => lower === prefix.toLowerCase() || lower.startsWith(`${prefix.toLowerCase()} `)) ||
    /^about\s+[a-z0-9]/i.test(cleaned)
  ) {
    return words.length <= 7;
  }

  // Short Title-Case standalone lines (2-6 words, no sentence punctuation)
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

    // Check for inline subheadings glued inside a paragraph
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

function DetailCompanyLogo({
  company,
  logoUrl,
}: {
  company: string;
  logoUrl?: string | null;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canRenderLogo = isUsableLogoUrl(logoUrl) && failedUrl !== logoUrl;

  return (
    <div
      className="job-feed-card__logo"
      aria-hidden="true"
      title={company}
      style={{
        width: 'clamp(52px, 8vw, 68px)',
        height: 'clamp(52px, 8vw, 68px)',
        borderRadius: 14,
        fontSize: '1.15rem',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {canRenderLogo ? (
        <img
          src={logoUrl}
          alt=""
          width={68}
          height={68}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl ?? null)}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (
              naturalWidth === 0 ||
              (logoUrl?.includes('google.com/s2/favicons') &&
                naturalWidth <= 16 &&
                naturalHeight <= 16)
            ) {
              setFailedUrl(logoUrl ?? null);
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 6,
            backgroundColor: '#ffffff',
          }}
        />
      ) : (
        getCompanyInitials(company)
      )}
    </div>
  );
}

function JobDetailInner() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === 'string' ? params.id : '';

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedSourceId, setCopiedSourceId] = useState<string | null>(null);

  async function handleCopySourceUrl(sourceId: string, url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedSourceId(sourceId);
      window.setTimeout(() => {
        setCopiedSourceId((prev) => (prev === sourceId ? null : prev));
      }, 2000);
    } catch {
      setNotice({ type: 'error', text: 'Gagal menyalin tautan. Silakan salin secara manual.' });
    }
  }

  const loadDetail = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);

    const [jobRes, bmRes] = await Promise.all([
      apiFetch<JobDetail>(`/api/jobs/${encodeURIComponent(jobId)}`),
      apiFetch<{ items: BookmarkRecord[] }>('/api/bookmarks'),
    ]);

    if (jobRes.ok) {
      setJob(jobRes.data);
    } else {
      setError(jobRes.error);
    }

    if (bmRes.ok) {
      setIsBookmarked(bmRes.data.items.some((item) => item.job_id === jobId));
    }

    setLoading(false);
  }, [jobId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleToggleBookmark() {
    if (!job) return;
    setTogglingBookmark(true);
    setNotice(null);

    if (isBookmarked) {
      const res = await apiFetch<{ job_id: string; deleted: boolean }>(
        `/api/bookmarks/${job.id}`,
        { method: 'DELETE' },
      );
      setTogglingBookmark(false);
      if (!res.ok) {
        setNotice({ type: 'error', text: res.error.message });
        return;
      }
      setIsBookmarked(false);
      setNotice({ type: 'success', text: 'Lowongan dihapus dari daftar tersimpan.' });
    } else {
      const res = await apiFetch<{ job_id: string; saved: boolean }>('/api/bookmarks', {
        method: 'POST',
        body: { job_id: job.id },
      });
      setTogglingBookmark(false);
      if (!res.ok) {
        setNotice({ type: 'error', text: res.error.message });
        return;
      }
      setIsBookmarked(true);
      setNotice({ type: 'success', text: 'Lowongan berhasil disimpan ke Bookmark.' });
    }
  }

  if (loading) {
    return (
      <LoadingState
        title="Memuat detail lowongan & sumber asli..."
        description="Mengambil informasi lengkap lowongan beserta riwayat job_sources."
        lines={5}
        reserved
      />
    );
  }

  if (error || !job) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <BackToFeedLink />
        </div>
        {error ? (
          <ErrorState
            error={error}
            title="Detail Lowongan Tidak Dapat Dimuat"
            onRetry={loadDetail}
            loginRedirectPath={`/jobs/${jobId}`}
          />
        ) : null}
      </div>
    );
  }

  const descriptionBlocks = job.description
    ? enhanceDescriptionBlocks(parseJobDescriptionBlocks(job.description))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Top Breadcrumb & Quick Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <BackToFeedLink />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button
            variant={isBookmarked ? 'secondary' : 'outline'}
            size="sm"
            loading={togglingBookmark}
            onClick={handleToggleBookmark}
            aria-pressed={isBookmarked}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill={isBookmarked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
              <span>{isBookmarked ? 'Tersimpan di Bookmark' : 'Simpan Lowongan'}</span>
            </span>
          </Button>
        </div>
      </div>

      {notice ? (
        <NoticeBanner variant={notice.type} onDismiss={() => setNotice(null)}>
          {notice.text}
        </NoticeBanner>
      ) : null}

      {/* Main Header Card */}
      <section className="ledger-card">
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
            <JobStatusBadge status={job.status} />
            <Badge variant="neutral">{WORK_MODE_LABELS[job.work_mode]}</Badge>
            <Badge variant="neutral">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
            <Badge variant="neutral">{EXPERIENCE_LEVEL_LABELS[job.level]}</Badge>
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
            <h1 className="page-title" style={{ marginBottom: 6 }}>
              {job.title}
            </h1>
            <p style={{ margin: 0, fontSize: '1.08rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
              {job.company} ·{' '}
              <span style={{ fontWeight: 400 }}>{job.location || 'Lokasi tidak dicantumkan'}</span>
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
      </section>

      {/* Skills & Description */}
      <div className="job-detail-layout">
        <section className="ledger-card job-detail-main" aria-labelledby="heading-description">
          <h2 id="heading-description" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 14 }}>
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
            <h2 id="heading-sources" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 8 }}>
              Tautan Resmi Pelamaran
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Klik tombol di bawah untuk membuka halaman rekrutmen resmi dan mengirim lamaranmu secara
              langsung.
            </p>

            {!job.job_sources || job.job_sources.length === 0 ? (
              <EmptyState
                title="Tautan Pendaftaran Belum Tersedia"
                description="Saat ini tautan menuju halaman pendaftaran resmi untuk lowongan ini belum tersedia."
              />
            ) : (
              <div className="form-stack">
                {job.job_sources.map((src) => {
                  const hasValidUrl =
                    typeof src.source_url === 'string' &&
                    (src.source_url.startsWith('http://') || src.source_url.startsWith('https://'));
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
                          <button
                            type="button"
                            className={`job-source-card__url ${copiedSourceId === src.id ? 'job-source-card__url--copied' : ''}`}
                            title="Klik untuk menyalin tautan"
                            aria-label={
                              copiedSourceId === src.id
                                ? 'Tautan berhasil disalin'
                                : `Salin tautan ${src.source_url}`
                            }
                            onClick={() => handleCopySourceUrl(src.id, src.source_url)}
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            <span className="job-source-card__url-text">{src.source_url}</span>
                            <span className="job-source-card__copy-tag">
                              {copiedSourceId === src.id ? (
                                <>
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                  Tersalin
                                </>
                              ) : (
                                <>
                                  <svg
                                    width="13"
                                    height="13"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  Salin
                                </>
                              )}
                            </span>
                          </button>

                          <a
                            href={src.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            style={{ width: '100%' }}
                          >
                            Buka &amp; Lamar di {sourceLabel}
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
              <h2 id="heading-skills" className="font-editorial" style={{ fontSize: '1.1rem', marginBottom: 12 }}>
                Keahlian yang Dibutuhkan
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ledger-card job-detail-cv-card" aria-labelledby="heading-cv-prep">
            <h2 id="heading-cv-prep" className="font-editorial" style={{ fontSize: '1.08rem', marginBottom: 6 }}>
              Siapkan CV Sebelum Melamar
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: 'var(--ink-secondary)', lineHeight: 1.55 }}>
              Sesuaikan ringkasan pengalaman dan keahlianmu dengan kualifikasi posisi ini agar lamaran lebih menonjol.
            </p>
            <Link href="/cv" prefetch={false} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
              Buka Studio CV
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <AuthGuard title="Masuk untuk Melihat Detail & Sumber Lowongan" headingAs="h1">
      {() => <JobDetailInner />}
    </AuthGuard>
  );
}
