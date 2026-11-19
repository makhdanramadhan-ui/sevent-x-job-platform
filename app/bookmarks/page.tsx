'use client';

import Link from 'next/link';
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
  PageBanner,
  WORK_MODE_LABELS,
} from '@/components/ui';
import type { BookmarkRecord } from '@/lib/contracts';

function BookmarksInner() {
  const [items, setItems] = useState<BookmarkRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadBookmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<{ items: BookmarkRecord[] }>('/api/bookmarks');
    if (res.ok) {
      setItems(res.data.items);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  async function handleRemove(jobId: string, title?: string) {
    setRemovingId(jobId);
    setNotice(null);
    const res = await apiFetch<{ job_id: string; deleted: boolean }>(
      `/api/bookmarks/${encodeURIComponent(jobId)}`,
      { method: 'DELETE' },
    );
    setRemovingId(null);

    if (!res.ok) {
      setNotice({ type: 'error', text: res.error.message });
      return;
    }

    setItems((prev) => prev.filter((item) => item.job_id !== jobId));
    setNotice({
      type: 'success',
      text: title
        ? `Lowongan "${title}" telah dihapus dari daftar tersimpan.`
        : 'Lowongan dihapus dari daftar tersimpan.',
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBanner
        kicker="Daftar Pilihan"
        title={`Lowongan Tersimpan (${items.length})`}
        subtitle="Daftar lowongan yang kamu simpan untuk ditinjau kembali sebelum melamar di situs resmi perusahaan."
        tone="sage"
        imageSrc="/images/banner-bookmarks.jpg"
        imageAlt="Ilustrasi lowongan tersimpan"
        actions={
          <>
            <Link href="/jobs" className="btn btn-primary btn-sm">
              + Cari Lowongan Lainnya
            </Link>
            <Link href="/recommendations" className="btn btn-outline btn-sm">
              Lihat Rekomendasi
            </Link>
          </>
        }
      />

      {notice ? (
        <NoticeBanner variant={notice.type} onDismiss={() => setNotice(null)}>
          {notice.text}
        </NoticeBanner>
      ) : null}

      {loading ? (
        <LoadingState
          title="Memuat lowongan tersimpan..."
          description="Mohon tunggu sebentar."
          lines={4}
        />
      ) : error ? (
        <ErrorState
          error={error}
          title="Belum Dapat Memuat Lowongan Tersimpan"
          onRetry={loadBookmarks}
          loginRedirectPath="/bookmarks"
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum Ada Lowongan yang Disimpan"
          description="Simpan lowongan yang menarik perhatianmu saat mencari lowongan agar lebih mudah dibandingkan dan dilamar nanti."
          action={
            <Link href="/jobs" className="btn btn-primary btn-sm">
              Cari Lowongan Sekarang
            </Link>
          }
        />
      ) : (
        <div className="jobs-list">
          {items.map((record) => {
            const job = record.jobs;
            if (!job) {
              return (
                <article key={record.job_id} className="surface-card">
                  <div className="job-card-header">
                    <div>
                      <Badge variant="warning">Data Lowongan Tidak Tersedia</Badge>
                      <h2 style={{ fontSize: '1.1rem', margin: '6px 0 4px' }}>
                        ID Lowongan: <code className="font-mono">{record.job_id}</code>
                      </h2>
                      <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                        Disimpan pada {formatDateTimeId(record.created_at)}. Data lowongan ini
                        mungkin sudah tidak tersedia di basis data.
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={removingId === record.job_id}
                      onClick={() => handleRemove(record.job_id)}
                    >
                      Hapus Bookmark
                    </Button>
                  </div>
                </article>
              );
            }

            return (
              <article key={record.job_id} className="surface-card-interactive">
                <div className="job-card-header">
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: 6,
                      }}
                    >
                      <JobStatusBadge status={job.status} />
                      <span className="job-timestamp">
                        Disimpan: {formatDateTimeId(record.created_at)}
                      </span>
                      <span className="job-timestamp">
                        · Diambil: {formatDateTimeId(job.last_fetched_at)}
                      </span>
                    </div>

                    <h2 className="font-editorial" style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>
                      <Link href={`/jobs/${job.id}`} style={{ textDecoration: 'none' }}>
                        {job.title}
                      </Link>
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        fontWeight: 600,
                        color: 'var(--ink-secondary)',
                        fontSize: '0.93rem',
                      }}
                    >
                      {job.company} ·{' '}
                      <span style={{ fontWeight: 400 }}>
                        {job.location || 'Lokasi tidak dicantumkan'}
                      </span>
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Link href={`/jobs/${job.id}`} className="btn btn-primary btn-sm">
                      Detail &amp; Sumber Asli
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={removingId === record.job_id}
                      onClick={() => handleRemove(record.job_id, job.title)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>

                <div className="job-meta-row">
                  <Badge variant="neutral">{WORK_MODE_LABELS[job.work_mode]}</Badge>
                  <Badge variant="neutral">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
                  <Badge variant="neutral">{EXPERIENCE_LEVEL_LABELS[job.level]}</Badge>
                  {job.deadline ? (
                    <Badge variant="warning">Tenggat: {formatDateId(job.deadline)}</Badge>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <AuthGuard title="Masuk untuk Melihat Lowongan Tersimpan">
      {() => <BookmarksInner />}
    </AuthGuard>
  );
}
