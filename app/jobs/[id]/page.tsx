'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  Badge,
  Button,
  EMPLOYMENT_TYPE_LABELS,
  EmptyState,
  ErrorState,
  EXPERIENCE_LEVEL_LABELS,
  formatDateId,
  formatDateTimeId,
  JobStatusBadge,
  LoadingState,
  NoticeBanner,
  WORK_MODE_LABELS,
} from '@/components/ui';
import type { BookmarkRecord, JobDetail } from '@/lib/contracts';
import { parseJobDescriptionBlocks } from '@/lib/job-description';
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
          alt={company}
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

  const descriptionBlocks = job.description ? parseJobDescriptionBlocks(job.description) : [];

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
            {isBookmarked ? '★ Tersimpan di Bookmark' : '☆ Simpan Lowongan'}
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
        <div
          className="form-grid-3"
          style={{
            padding: '14px 16px',
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.86rem',
          }}
        >
          <div>
            <span className="font-mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)', display: 'block' }}>
              SYARAT PENDIDIKAN
            </span>
            <strong>{job.education || 'Tidak dicantumkan'}</strong>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)', display: 'block' }}>
              TENGGAT PENDAFTARAN
            </span>
            <strong>{formatDateId(job.deadline)}</strong>
          </div>
          <div>
            <span className="font-mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)', display: 'block' }}>
              PERTAMA TERLIHAT DI SISTEM
            </span>
            <strong>{formatDateTimeId(job.first_seen_at)}</strong>
          </div>
        </div>
      </section>

      {/* Skills & Description */}
      <div className="form-grid-2" style={{ alignItems: 'start' }}>
        <section className="ledger-card" aria-labelledby="heading-description">
          <h2 id="heading-description" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 12 }}>
            Deskripsi &amp; Kualifikasi Lowongan
          </h2>
          {descriptionBlocks.length > 0 ? (
            <div style={{ fontSize: '0.94rem', color: 'var(--ink-primary)' }}>
              {descriptionBlocks.map((block, index) => {
                const isLast = index === descriptionBlocks.length - 1;
                if (block.type === 'heading') {
                  return (
                    <h3
                      key={`${index}-${block.text}`}
                      style={{
                        margin: index === 0 ? '0 0 8px' : '18px 0 8px',
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: 'var(--ink-primary)',
                        lineHeight: 1.45,
                        textAlign: 'left',
                      }}
                    >
                      {block.text}
                    </h3>
                  );
                }
                if (block.type === 'list') {
                  return (
                    <ul
                      key={`list-${index}`}
                      style={{
                        margin: isLast ? 0 : '0 0 12px',
                        paddingLeft: '1.35rem',
                        fontSize: '0.94rem',
                        lineHeight: 1.7,
                        textAlign: 'justify',
                        hyphens: 'auto',
                      }}
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
                    style={{
                      margin: isLast ? 0 : '0 0 12px',
                      fontSize: '0.94rem',
                      lineHeight: 1.75,
                      textAlign: 'justify',
                      hyphens: 'auto',
                      textIndent: '1.75rem',
                    }}
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

          {job.skills && job.skills.length > 0 ? (
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.92rem', marginBottom: 10 }}>
                Keahlian yang Dibutuhkan
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {job.skills.map((skill) => (
                  <Badge key={skill} variant="neutral">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* Original Sources & Application Guidance */}
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

                return (
                  <div key={src.id} className="surface-card">
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: '1rem' }}>{displaySourceName(src.source_name)}</strong>
                      <span className="font-mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)' }}>
                        ID Sumber: {src.source_job_id}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: '0.82rem',
                        color: 'var(--ink-secondary)',
                        marginBottom: 14,
                      }}
                    >
                      <span>
                        <strong>Waktu ambil data:</strong> {formatDateTimeId(src.fetched_at)}
                      </span>
                      <span>
                        <strong>Tanggal publikasi sumber:</strong>{' '}
                        {formatDateId(src.published_at)}
                      </span>
                      {hasValidUrl ? (
                        <span
                          className="font-mono"
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--ink-muted)',
                            wordBreak: 'break-all',
                          }}
                        >
                          URL: {src.source_url}
                        </span>
                      ) : null}
                    </div>

                    {hasValidUrl ? (
                      <a
                        href={src.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                      >
                        Buka &amp; Lamar di Sumber Asli ({displaySourceName(src.source_name)})
                      </a>
                    ) : (
                      <p className="form-error-text">
                        Tautan sumber asli tidak tersedia atau tidak valid.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <AuthGuard title="Masuk untuk Melihat Detail & Sumber Lowongan">
      {() => <JobDetailInner />}
    </AuthGuard>
  );
}
