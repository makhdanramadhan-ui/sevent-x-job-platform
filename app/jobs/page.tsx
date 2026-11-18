'use client';

import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
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
  FormField,
  formatDateId,
  formatDateTimeId,
  JOB_STATUS_LABELS,
  JobStatusBadge,
  LoadingState,
  NoticeBanner,
  SelectInput,
  SITE_NAME,
  TextInput,
  WORK_MODE_LABELS,
} from '@/components/ui';
import {
  type BookmarkRecord,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  type EmploymentType,
  type ExperienceLevel,
  JOB_STATUSES,
  type Job,
  type JobStatus,
  WORK_MODES,
  type WorkMode,
} from '@/lib/contracts';

type JobsApiResponse = {
  items: Job[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

type FilterState = {
  q: string;
  location: string;
  work_mode: '' | WorkMode;
  employment_type: '' | EmploymentType;
  level: '' | ExperienceLevel;
  status: '' | JobStatus;
};

const INITIAL_FILTERS: FilterState = {
  q: '',
  location: '',
  work_mode: '',
  employment_type: '',
  level: '',
  status: '',
};

function cleanSearchQuery(raw: string): string {
  return raw.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

function JobsFeedInner() {
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);
  const limit = 12;

  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);

  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const loadBookmarks = useCallback(async () => {
    const res = await apiFetch<{ items: BookmarkRecord[] }>('/api/bookmarks');
    if (res.ok) {
      setBookmarkedIds(new Set(res.data.items.map((b) => b.job_id)));
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));

    const cleanedQ = cleanSearchQuery(appliedFilters.q);
    if (cleanedQ) params.set('q', cleanedQ.slice(0, 100));

    const cleanedLoc = cleanSearchQuery(appliedFilters.location);
    if (cleanedLoc) params.set('location', cleanedLoc.slice(0, 100));

    if (appliedFilters.work_mode) params.set('work_mode', appliedFilters.work_mode);
    if (appliedFilters.employment_type) {
      params.set('employment_type', appliedFilters.employment_type);
    }
    if (appliedFilters.level) params.set('level', appliedFilters.level);
    if (appliedFilters.status) params.set('status', appliedFilters.status);

    const res = await apiFetch<JobsApiResponse>(`/api/jobs?${params.toString()}`);
    if (res.ok) {
      setData(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [appliedFilters, page]);

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function handleApplyFilters(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function handleResetFilters() {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setPage(1);
  }

  async function handleToggleBookmark(job: Job) {
    setTogglingId(job.id);
    setActionNotice(null);
    const isSaved = bookmarkedIds.has(job.id);

    if (isSaved) {
      const res = await apiFetch<{ job_id: string; deleted: boolean }>(
        `/api/bookmarks/${job.id}`,
        { method: 'DELETE' },
      );
      setTogglingId(null);
      if (!res.ok) {
        setActionNotice({ type: 'error', text: res.error.message });
        return;
      }
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
      setActionNotice({
        type: 'success',
        text: `Lowongan "${job.title}" dihapus dari daftar tersimpan.`,
      });
    } else {
      const res = await apiFetch<{ job_id: string; saved: boolean }>('/api/bookmarks', {
        method: 'POST',
        body: { job_id: job.id },
      });
      setTogglingId(null);
      if (!res.ok) {
        setActionNotice({ type: 'error', text: res.error.message });
        return;
      }
      setBookmarkedIds((prev) => new Set(prev).add(job.id));
      setActionNotice({
        type: 'success',
        text: `Lowongan "${job.title}" berhasil disimpan ke Bookmark.`,
      });
    }
  }

  const hasActiveFilters = Boolean(
    appliedFilters.q ||
      appliedFilters.location ||
      appliedFilters.work_mode ||
      appliedFilters.employment_type ||
      appliedFilters.level ||
      appliedFilters.status,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <span className="page-kicker">BURSA LOWONGAN TERAGREGASI · INDONESIA</span>
          <h1 className="page-title">Feed Lowongan Kerja</h1>
          <p className="page-subtitle">
            Telusuri peluang kerja lintas bidang dan tingkat pengalaman di Indonesia. Pencantuman
            lowongan bukan klaim verifikasi keamanan; periksa selalu detail dan melamar langsung di
            sumber asli.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/recommendations" className="btn btn-secondary btn-sm">
            Cek Kecocokan Profil →
          </Link>
          <Link href="/bookmarks" className="btn btn-outline btn-sm">
            Lowongan Tersimpan ({bookmarkedIds.size})
          </Link>
        </div>
      </div>

      {actionNotice ? (
        <NoticeBanner
          variant={actionNotice.type}
          onDismiss={() => setActionNotice(null)}
        >
          {actionNotice.text}
        </NoticeBanner>
      ) : null}

      <div className="jobs-layout">
        {/* Sidebar Filter Form */}
        <aside className="ledger-card" aria-label="Filter pencarian lowongan">
          <span className="page-kicker">PENYARINGAN DATA</span>
          <h2 className="font-editorial" style={{ fontSize: '1.2rem', marginBottom: 14 }}>
            Filter Lowongan
          </h2>

          <form onSubmit={handleApplyFilters} className="form-stack">
            <FormField id="filter-q" label="Kata Kunci (Judul / Perusahaan)">
              <TextInput
                id="filter-q"
                maxLength={100}
                placeholder="Mis. Backend, Analis, BUMN..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </FormField>

            <FormField id="filter-location" label="Lokasi">
              <TextInput
                id="filter-location"
                maxLength={100}
                placeholder="Mis. Jakarta, Bandung..."
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              />
            </FormField>

            <FormField id="filter-work-mode" label="Mode Kerja">
              <SelectInput
                id="filter-work-mode"
                value={filters.work_mode}
                onChange={(e) =>
                  setFilters({ ...filters, work_mode: e.target.value as FilterState['work_mode'] })
                }
              >
                <option value="">Semua Mode Kerja</option>
                {WORK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {WORK_MODE_LABELS[mode]}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField id="filter-employment-type" label="Jenis Kontrak">
              <SelectInput
                id="filter-employment-type"
                value={filters.employment_type}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    employment_type: e.target.value as FilterState['employment_type'],
                  })
                }
              >
                <option value="">Semua Jenis Kontrak</option>
                {EMPLOYMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EMPLOYMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField id="filter-level" label="Tingkat Pengalaman">
              <SelectInput
                id="filter-level"
                value={filters.level}
                onChange={(e) =>
                  setFilters({ ...filters, level: e.target.value as FilterState['level'] })
                }
              >
                <option value="">Semua Tingkat Pengalaman</option>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {EXPERIENCE_LEVEL_LABELS[lvl]}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField id="filter-status" label="Status Lowongan">
              <SelectInput
                id="filter-status"
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value as FilterState['status'] })
                }
              >
                <option value="">Semua Status</option>
                {JOB_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {JOB_STATUS_LABELS[st]}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <Button type="submit" variant="primary">
                Terapkan Filter
              </Button>
              {hasActiveFilters ? (
                <Button type="button" variant="outline" onClick={handleResetFilters}>
                  Reset Filter
                </Button>
              ) : null}
            </div>
          </form>
        </aside>

        {/* Main Feed List */}
        <section aria-label="Daftar hasil lowongan">
          {loading ? (
            <LoadingState
              title="Mengambil daftar lowongan..."
              description="Memuat data lowongan nyata dari endpoint /api/jobs."
              lines={5}
            />
          ) : error ? (
            <ErrorState
              error={error}
              title="Gagal Memuat Feed Lowongan"
              onRetry={loadJobs}
              loginRedirectPath="/jobs"
            />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              kicker={hasActiveFilters ? 'HASIL PENCARIAN KOSONG' : 'BASIS DATA LOWONGAN KOSONG'}
              title={
                hasActiveFilters
                  ? 'Tidak Ada Lowongan yang Sesuai Filter'
                  : 'Belum Ada Data Lowongan Tersedia'
              }
              description={
                hasActiveFilters
                  ? 'Tidak ditemukan lowongan di basis data yang cocok dengan kombinasi kata kunci atau filter yang Anda pilih. Coba longgarkan kriteria pencarian.'
                  : `Saat ini belum ada data lowongan hasil pengambilan (ingestion) di basis data. Sesuai komitmen kejujuran platform, ${SITE_NAME} tidak menampilkan data contoh palsu sebagai lowongan hasil scraping.`
              }
              action={
                hasActiveFilters ? (
                  <Button variant="primary" size="sm" onClick={handleResetFilters}>
                    Reset Semua Filter
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={loadJobs}>
                    Muat Ulang Data
                  </Button>
                )
              }
            />
          ) : (
            <div className="jobs-list">
              <div
                className="surface-card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <span className="font-mono" style={{ fontSize: '0.8rem' }}>
                  Menampilkan <strong>{data.items.length}</strong> dari total{' '}
                  <strong>{data.total}</strong> lowongan (Halaman {data.page} dari{' '}
                  {Math.max(1, data.pages)})
                </span>
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                    Bersihkan Filter ×
                  </Button>
                ) : null}
              </div>

              {data.items.map((job) => {
                const isSaved = bookmarkedIds.has(job.id);
                return (
                  <article key={job.id} className="surface-card-interactive">
                    <div className="job-card-header">
                      <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                          <JobStatusBadge status={job.status} />
                          <span className="job-timestamp">
                            Diambil: {formatDateTimeId(job.last_fetched_at)}
                          </span>
                        </div>
                        <h2 className="font-editorial" style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>
                          <Link
                            href={`/jobs/${job.id}`}
                            style={{ textDecoration: 'none' }}
                          >
                            {job.title}
                          </Link>
                        </h2>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--ink-secondary)', fontSize: '0.93rem' }}>
                          {job.company} ·{' '}
                          <span style={{ fontWeight: 400 }}>
                            {job.location || 'Lokasi tidak dicantumkan'}
                          </span>
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Button
                          variant={isSaved ? 'secondary' : 'outline'}
                          size="sm"
                          loading={togglingId === job.id}
                          onClick={() => handleToggleBookmark(job)}
                          aria-pressed={isSaved}
                        >
                          {isSaved ? '★ Tersimpan' : '☆ Simpan'}
                        </Button>
                        <Link href={`/jobs/${job.id}`} className="btn btn-primary btn-sm">
                          Detail &amp; Sumber →
                        </Link>
                      </div>
                    </div>

                    <div className="job-meta-row">
                      <Badge variant="neutral">{WORK_MODE_LABELS[job.work_mode]}</Badge>
                      <Badge variant="neutral">{EMPLOYMENT_TYPE_LABELS[job.employment_type]}</Badge>
                      <Badge variant="neutral">{EXPERIENCE_LEVEL_LABELS[job.level]}</Badge>
                      {job.education ? (
                        <Badge variant="neutral">Pendidikan: {job.education}</Badge>
                      ) : null}
                      {job.deadline ? (
                        <Badge variant="warning">Tenggat: {formatDateId(job.deadline)}</Badge>
                      ) : null}
                    </div>

                    {job.skills && job.skills.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                        {job.skills.slice(0, 8).map((skill) => (
                          <span
                            key={skill}
                            className="font-mono"
                            style={{
                              fontSize: '0.73rem',
                              padding: '2px 8px',
                              background: 'var(--bg-subtle)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 3,
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 8 ? (
                          <span className="font-mono" style={{ fontSize: '0.73rem', color: 'var(--ink-muted)' }}>
                            +{job.skills.length - 8} lainnya
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {/* Pagination Controls */}
              {data.pages > 1 ? (
                <nav
                  aria-label="Navigasi halaman lowongan"
                  className="surface-card"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                    padding: '14px 18px',
                  }}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ← Sebelumnya
                  </Button>
                  <span className="font-mono" style={{ fontSize: '0.82rem' }}>
                    Halaman <strong>{data.page}</strong> dari <strong>{data.pages}</strong>
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                  >
                    Berikutnya →
                  </Button>
                </nav>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function JobsPage() {
  return (
    <AuthGuard title="Masuk untuk Membuka Feed Lowongan">
      {() => <JobsFeedInner />}
    </AuthGuard>
  );
}
