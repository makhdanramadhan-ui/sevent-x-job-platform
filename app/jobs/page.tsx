'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  Button,
  EMPLOYMENT_TYPE_LABELS,
  EmptyState,
  ErrorState,
  EXPERIENCE_LEVEL_LABELS,
  formatDateId,
  JOB_STATUS_LABELS,
  JobStatusBadge,
  LoadingState,
  NoticeBanner,
  PageBanner,
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
import { getCompanyLogoUrl } from '@/lib/recommendation/company-logos';

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

type PillKey = 'employment_type' | 'work_mode' | 'level' | 'status';

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

function getCompanyInitials(company: string): string {
  const words = company
    .replace(/\b(PT|CV|Tbk|Indonesia|Persero)\b\.?/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return company.slice(0, 2).toUpperCase() || 'RK';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function CompanyLogoBox({
  company,
  className,
}: {
  company: string;
  className: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const logoUrl = getCompanyLogoUrl(company);

  return (
    <div
      className={className}
      aria-hidden="true"
      title={company}
      style={{ overflow: 'hidden' }}
    >
      {logoUrl && !imgFailed ? (
        <img
          src={logoUrl}
          alt={company}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 4,
            backgroundColor: '#ffffff',
          }}
        />
      ) : (
        getCompanyInitials(company)
      )}
    </div>
  );
}

function formatRelativeTimeId(dateIso: string | null | undefined): string {
  if (!dateIso) return 'Baru diperbarui';
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return 'Baru diperbarui';
  const diffMs = Date.now() - parsed.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins} menit yang lalu`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} hari yang lalu`;
  return formatDateId(dateIso);
}

function JobsFeedInner() {
  const router = useRouter();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [openPill, setOpenPill] = useState<PillKey | null>(null);
  const [page, setPage] = useState(1);
  const limit = 12;

  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const pillsRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((b) => b.job_id)),
    [bookmarks],
  );

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (pillsRef.current && !pillsRef.current.contains(event.target as Node)) {
        setOpenPill(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenPill(null);
    }
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadBookmarks = useCallback(async () => {
    const res = await apiFetch<{ items: BookmarkRecord[] }>('/api/bookmarks');
    if (res.ok) {
      setBookmarks(res.data.items);
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
    setOpenPill(null);
    setPage(1);
    setAppliedFilters({ ...filters });
  }

  function handleSelectPillFilter<K extends PillKey>(key: K, value: FilterState[K]) {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
    setOpenPill(null);
  }

  function handleResetFilters() {
    setFilters(INITIAL_FILTERS);
    setAppliedFilters(INITIAL_FILTERS);
    setOpenPill(null);
    setPage(1);
  }

  function handleHideJob(jobId: string) {
    setHiddenIds((prev) => new Set(prev).add(jobId));
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>, jobId: string) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    router.push(`/jobs/${jobId}`);
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
      setBookmarks((prev) => prev.filter((item) => item.job_id !== job.id));
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
      setBookmarks((prev) => [
        {
          job_id: job.id,
          created_at: new Date().toISOString(),
          jobs: job,
        },
        ...prev.filter((item) => item.job_id !== job.id),
      ]);
      setActionNotice({
        type: 'success',
        text: `Lowongan "${job.title}" berhasil disimpan ke daftar tersimpan.`,
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

  const visibleJobs = useMemo(
    () => (data?.items ?? []).filter((job) => !hiddenIds.has(job.id)),
    [data, hiddenIds],
  );

  const pillDefs: Array<{
    key: PillKey;
    label: string;
    activeLabel: string | null;
    options: Array<{ value: string; label: string }>;
  }> = [
    {
      key: 'employment_type',
      label: 'Jenis',
      activeLabel: appliedFilters.employment_type
        ? EMPLOYMENT_TYPE_LABELS[appliedFilters.employment_type]
        : null,
      options: [
        { value: '', label: 'Semua Jenis' },
        ...EMPLOYMENT_TYPES.map((value) => ({
          value,
          label: EMPLOYMENT_TYPE_LABELS[value],
        })),
      ],
    },
    {
      key: 'work_mode',
      label: 'Tempat kerja',
      activeLabel: appliedFilters.work_mode
        ? WORK_MODE_LABELS[appliedFilters.work_mode]
        : null,
      options: [
        { value: '', label: 'Semua Tempat Kerja' },
        ...WORK_MODES.map((value) => ({
          value,
          label: WORK_MODE_LABELS[value],
        })),
      ],
    },
    {
      key: 'level',
      label: 'Tingkat',
      activeLabel: appliedFilters.level
        ? EXPERIENCE_LEVEL_LABELS[appliedFilters.level]
        : null,
      options: [
        { value: '', label: 'Semua Tingkat Pengalaman' },
        ...EXPERIENCE_LEVELS.map((value) => ({
          value,
          label: EXPERIENCE_LEVEL_LABELS[value],
        })),
      ],
    },
    {
      key: 'status',
      label: 'Status',
      activeLabel: appliedFilters.status
        ? JOB_STATUS_LABELS[appliedFilters.status]
        : null,
      options: [
        { value: '', label: 'Semua Status' },
        ...JOB_STATUSES.map((value) => ({
          value,
          label: JOB_STATUS_LABELS[value],
        })),
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Eksplorasi Karier"
        title="Cari Lowongan Kerja"
        subtitle="Temukan peluang kerja yang sesuai dengan bidang, lokasi, dan sistem kerja pilihanmu."
        tone="sky"
        imageSrc="/images/banner-jobs.jpg"
        imageAlt="Ilustrasi pencarian lowongan kerja"
        actions={
          <>
            <Link href="/recommendations" className="btn btn-secondary btn-sm">
              Cek Kecocokan Profil
            </Link>
            <Link href="/bookmarks" className="btn btn-outline btn-sm">
              Lowongan Tersimpan ({bookmarks.length})
            </Link>
          </>
        }
      />

      {actionNotice ? (
        <NoticeBanner
          variant={actionNotice.type}
          onDismiss={() => setActionNotice(null)}
        >
          {actionNotice.text}
        </NoticeBanner>
      ) : null}

      {/* Top Navy Search & Filter Pill Bar */}
      <section className="jobs-search-shell" aria-label="Pencarian dan filter lowongan">
        <form onSubmit={handleApplyFilters} className="jobs-search-form">
          <div className="jobs-search-row">
            <div className="jobs-search-input-wrap">
              <span className="jobs-search-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="jobs-search-input"
                maxLength={100}
                aria-label="Kata kunci posisi atau perusahaan"
                placeholder="Cari posisi, keahlian, atau nama perusahaan..."
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              />
            </div>

            <div className="jobs-search-input-wrap">
              <span className="jobs-search-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <input
                type="text"
                className="jobs-search-input"
                maxLength={100}
                aria-label="Kota atau wilayah"
                placeholder="Masukkan kota atau wilayah"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              />
            </div>

            <button type="submit" className="jobs-search-submit">
              Cari
            </button>
          </div>

          <div className="jobs-filter-pills" ref={pillsRef}>
            {pillDefs.map((pill) => {
              const isOpen = openPill === pill.key;
              const isActive = Boolean(pill.activeLabel);
              return (
                <div key={pill.key} className="jobs-pill-wrap">
                  <button
                    type="button"
                    className={`jobs-pill-btn${isActive ? ' jobs-pill-btn--active' : ''}${isOpen ? ' jobs-pill-btn--open' : ''}`}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    onClick={() => setOpenPill(isOpen ? null : pill.key)}
                  >
                    <span>{pill.activeLabel ?? pill.label}</span>
                    <svg
                      className="jobs-pill-chevron"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {isOpen ? (
                    <>
                      <div
                        className="jobs-pill-backdrop"
                        onClick={() => setOpenPill(null)}
                        aria-hidden="true"
                      />
                      <motion.div
                        className="jobs-pill-popover"
                        role="listbox"
                        aria-label={`Filter ${pill.label}`}
                        initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                      >
                        <div className="jobs-pill-popover-head">
                          <p className="jobs-pill-popover-title">{pill.label}</p>
                          <button
                            type="button"
                            className="jobs-pill-popover-close"
                            onClick={() => setOpenPill(null)}
                            aria-label="Tutup filter"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                        <div className="jobs-pill-options">
                        {pill.options.map((opt) => {
                          const selected = appliedFilters[pill.key] === opt.value;
                          return (
                            <button
                              key={opt.value || '__all__'}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className={`jobs-pill-option${selected ? ' jobs-pill-option--selected' : ''}`}
                              onClick={() =>
                                handleSelectPillFilter(
                                  pill.key,
                                  opt.value as FilterState[typeof pill.key],
                                )
                              }
                            >
                              <span>{opt.label}</span>
                              {selected ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : null}
                            </button>
                          );
                        })}
                        </div>
                      </motion.div>
                    </>
                  ) : null}
                </div>
              );
            })}

            {hasActiveFilters ? (
              <button
                type="button"
                className="jobs-pill-reset"
                onClick={handleResetFilters}
              >
                Reset filter ×
              </button>
            ) : null}
          </div>
        </form>
      </section>

      {/* Main 2-Column Portal Grid */}
      <div className="jobs-portal-grid">
        {/* Left Column: Job Feed */}
        <section aria-label="Daftar hasil lowongan">
          <div className="jobs-feed-toolbar">
            <span className="jobs-feed-count">
              {data ? (
                <>
                  Menampilkan <strong>{visibleJobs.length}</strong> dari{' '}
                  <strong>{data.total}</strong> lowongan
                </>
              ) : (
                'Memuat lowongan...'
              )}
              {hiddenIds.size > 0 ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="job-action-ghost"
                    style={{ display: 'inline-flex', height: 'auto', padding: '2px 6px' }}
                    onClick={() => setHiddenIds(new Set())}
                  >
                    Tampilkan {hiddenIds.size} yang disembunyikan
                  </button>
                </>
              ) : null}
            </span>

            <Link href="/profile" className="jobs-pref-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
              </svg>
              <span>Preferensi</span>
            </Link>
          </div>

          {loading ? (
            <LoadingState
              title="Mengambil daftar lowongan..."
              description="Memuat data lowongan terbaru untukmu."
              lines={5}
            />
          ) : error ? (
            <ErrorState
              error={error}
              title="Gagal Memuat Feed Lowongan"
              onRetry={loadJobs}
              loginRedirectPath="/jobs"
            />
          ) : !data || visibleJobs.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? 'Tidak Ada Lowongan yang Sesuai Filter'
                  : hiddenIds.size > 0
                    ? 'Semua Lowongan di Halaman Ini Disembunyikan'
                    : 'Belum Ada Lowongan yang Tersedia Saat Ini'
              }
              description={
                hasActiveFilters
                  ? 'Coba ubah kata kunci atau longgarkan filter yang dipilih.'
                  : hiddenIds.size > 0
                    ? 'Kamu menyembunyikan seluruh lowongan di halaman ini.'
                    : 'Daftar lowongan sedang diperbarui. Silakan periksa kembali beberapa saat lagi.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="primary" size="sm" onClick={handleResetFilters}>
                    Reset Semua Filter
                  </Button>
                ) : hiddenIds.size > 0 ? (
                  <Button variant="outline" size="sm" onClick={() => setHiddenIds(new Set())}>
                    Tampilkan Kembali
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
              {visibleJobs.map((job) => {
                const isSaved = bookmarkedIds.has(job.id);
                return (
                  <article
                    key={job.id}
                    className="job-feed-card"
                    onClick={(event) => handleCardClick(event, job.id)}
                  >
                    <div className="job-feed-card__main">
                      <div className="job-feed-card__info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                          <JobStatusBadge status={job.status} />
                          {job.deadline ? (
                            <span style={{ fontSize: '0.78rem', color: 'var(--status-warning)', fontWeight: 500 }}>
                              Tenggat {formatDateId(job.deadline)}
                            </span>
                          ) : null}
                        </div>

                        <h2 className="job-feed-card__title">
                          <Link href={`/jobs/${job.id}`}>{job.title}</Link>
                        </h2>
                        <p className="job-feed-card__company">{job.company}</p>

                        <div className="job-feed-card__lines">
                          <span>
                            {EMPLOYMENT_TYPE_LABELS[job.employment_type]} ·{' '}
                            {WORK_MODE_LABELS[job.work_mode]} ·{' '}
                            {EXPERIENCE_LEVEL_LABELS[job.level]}
                          </span>
                          <span>{job.location || 'Lokasi tidak dicantumkan'}</span>
                          {job.education ? <span>Pendidikan: {job.education}</span> : null}
                        </div>

                        {job.skills && job.skills.length > 0 ? (
                          <div className="job-feed-card__skills">
                            {job.skills.slice(0, 5).map((skill) => (
                              <span key={skill} className="job-feed-card__skill">
                                {skill}
                              </span>
                            ))}
                            {job.skills.length > 5 ? (
                              <span className="job-feed-card__skill job-feed-card__skill--more">
                                +{job.skills.length - 5} lainnya
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <CompanyLogoBox
                        company={job.company}
                        className="job-feed-card__logo"
                      />
                    </div>

                    <div className="job-feed-card__footer">
                      <span className="job-feed-card__time">
                        {formatRelativeTimeId(job.last_fetched_at ?? job.updated_at)}
                      </span>

                      <div className="job-feed-card__actions">
                        <button
                          type="button"
                          className={`job-action-ghost${isSaved ? ' job-action-ghost--saved' : ''}`}
                          disabled={togglingId === job.id}
                          onClick={() => handleToggleBookmark(job)}
                          aria-pressed={isSaved}
                          aria-label={isSaved ? 'Hapus dari tersimpan' : 'Simpan lowongan'}
                          title={isSaved ? 'Tersimpan' : 'Simpan lowongan'}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill={isSaved ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                          </svg>
                          {isSaved ? <span>Tersimpan</span> : null}
                        </button>

                        <button
                          type="button"
                          className="job-action-ghost"
                          onClick={() => handleHideJob(job.id)}
                          aria-label={`Sembunyikan lowongan ${job.title}`}
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          <span>Sembunyikan</span>
                        </button>
                      </div>
                    </div>
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
                    Sebelumnya
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
                    Berikutnya
                  </Button>
                </nav>
              ) : null}
            </div>
          )}
        </section>

        {/* Right Column: Saved Jobs Sidebar */}
        <aside className="jobs-saved-sidebar" aria-label="Lowongan kerja tersimpan">
          <h2 className="jobs-saved-heading">Lowongan kerja tersimpan</h2>

          {bookmarks.length === 0 ? (
            <div className="surface-card" style={{ padding: '18px 18px' }}>
              <p style={{ margin: '0 0 6px', fontWeight: 500, fontSize: '0.9rem', color: 'var(--p-ink)' }}>
                Belum ada lowongan tersimpan
              </p>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--p-muted)' }}>
                Klik ikon bookmark pada kartu lowongan untuk menyimpannya dan membandingkannya nanti.
              </p>
            </div>
          ) : (
            <>
              <div className="jobs-saved-list">
                {bookmarks.slice(0, 4).map((item) => {
                  const savedJob = item.jobs;
                  const title = savedJob?.title ?? 'Lowongan tersimpan';
                  const company = savedJob?.company ?? 'Perusahaan';
                  return (
                    <Link
                      key={item.job_id}
                      href={`/jobs/${item.job_id}`}
                      className="jobs-saved-card"
                    >
                      <div className="jobs-saved-card__top">
                        <div style={{ minWidth: 0 }}>
                          <h3 className="jobs-saved-card__title">{title}</h3>
                          <p className="jobs-saved-card__company">{company}</p>
                        </div>
                        <CompanyLogoBox
                          company={company}
                          className="jobs-saved-card__logo"
                        />
                      </div>

                      {savedJob ? (
                        <div className="jobs-saved-card__meta">
                          <span>{savedJob.location || 'Lokasi tidak dicantumkan'}</span>
                          <span>
                            {EMPLOYMENT_TYPE_LABELS[savedJob.employment_type]} ·{' '}
                            {WORK_MODE_LABELS[savedJob.work_mode]}
                          </span>
                        </div>
                      ) : null}

                      <div className="jobs-saved-card__time">
                        Disimpan {formatRelativeTimeId(item.created_at)}
                      </div>
                    </Link>
                  );
                })}
              </div>

              <div className="jobs-saved-footer">
                <Link href="/bookmarks" className="jobs-saved-all-link">
                  <span>Lihat semua ({bookmarks.length})</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            </>
          )}
        </aside>
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
