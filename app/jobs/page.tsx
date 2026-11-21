'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ApiCallError,
  apiFetch,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  formatDateId,
  JOB_STATUS_LABELS,
  WORK_MODE_LABELS,
} from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { EmptyState, ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button, JobStatusBadge } from '@/components/ui/forms';
import { PageBanner } from '@/components/ui/page-banner';
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
import type { EmptyHint } from '@/lib/recommendation/empty-hint';
import { proxiedLogoSrc } from '@/lib/logo-proxy';

type JobsApiResponse = {
  items: Array<Job & { location_note?: string | null }>;
  total: number;
  page: number;
  limit: number;
  pages: number;
  profile_state?: 'empty' | 'ingest_pending' | 'ready' | 'explicit_search' | 'all_newest';
  reason?: 'profile_incomplete';
  empty_hint?: EmptyHint | null;
  location_notes?: Record<string, string>;
  location_diagnostics?: Record<string, number>;
  location_counts?: { exact: number; remote: number; nearby: number };
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

const HIDDEN_JOBS_STORAGE_KEY = 'rakitkarier:hidden-jobs';

function parseQueryStateFromSearch(search: string): {
  filters: FilterState;
  page: number;
} {
  const params = new URLSearchParams(search);
  const q = (params.get('q') ?? '').slice(0, 100);
  const location = (params.get('location') ?? '').slice(0, 100);
  const rawWorkMode = params.get('work_mode') ?? '';
  const rawEmpType = params.get('employment_type') ?? '';
  const rawLevel = params.get('level') ?? '';
  const rawStatus = params.get('status') ?? '';
  const rawPage = Number(params.get('page') ?? '1');

  const work_mode: '' | WorkMode = WORK_MODES.includes(rawWorkMode as WorkMode)
    ? (rawWorkMode as WorkMode)
    : '';
  const employment_type: '' | EmploymentType = EMPLOYMENT_TYPES.includes(
    rawEmpType as EmploymentType,
  )
    ? (rawEmpType as EmploymentType)
    : '';
  const level: '' | ExperienceLevel = EXPERIENCE_LEVELS.includes(rawLevel as ExperienceLevel)
    ? (rawLevel as ExperienceLevel)
    : '';
  const status: '' | JobStatus = JOB_STATUSES.includes(rawStatus as JobStatus)
    ? (rawStatus as JobStatus)
    : '';
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000 ? rawPage : 1;

  return {
    filters: { q, location, work_mode, employment_type, level, status },
    page,
  };
}

function buildJobsQueryString(
  applied: FilterState,
  pageNum: number,
): string {
  const params = new URLSearchParams();
  const cleanedQ = cleanSearchQuery(applied.q);
  if (cleanedQ) params.set('q', cleanedQ.slice(0, 100));
  const cleanedLoc = cleanSearchQuery(applied.location);
  if (cleanedLoc) params.set('location', cleanedLoc.slice(0, 100));
  if (applied.work_mode) params.set('work_mode', applied.work_mode);
  if (applied.employment_type) params.set('employment_type', applied.employment_type);
  if (applied.level) params.set('level', applied.level);
  if (applied.status) params.set('status', applied.status);
  if (pageNum > 1) params.set('page', String(pageNum));
  return params.toString();
}

type HiddenJobRecord = {
  id: string;
  title: string;
  company: string;
  location?: string | null;
  hidden_at: string;
};

function readHiddenJobs(): HiddenJobRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_JOBS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const records: HiddenJobRecord[] = [];
    for (const item of parsed) {
      if (typeof item === 'string' && item.length > 0) {
        if (!seen.has(item)) {
          seen.add(item);
          records.push({
            id: item,
            title: 'Lowongan disembunyikan',
            company: '',
            location: null,
            hidden_at: '',
          });
        }
      } else if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        if (typeof rec.id === 'string' && rec.id.length > 0 && !seen.has(rec.id)) {
          seen.add(rec.id);
          records.push({
            id: rec.id,
            title:
              typeof rec.title === 'string' && rec.title.trim()
                ? rec.title.trim()
                : 'Lowongan disembunyikan',
            company: typeof rec.company === 'string' ? rec.company.trim() : '',
            location: typeof rec.location === 'string' ? rec.location.trim() : null,
            hidden_at: typeof rec.hidden_at === 'string' ? rec.hidden_at : '',
          });
        }
      }
    }
    return records;
  } catch {
    return [];
  }
}

function persistHiddenJobs(records: HiddenJobRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    if (records.length === 0) {
      window.localStorage.removeItem(HIDDEN_JOBS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(HIDDEN_JOBS_STORAGE_KEY, JSON.stringify(records));
    }
  } catch {
    // Abaikan error kuota/private mode localStorage
  }
}

function cleanSearchQuery(raw: string): string {
  return raw.replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim();
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

function CompanyLogoBox({
  company,
  logoUrl,
  className,
}: {
  company: string;
  logoUrl?: string | null;
  className: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canRenderLogo = isUsableLogoUrl(logoUrl) && failedUrl !== logoUrl;

  return (
    <div
      className={className}
      aria-hidden="true"
      title={company}
      style={{ overflow: 'hidden' }}
    >
      {canRenderLogo ? (
        <img
          src={proxiedLogoSrc(logoUrl)}
          alt=""
          width={44}
          height={44}
          loading="lazy"
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
  const [initialUrlState] = useState(() =>
    typeof window !== 'undefined'
      ? parseQueryStateFromSearch(window.location.search)
      : { filters: INITIAL_FILTERS, page: 1 },
  );
  const [filters, setFilters] = useState<FilterState>(initialUrlState.filters);
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(initialUrlState.filters);
  const [openPill, setOpenPill] = useState<PillKey | null>(null);
  const [page, setPage] = useState(initialUrlState.page);
  const limit = 12;

  const [data, setData] = useState<JobsApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);

  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [hiddenJobs, setHiddenJobs] = useState<HiddenJobRecord[]>(() =>
    typeof window !== 'undefined' ? readHiddenJobs() : [],
  );
  const [hiddenModalOpen, setHiddenModalOpen] = useState(false);
  const [selectedRestoreIds, setSelectedRestoreIds] = useState<Set<string>>(new Set());
  const [actionNotice, setActionNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingPolled, setPendingPolled] = useState(false);

  const pillsRef = useRef<HTMLDivElement | null>(null);
  const bookmarksLoadedRef = useRef(false);

  // Fitur #4: Dengarkan navigasi back/forward browser untuk menyinkronkan filter & halaman
  useEffect(() => {
    const handlePopState = () => {
      const next = parseQueryStateFromSearch(window.location.search);
      setFilters(next.filters);
      setAppliedFilters(next.filters);
      setPage(next.page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fitur #4: Sinkronkan filter aktif & halaman ke URL browser tanpa reload halaman
  useEffect(() => {
    const qs = buildJobsQueryString(appliedFilters, page);
    const nextUrl = qs ? `/jobs?${qs}` : '/jobs';
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, '', nextUrl);
    }
  }, [appliedFilters, page]);

  const hiddenIds = useMemo(() => new Set(hiddenJobs.map((item) => item.id)), [hiddenJobs]);

  const resolvedHiddenJobs = useMemo(() => {
    const itemsById = new Map((data?.items ?? []).map((item) => [item.id, item]));
    return hiddenJobs.map((record) => {
      if (record.title !== 'Lowongan disembunyikan') return record;
      const live = itemsById.get(record.id);
      if (!live) return record;
      return {
        ...record,
        title: live.title,
        company: live.company,
        location: live.location ?? record.location ?? null,
      };
    });
  }, [hiddenJobs, data]);

  const bookmarkedIds = useMemo(
    () => new Set(bookmarks.map((b) => b.job_id)),
    [bookmarks],
  );

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      if (pillsRef.current && !pillsRef.current.contains(target)) {
        setOpenPill(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPill(null);
        setHiddenModalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
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

    if (!bookmarksLoadedRef.current) {
      bookmarksLoadedRef.current = true;
      void loadBookmarks();
    }
  }, [appliedFilters, loadBookmarks, page]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const hasActiveFilters = Boolean(
    appliedFilters.q ||
      appliedFilters.location ||
      appliedFilters.work_mode ||
      appliedFilters.employment_type ||
      appliedFilters.level ||
      appliedFilters.status,
  );

  useEffect(() => {
    setPendingPolled(false);
  }, [appliedFilters, page]);

  useEffect(() => {
    if (loading || error || !data) return;
    if (hasActiveFilters) return;
    if (data.profile_state !== 'ingest_pending') return;
    if ((data.items?.length ?? 0) > 0) return;
    if (pendingPolled) return;
    setPendingPolled(true);
    const timer = window.setTimeout(() => {
      void loadJobs();
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [data, error, hasActiveFilters, loadJobs, loading, pendingPolled]);

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

  function openHiddenJobsModal() {
    setSelectedRestoreIds(new Set());
    setHiddenModalOpen(true);
  }

  function handleHideJob(job: Job) {
    const newRecord: HiddenJobRecord = {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location ?? null,
      hidden_at: new Date().toISOString(),
    };
    setHiddenJobs((prev) => {
      const next = [newRecord, ...prev.filter((item) => item.id !== job.id)];
      persistHiddenJobs(next);
      return next;
    });
    setActionNotice({
      type: 'success',
      text: `Lowongan "${job.title}" disembunyikan. Kamu dapat memilih dan memulihkannya lewat tombol Kelola di atas daftar.`,
    });
  }

  function handleToggleSelectRestore(jobId: string) {
    setSelectedRestoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  function handleRestoreSpecificJobs(idsToRestore: Iterable<string>) {
    const restoreSet = new Set(idsToRestore);
    if (restoreSet.size === 0) return;

    const restoredItems = resolvedHiddenJobs.filter((item) => restoreSet.has(item.id));
    if (restoredItems.length === 0) return;

    const remaining = hiddenJobs.filter((item) => !restoreSet.has(item.id));
    persistHiddenJobs(remaining);
    setHiddenJobs(remaining);
    setSelectedRestoreIds((prev) => {
      const next = new Set(prev);
      for (const id of restoreSet) next.delete(id);
      return next;
    });
    if (remaining.length === 0) {
      setHiddenModalOpen(false);
    }

    const message =
      restoredItems.length === 1
        ? restoredItems[0].title !== 'Lowongan disembunyikan'
          ? `Lowongan "${restoredItems[0].title}" ditampilkan kembali.`
          : '1 lowongan yang disembunyikan telah ditampilkan kembali.'
        : `${restoredItems.length} lowongan yang dipilih telah ditampilkan kembali.`;
    setActionNotice({ type: 'success', text: message });
  }

  function handleRestoreAllHiddenJobs() {
    persistHiddenJobs([]);
    setHiddenJobs([]);
    setSelectedRestoreIds(new Set());
    setHiddenModalOpen(false);
    setActionNotice({
      type: 'success',
      text: 'Seluruh lowongan yang disembunyikan telah ditampilkan kembali.',
    });
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

  const profileIncomplete = !hasActiveFilters && data?.profile_state === 'empty';
  const ingestPending =
    !hasActiveFilters &&
    data?.profile_state === 'ingest_pending' &&
    (data.items?.length ?? 0) === 0;

  return (
    <>
      {actionNotice ? (
        <NoticeBanner
          variant={actionNotice.type}
          onDismiss={() => setActionNotice(null)}
        >
          {actionNotice.text}
        </NoticeBanner>
      ) : null}

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
                      <div
                        className="jobs-pill-popover"
                        role="listbox"
                        aria-label={`Filter ${pill.label}`}
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
                      </div>
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

      <div className="jobs-portal-grid">
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
              {hiddenJobs.length > 0 ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="job-action-ghost"
                    style={{ display: 'inline-flex', height: 'auto', padding: '2px 6px' }}
                    onClick={openHiddenJobsModal}
                  >
                    {hiddenJobs.length} disembunyikan · Kelola
                  </button>
                </>
              ) : null}
            </span>
          </div>

          {loading ? (
            <LoadingState
              title={ingestPending ? 'Mencari lowongan sesuai profilmu...' : 'Mengambil daftar lowongan...'}
              description={
                ingestPending
                  ? 'Sedang mencari lowongan sesuai profilmu. Halaman akan dimuat ulang otomatis.'
                  : 'Memuat data lowongan terbaru untukmu.'
              }
              lines={5}
              reserved
            />
          ) : error ? (
            <ErrorState
              error={error}
              title="Gagal Memuat Feed Lowongan"
              onRetry={loadJobs}
              loginRedirectPath="/jobs"
            />
          ) : profileIncomplete ? (
            <EmptyState
              title="Lengkapi bidang dan keahlian di profil untuk melihat rekomendasi"
              description="Isi bidang/posisi yang diminati dan keahlian di profil agar kami dapat mencari lowongan yang sesuai untukmu."
              action={
                <Link href="/profile" className="btn btn-primary btn-sm">
                  Lengkapi Profil
                </Link>
              }
            />
          ) : ingestPending ? (
            <EmptyState
              title={data?.empty_hint?.title ?? 'Sedang mencari lowongan sesuai profilmu…'}
              description={
                data?.empty_hint
                  ? `${data.empty_hint.description} ${data.empty_hint.loosen}`
                  : 'Kami sedang mengambil lowongan berdasarkan bidang dan keahlian di profilmu. Proses ini biasanya selesai dalam beberapa saat.'
              }
              action={
                <Button variant="outline" size="sm" onClick={loadJobs}>
                  Muat Ulang Sekarang
                </Button>
              }
            />
          ) : !data || visibleJobs.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? 'Tidak Ada Lowongan yang Sesuai Filter'
                  : hiddenIds.size > 0
                    ? 'Semua Lowongan di Halaman Ini Disembunyikan'
                    : (data?.empty_hint?.title ?? 'Belum Ada Lowongan yang Sesuai Profilmu')
              }
              description={
                hasActiveFilters
                  ? 'Coba ubah kata kunci atau longgarkan filter yang dipilih.'
                  : hiddenIds.size > 0
                    ? 'Kamu menyembunyikan seluruh lowongan di halaman ini.'
                    : data?.empty_hint
                      ? `${data.empty_hint.description} ${data.empty_hint.loosen}`
                      : 'Belum ada lowongan yang cocok dengan profilmu saat ini. Coba perbarui profil atau gunakan pencarian untuk menjelajah semua lowongan.'
              }
              action={
                hasActiveFilters ? (
                  <Button variant="primary" size="sm" onClick={handleResetFilters}>
                    Reset Semua Filter
                  </Button>
                ) : hiddenIds.size > 0 ? (
                  <Button variant="outline" size="sm" onClick={openHiddenJobsModal}>
                    Kelola Lowongan Disembunyikan
                  </Button>
                ) : (
                  <Link href="/profile" className="btn btn-primary btn-sm">
                    Perbarui Profil
                  </Link>
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
                          <span>
                            {job.location || 'Lokasi tidak dicantumkan'}
                            {data?.location_notes?.[job.id] ? (
                              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                {' · '}
                                {data.location_notes[job.id]}
                              </span>
                            ) : null}
                          </span>
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
                        logoUrl={job.company_logo_url}
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
                          onClick={() => handleHideJob(job)}
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
                          logoUrl={savedJob?.company_logo_url}
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

      {hiddenModalOpen && hiddenJobs.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hidden-jobs-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHiddenModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            backgroundColor: 'rgba(15, 23, 42, 0.48)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="ledger-card"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              backgroundColor: 'var(--bg-surface, #ffffff)',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.22)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingBottom: 12,
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <h2
                  id="hidden-jobs-modal-title"
                  style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink-primary)' }}
                >
                  Lowongan yang Disembunyikan ({hiddenJobs.length})
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  Pilih satu atau beberapa lowongan untuk ditampilkan kembali di daftar.
                </p>
              </div>
              <button
                type="button"
                className="job-action-ghost"
                onClick={() => setHiddenModalOpen(false)}
                aria-label="Tutup modal lowongan disembunyikan"
                style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                maxHeight: '55vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
              }}
            >
              {resolvedHiddenJobs.map((item) => {
                const checked = selectedRestoreIds.has(item.id);
                const subtitle = [item.company, item.location].filter(Boolean).join(' · ');
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm, 10px)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: checked ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        minWidth: 0,
                        flex: 1,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSelectRestore(item.id)}
                        style={{ marginTop: 4, flexShrink: 0 }}
                        aria-label={`Pilih ${item.title} untuk dipulihkan`}
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <Link
                          href={`/jobs/${item.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'block',
                            fontWeight: 600,
                            fontSize: '0.94rem',
                            color: 'var(--ink-primary)',
                            textDecoration: 'none',
                            wordBreak: 'break-word',
                          }}
                        >
                          {item.title}
                        </Link>
                        {subtitle ? (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '0.82rem',
                              color: 'var(--ink-secondary)',
                              marginTop: 2,
                            }}
                          >
                            {subtitle}
                          </span>
                        ) : null}
                      </span>
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreSpecificJobs([item.id])}
                    >
                      Pulihkan
                    </Button>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedRestoreIds.size === 0}
                  onClick={() => handleRestoreSpecificJobs(selectedRestoreIds)}
                >
                  Pulihkan yang Dipilih ({selectedRestoreIds.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreAllHiddenJobs}
                >
                  Pulihkan Semua
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHiddenModalOpen(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function JobsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Eksplorasi Karier"
        title="Cari Lowongan Kerja"
        subtitle="Temukan peluang kerja yang sesuai dengan bidang, lokasi, dan sistem kerja pilihanmu."
        tone="sky"
        imageSrc="/images/banner-jobs.jpg"
        actions={
          <>
            <Link href="/recommendations" className="btn btn-secondary btn-sm">
              Cek Kecocokan Profil
            </Link>
            <Link href="/bookmarks" className="btn btn-outline btn-sm">
              Lowongan Tersimpan
            </Link>
          </>
        }
      />

      <AuthGuard title="Masuk untuk Membuka Feed Lowongan">
        {() => <JobsFeedInner />}
      </AuthGuard>
    </div>
  );
}
