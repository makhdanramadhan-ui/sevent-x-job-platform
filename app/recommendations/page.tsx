'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  Button,
  CheckboxGroup,
  EMPLOYMENT_TYPE_LABELS,
  EmptyState,
  ErrorState,
  EXPERIENCE_LEVEL_LABELS,
  formatDateTimeId,
  JobStatusBadge,
  LoadingState,
  NoticeBanner,
  PageBanner,
  WORK_MODE_LABELS,
} from '@/components/ui';
import { CompanyLogo } from '@/components/ui/company-logo';
import { displaySourceName } from '@/lib/job-source';
import type { EmptyHint } from '@/lib/recommendation/empty-hint';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  type ProfileRecord,
  WORK_MODES,
} from '@/lib/contracts';
import type {
  RecommendationFilters,
  RecommendationItem,
  RecommendationOutput,
} from '@/lib/recommendation-contract';

type RecommendationsApiResponse = RecommendationOutput & {
  reason?: 'profile_incomplete';
  profile_state?: 'empty' | 'ready' | 'ingest_pending';
  empty_hint?: EmptyHint | null;
  location_diagnostics?: Record<string, number>;
  location_counts?: { exact: number; remote: number; nearby: number };
};


const WORK_MODE_FILTER_OPTS = WORK_MODES.map((value) => ({
  value,
  label: WORK_MODE_LABELS[value],
}));

const EMPLOYMENT_FILTER_OPTS = EMPLOYMENT_TYPES.map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}));

const LEVEL_FILTER_OPTS = EXPERIENCE_LEVELS.map((value) => ({
  value,
  label: EXPERIENCE_LEVEL_LABELS[value],
}));

const EMPTY_FILTERS: RecommendationFilters = {
  work_modes: [],
  employment_types: [],
  levels: [],
};

const RECOMMENDATIONS_PER_PAGE = 8;

function isRecommendationOutput(val: unknown): val is RecommendationOutput {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.contract_version === 1 && Array.isArray(obj.items);
}



function parseCommaListLine(text: string): { prefix: string; items: string[] } | null {
  const colonIdx = text.indexOf(':');
  if (colonIdx === -1) return null;
  const prefix = text.slice(0, colonIdx).trim();
  const rest = text.slice(colonIdx + 1).trim();
  const parts = rest
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 4) return null;
  return { prefix, items: parts };
}

function RecommendationsInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [recOutput, setRecOutput] = useState<RecommendationsApiResponse | null>(null);

  const [endpointMissing, setEndpointMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expandedMissingKeys, setExpandedMissingKeys] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<RecommendationFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const listTopRef = useRef<HTMLDivElement | null>(null);

  function updateFilters(next: RecommendationFilters) {
    setFilters(next);
    setPage(1);
  }

  function toggleExpandedMissing(key: string) {
    setExpandedMissingKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>, jobId: string) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;
    router.push(`/jobs/${jobId}`);
  }

  const loadRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEndpointMissing(false);

    const [profileRes, recRes] = await Promise.all([
      apiFetch<ProfileRecord | null>('/api/profile'),
      apiFetch<RecommendationsApiResponse>('/api/recommendations'),
    ]);

    if (profileRes.ok) {
      setProfile(profileRes.data);
    }


    if (recRes.ok && isRecommendationOutput(recRes.data)) {
      setRecOutput(recRes.data);
    } else if (!recRes.ok) {
      if (recRes.error.status === 404 || recRes.error.status === 501) {
        setEndpointMissing(true);
        setRecOutput(null);
      } else {
        setError(recRes.error);
      }
    } else {
      setEndpointMissing(true);
      setRecOutput(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const activeFilterCount =
    filters.work_modes.length + filters.employment_types.length + filters.levels.length;

  const filteredItems = useMemo(() => {
    if (!recOutput) return [];
    return recOutput.items.filter((item) => {
      const job = item.job;
      if (!job) return false;
      if (filters.work_modes.length > 0 && !filters.work_modes.includes(job.work_mode)) {
        return false;
      }
      if (
        filters.employment_types.length > 0 &&
        !filters.employment_types.includes(job.employment_type)
      ) {
        return false;
      }
      if (filters.levels.length > 0 && !filters.levels.includes(job.level)) {
        return false;
      }
      return true;
    });
  }, [recOutput, filters, activeFilterCount]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / RECOMMENDATIONS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * RECOMMENDATIONS_PER_PAGE;
  const paginatedItems = useMemo(
    () => filteredItems.slice(startIndex, startIndex + RECOMMENDATIONS_PER_PAGE),
    [filteredItems, startIndex],
  );
  const rangeStart = filteredItems.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + paginatedItems.length, filteredItems.length);

  function handlePageChange(nextPage: number) {
    const clamped = Math.max(1, Math.min(totalPages, nextPage));
    if (clamped === currentPage) return;
    setPage(clamped);
    if (listTopRef.current) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      listTopRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    }
  }

  const profileIncomplete =
    recOutput?.reason === 'profile_incomplete' ||
    !(
      profile &&
      ((profile.skills?.length ?? 0) > 0 ||
        (profile.preferences?.positions?.length ?? 0) > 0)
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Kecocokan Profil"
        title="Rekomendasi Lowongan Untukmu"
        subtitle="Lihat peluang kerja yang paling sesuai dengan keahlian, pengalaman, dan preferensi profilmu, beserta persyaratan yang masih perlu kamu lengkapi."
        tone="mist"
        imageSrc="/images/banner-recommendations.jpg"
        imageAlt="Ilustrasi rekomendasi kecocokan lowongan"
        actions={
          <>
            <Link href="/profile" className="btn btn-outline btn-sm">
              Ubah Profil &amp; Preferensi
            </Link>
            <Link href="/jobs" className="btn btn-secondary btn-sm">
              Cari Semua Lowongan
            </Link>
          </>
        }
      />

      {/* Friendly Info Banner */}
      <NoticeBanner variant="info" title="Cara Membaca Kecocokan Profil">
        Indikator kecocokan membantu kamu melihat kesesuaian kualifikasi profilmu dengan persyaratan
        lowongan agar kamu dapat mempersiapkan CV dengan lebih tepat sebelum melamar.
      </NoticeBanner>

      {loading ? (
        <LoadingState
          title="Menyiapkan rekomendasi lowongan..."
          description="Mencocokkan profil kamu dengan daftar lowongan yang tersedia."
          lines={4}
        />
      ) : error ? (
        <ErrorState
          error={error}
          title="Belum Dapat Memuat Rekomendasi"
          onRetry={loadRecommendations}
          loginRedirectPath="/recommendations"
        />
      ) : profileIncomplete ? (
        <EmptyState
          title="Lengkapi negara & lokasi kerja preferensi untuk melihat rekomendasi"
          description="Isi bidang/posisi, keahlian, negara, dan lokasi kerja preferensi di profil agar kami dapat menampilkan rekomendasi lowongan yang sesuai."
          action={
            <Link href="/profile" className="btn btn-primary btn-sm">
              Lengkapi Profil
            </Link>
          }
        />
      ) : (
        <>
          <section className="rec-profile-card" aria-label="Ringkasan profil kamu">
            <div className="rec-profile-header">
              <h2 className="rec-profile-title">Ringkasan Kualifikasi Profilmu</h2>
              <Link href="/profile" className="rec-profile-link">
                Perbarui Profil →
              </Link>
            </div>
            <div className="rec-stats-grid">
              <div className="rec-stat-box">
                <span className="rec-stat-value rec-stat-value--accent">
                  {profile?.skills.length ?? 0}
                </span>
                <span className="rec-stat-label">Keahlian</span>
              </div>
              <div className="rec-stat-box">
                <span className="rec-stat-value">{profile?.education.length ?? 0}</span>
                <span className="rec-stat-label">Pendidikan</span>
              </div>
              <div className="rec-stat-box">
                <span className="rec-stat-value">{profile?.experiences.length ?? 0}</span>
                <span className="rec-stat-label">Pengalaman</span>
              </div>
              <div className="rec-stat-box">
                <span className="rec-stat-value">{profile?.projects.length ?? 0}</span>
                <span className="rec-stat-label">Proyek</span>
              </div>
              <div className="rec-stat-box">
                <span className="rec-stat-value">
                  {profile?.preferences.positions.length ?? 0}
                </span>
                <span className="rec-stat-label">Posisi Diminati</span>
              </div>
            </div>
          </section>

          {/* Case 1: Recommendation service not active yet */}
          {endpointMissing ? (
            <EmptyState
              title="Belum Ada Rekomendasi Lowongan Saat Ini"
              description="Rekomendasi lowongan yang dicocokkan dengan profilmu sedang disiapkan. Sambil menunggu, kamu tetap dapat mencari dan menyimpan lowongan langsung di halaman Lowongan."
              action={
                <>
                  <Link href="/jobs" className="btn btn-primary btn-sm">
                    Cari Lowongan Sekarang
                  </Link>
                  <Button variant="outline" size="sm" onClick={loadRecommendations}>
                    Muat Ulang
                  </Button>
                </>
              }
            />
          ) : (
            <>
              {/* Filter Bar when recommendations exist */}
              <section className="rec-filter-card" aria-label="Filter daftar rekomendasi">
                <div className="rec-filter-head">
                  <div className="rec-filter-head-left">
                    <h2 className="rec-filter-title">Filter Rekomendasi</h2>
                    {activeFilterCount > 0 ? (
                      <span className="rec-filter-count">{activeFilterCount} aktif</span>
                    ) : null}
                  </div>
                  <div className="rec-filter-actions">
                    {activeFilterCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateFilters(EMPTY_FILTERS)}
                      >
                        Reset Filter
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-expanded={filtersOpen}
                      onClick={() => setFiltersOpen((prev) => !prev)}
                    >
                      {filtersOpen ? 'Sembunyikan' : 'Tampilkan Filter'}
                    </Button>
                  </div>
                </div>

                {filtersOpen ? (
                  <div className="rec-filter-body">
                    <CheckboxGroup
                      legend="Mode Kerja"
                      options={WORK_MODE_FILTER_OPTS}
                      selected={filters.work_modes}
                      onChange={(work_modes) => updateFilters({ ...filters, work_modes })}
                    />
                    <CheckboxGroup
                      legend="Jenis Kontrak"
                      options={EMPLOYMENT_FILTER_OPTS}
                      selected={filters.employment_types}
                      onChange={(employment_types) =>
                        updateFilters({ ...filters, employment_types })
                      }
                    />
                    <CheckboxGroup
                      legend="Tingkat Pengalaman"
                      options={LEVEL_FILTER_OPTS}
                      selected={filters.levels}
                      onChange={(levels) => updateFilters({ ...filters, levels })}
                    />
                  </div>
                ) : null}
              </section>

              {filteredItems.length === 0 ? (
                <EmptyState
                  title={
                    recOutput?.empty_hint?.title ?? 'Tidak Ada Item Rekomendasi untuk Ditampilkan'
                  }
                  description={
                    activeFilterCount > 0
                      ? 'Tidak ada rekomendasi yang cocok dengan kombinasi filter saat ini. Coba reset atau longgarkan filter.'
                      : recOutput?.empty_hint
                        ? `${recOutput.empty_hint.description} ${recOutput.empty_hint.loosen}`
                        : 'Endpoint rekomendasi tidak mengembalikan lowongan yang sesuai dengan profil saat ini.'
                  }
                  action={
                    activeFilterCount > 0 ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => updateFilters(EMPTY_FILTERS)}
                      >
                        Reset Semua Filter
                      </Button>
                    ) : (
                      <Link href="/jobs" className="btn btn-primary btn-sm">
                        Lihat Semua Lowongan di Feed
                      </Link>
                    )
                  }
                />
              ) : (
                <div
                  ref={listTopRef}
                  style={{ display: 'flex', flexDirection: 'column', gap: 16, scrollMarginTop: 88 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                      Menampilkan <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> dari{' '}
                      <strong>{filteredItems.length}</strong> rekomendasi lowongan
                    </p>
                    {totalPages > 1 ? (
                      <span
                        className="font-mono"
                        style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}
                      >
                        Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
                      </span>
                    ) : null}
                  </div>

                  <div className="jobs-list">
                    {paginatedItems.map((item: RecommendationItem) => {
                      const job = item.job;
                      if (!job) return null;
                    const pct = Math.max(0, Math.min(100, Math.round(item.score)));
                    const isHighMatch = pct >= 70;

                    return (
                      <article
                        key={item.job_id}
                        className="rec-card"
                        onClick={(event) => handleCardClick(event, item.job_id)}
                      >
                        <div className="rec-card-top">
                          <div className="rec-card-main">
                            <div className="rec-card-meta-top">
                              <span
                                className="rec-match-inline"
                                aria-label={`Indeks kecocokan ${pct} persen`}
                              >
                                <span
                                  className={`rec-match-pct${isHighMatch ? ' rec-match-pct--high' : ''}`}
                                >
                                  {pct}%
                                </span>
                                <span className="rec-match-bar" aria-hidden="true">
                                  <span
                                    className={`rec-match-bar-fill${isHighMatch ? ' rec-match-bar-fill--high' : ''}`}
                                    style={{ width: `${pct}%`, display: 'block' }}
                                  />
                                </span>
                                <span className="rec-match-caption">kecocokan</span>
                              </span>

                              <JobStatusBadge status={job.status} />
                              <span className="job-timestamp">
                                Diambil: {formatDateTimeId(job.last_fetched_at)}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                              <CompanyLogo
                                company={job.company}
                                logoUrl={job.company_logo_url}
                                size={44}
                              />
                              <div style={{ minWidth: 0 }}>
                                <h2 className="rec-card-title" style={{ marginTop: 0 }}>
                                  <Link href={`/jobs/${item.job_id}`}>{job.title}</Link>
                                </h2>
                                <p className="rec-card-company">
                                  {job.company} ·{' '}
                                  <span>{job.location || 'Lokasi tidak dicantumkan'}</span>
                                  {item.location_note ? (
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                                      {' · '}
                                      {item.location_note}
                                    </span>
                                  ) : null}
                                  {' '}
                                  ·{' '}
                                  <span>{WORK_MODE_LABELS[job.work_mode] ?? job.work_mode}</span>{' '}
                                  ·{' '}
                                  {item.source ? (
                                    <>
                                      {' · '}
                                      <span>{displaySourceName(item.source.source_name)}</span>
                                    </>
                                  ) : null}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rec-card-cta">
                            {item.source?.source_url ? (
                              <a
                                href={item.source.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm"
                              >
                                Detail &amp; Sumber Asli
                              </a>
                            ) : (
                              <Link
                                href={`/jobs/${item.job_id}`}
                                className="btn btn-primary btn-sm"
                              >
                                Detail &amp; Sumber Asli
                              </Link>
                            )}
                          </div>
                        </div>

                        {/* Editorial 2-Column Breakdown */}
                        <div className="rec-ledger">
                          <div className="rec-col">
                            <div className="rec-col-head">
                              <span className="rec-col-dot rec-col-dot--matched" aria-hidden="true" />
                              <span>Cocok dengan profilmu</span>
                              <span className="rec-col-count">({item.matched.length})</span>
                            </div>

                            {item.matched.length > 0 ? (
                              <ul className="rec-list">
                                {item.matched.map((m, i) => (
                                  <li key={`${m}-${i}`} className="rec-list-item">
                                    <svg
                                      className="rec-list-icon rec-list-icon--matched"
                                      width="15"
                                      height="15"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      aria-hidden="true"
                                    >
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    <span>{m}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="rec-empty-note">Belum ada poin kecocokan tercatat.</p>
                            )}
                          </div>

                          <div className="rec-col">
                            <div className="rec-col-head">
                              <span className="rec-col-dot rec-col-dot--missing" aria-hidden="true" />
                              <span>Perlu dilengkapi</span>
                              <span className="rec-col-count">({item.missing.length})</span>
                            </div>

                            {item.missing.length > 0 ? (
                              <ul className="rec-list">
                                {item.missing.map((ms, i) => {
                                  const parsed = parseCommaListLine(ms);
                                  const expandKey = `${item.job_id}-${i}`;
                                  const isExpanded = expandedMissingKeys.has(expandKey);
                                  const maxVisible = 6;

                                  if (parsed) {
                                    const shown = isExpanded
                                      ? parsed.items
                                      : parsed.items.slice(0, maxVisible);
                                    const remaining = parsed.items.length - maxVisible;

                                    return (
                                      <li key={`${expandKey}`} className="rec-list-item">
                                        <svg
                                          className="rec-list-icon rec-list-icon--missing"
                                          width="15"
                                          height="15"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="12" y1="8" x2="12" y2="12" />
                                          <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <div className="rec-missing-skills-block">
                                          <span>{parsed.prefix}:</span>
                                          <div className="rec-missing-skills-tags">
                                            {shown.map((skill) => (
                                              <span key={skill} className="rec-skill-tag">
                                                {skill}
                                              </span>
                                            ))}
                                            {remaining > 0 ? (
                                              <button
                                                type="button"
                                                className="rec-skill-toggle"
                                                onClick={() => toggleExpandedMissing(expandKey)}
                                              >
                                                {isExpanded
                                                  ? 'Ringkas'
                                                  : `+${remaining} skill lainnya`}
                                              </button>
                                            ) : null}
                                          </div>
                                        </div>
                                      </li>
                                    );
                                  }

                                  return (
                                    <li key={`${ms}-${i}`} className="rec-list-item">
                                      <svg
                                        className="rec-list-icon rec-list-icon--missing"
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2.2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                      </svg>
                                      <span>{ms}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="rec-empty-note">
                                Tidak ada kekurangan persyaratan tercatat.
                              </p>
                            )}
                          </div>
                        </div>

                        {item.unknown.length > 0 ? (
                          <div className="rec-footnote">
                            <span className="rec-footnote-label">Catatan data lowongan:</span>
                            <span>{item.unknown.join(' · ')}</span>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  </div>

                  {totalPages > 1 ? (
                    <nav
                      aria-label="Navigasi halaman rekomendasi"
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
                        disabled={currentPage <= 1}
                        onClick={() => handlePageChange(currentPage - 1)}
                      >
                        Sebelumnya
                      </Button>
                      <span className="font-mono" style={{ fontSize: '0.82rem' }}>
                        Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong>
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                      >
                        Berikutnya
                      </Button>
                    </nav>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <AuthGuard title="Masuk untuk Melihat Rekomendasi Lowongan">
      {() => <RecommendationsInner />}
    </AuthGuard>
  );
}
