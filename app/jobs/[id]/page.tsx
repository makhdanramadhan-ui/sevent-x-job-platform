'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  SITE_NAME,
  WORK_MODE_LABELS,
} from '@/components/ui';
import type { BookmarkRecord, JobDetail } from '@/lib/contracts';

function buildPosterDataUri(title: string, company: string, location: string | null): string {
  const safeTitle = title.slice(0, 44).replace(/[<>&"']/g, '');
  const safeCompany = company.slice(0, 40).replace(/[<>&"']/g, '');
  const safeLoc = (location || 'Indonesia').slice(0, 36).replace(/[<>&"']/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="240" viewBox="0 0 720 240">
    <rect width="720" height="240" fill="#ECE8DE" stroke="#171715" stroke-width="4"/>
    <rect x="20" y="20" width="680" height="200" fill="#FDFCF9" stroke="#171715" stroke-width="1.5"/>
    <text x="44" y="64" font-family="monospace" font-size="13" font-weight="700" fill="#B84221">ARSIP LOWONGAN ${SITE_NAME.toUpperCase()} · LEMBAR INFORMASI</text>
    <text x="44" y="114" font-family="Georgia, serif" font-size="24" font-weight="700" fill="#171715">${safeTitle}</text>
    <text x="44" y="152" font-family="sans-serif" font-size="17" font-weight="600" fill="#3F3D37">${safeCompany}</text>
    <text x="44" y="186" font-family="monospace" font-size="13" fill="#6B685F">Lokasi: ${safeLoc} · Detail teks utama tersedia di bawah</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function JobDetailInner() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === 'string' ? params.id : '';

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [togglingBookmark, setTogglingBookmark] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
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

  const posterSrc = useMemo(() => {
    if (!job) return '';
    return buildPosterDataUri(job.title, job.company, job.location);
  }, [job]);

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
          <Link href="/jobs" className="btn btn-outline btn-sm">
            ← Kembali ke Feed Lowongan
          </Link>
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

  const primarySource = job.job_sources?.[0] ?? null;

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
        <Link href="/jobs" className="btn btn-outline btn-sm">
          ← Kembali ke Feed Lowongan
        </Link>
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
          {primarySource?.source_url ? (
            <a
              href={primarySource.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
            >
              Lamar di Sumber Asli ({primarySource.source_name}) ↗
            </a>
          ) : null}
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

        <h1 className="page-title" style={{ marginBottom: 6 }}>
          {job.title}
        </h1>
        <p style={{ margin: '0 0 18px', fontSize: '1.08rem', fontWeight: 600, color: 'var(--ink-secondary)' }}>
          {job.company} ·{' '}
          <span style={{ fontWeight: 400 }}>{job.location || 'Lokasi tidak dicantumkan'}</span>
        </p>

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

      {/* Optional Visual Poster Card with Accessible Alt Text */}
      <section className="surface-card" aria-labelledby="heading-optional-poster">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: showPoster ? 12 : 0,
          }}
        >
          <div>
            <h2 id="heading-optional-poster" style={{ fontSize: '0.95rem', margin: 0 }}>
              Kartu Visual / Poster Lowongan (Opsional)
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
              Elemen visual bersifat opsional; seluruh informasi utama tetap tersedia dalam bentuk
              teks terstruktur di halaman ini.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPoster((prev) => !prev)}
            aria-expanded={showPoster}
          >
            {showPoster ? 'Sembunyikan Visual' : 'Tampilkan Visual'}
          </Button>
        </div>

        {showPoster ? (
          <figure style={{ margin: 0 }}>
            <img
              src={posterSrc}
              alt={`Kartu informasi lowongan ${job.title} di ${job.company}, lokasi ${job.location || 'Indonesia'}, status ${job.status}.`}
              style={{
                width: '100%',
                maxWidth: 720,
                height: 'auto',
                display: 'block',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            />
            <figcaption className="form-hint" style={{ marginTop: 6 }}>
              Teks alternatif gambar tersedia untuk pembaca layar. Apabila poster eksternal tidak
              disertakan oleh sumber, sistem menyajikan ringkasan kartu tipografis.
            </figcaption>
          </figure>
        ) : null}
      </section>

      {/* Skills & Description */}
      <div className="form-grid-2" style={{ alignItems: 'start' }}>
        <section className="ledger-card" aria-labelledby="heading-description">
          <span className="page-kicker">RINCIAN PEKERJAAN</span>
          <h2 id="heading-description" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 12 }}>
            Deskripsi &amp; Kualifikasi Lowongan
          </h2>
          {job.description ? (
            <div
              style={{
                whiteSpace: 'pre-line',
                fontSize: '0.94rem',
                color: 'var(--ink-primary)',
                lineHeight: 1.7,
              }}
            >
              {job.description}
            </div>
          ) : (
            <p style={{ margin: 0, color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              Deskripsi teks lengkap tidak disertakan pada ringkasan ini. Silakan buka halaman
              sumber asli di bagian samping untuk membaca pengumuman resmi penyelenggara rekrutmen.
            </p>
          )}

          {job.skills && job.skills.length > 0 ? (
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '0.92rem', marginBottom: 10 }}>
                Keahlian Terkait ({job.skills.length})
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
          <span className="page-kicker">VERIFIKASI SUMBER &amp; PELAMARAN</span>
          <h2 id="heading-sources" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 8 }}>
            Sumber Asli Lowongan ({job.job_sources?.length ?? 0})
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            {SITE_NAME} tidak melakukan auto-submit. Klik tombol sumber asli di bawah untuk membuka
            halaman rekrutmen resmi di tab baru. Tombol ini tidak mengubah status lamaran menjadi
            terkirim.
          </p>

          {!job.job_sources || job.job_sources.length === 0 ? (
            <EmptyState
              kicker="SUMBER TIDAK TERSEDIA"
              title="Tautan Sumber Asli Belum Tercatat"
              description="Lowongan ini belum memiliki catatan URL sumber eksternal (job_sources) di basis data."
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
                      <strong style={{ fontSize: '1rem' }}>{src.source_name}</strong>
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
                        Buka &amp; Lamar di Sumber Asli ({src.source_name}) ↗
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

          <div
            className="footer-disclaimer-box"
            style={{ marginTop: 18 }}
            role="note"
            aria-label="Catatan keamanan pelamaran"
          >
            <strong>Catatan Keamanan Pencari Kerja:</strong>
            <p style={{ margin: '4px 0 0' }}>
              Keberadaan lowongan di dalam sistem agregasi bukan pernyataan bahwa lowongan telah
              diverifikasi aman. Waspadai permintaan biaya dalam bentuk apa pun saat melamar di
              situs eksternal.
            </p>
          </div>
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
