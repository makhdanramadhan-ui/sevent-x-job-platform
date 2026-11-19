'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  type Job,
  type ProfileRecord,
  WORK_MODES,
} from '@/lib/contracts';
import type {
  RecommendationFilters,
  RecommendationItem,
  RecommendationOutput,
} from '@/lib/recommendation-contract';

type JobsListPayload = {
  items: Job[];
  total: number;
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

function isRecommendationOutput(val: unknown): val is RecommendationOutput {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return obj.contract_version === 1 && Array.isArray(obj.items);
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

function RecommendationCompanyLogo({
  company,
  logoUrl,
}: {
  company: string;
  logoUrl?: string | null;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="job-feed-card__logo"
      aria-hidden="true"
      title={company}
      style={{ overflow: 'hidden', flexShrink: 0 }}
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
  const [recOutput, setRecOutput] = useState<RecommendationOutput | null>(null);
  const [jobsMap, setJobsMap] = useState<Record<string, Job>>({});
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [expandedMissingKeys, setExpandedMissingKeys] = useState<Set<string>>(new Set());

  const [filters, setFilters] = useState<RecommendationFilters>(EMPTY_FILTERS);

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

    const [profileRes, recRes, jobsRes] = await Promise.all([
      apiFetch<ProfileRecord | null>('/api/profile'),
      apiFetch<RecommendationOutput>('/api/recommendations'),
      apiFetch<JobsListPayload>('/api/jobs?limit=50'),
    ]);

    if (profileRes.ok) {
      setProfile(profileRes.data);
    }

    const map: Record<string, Job> = {};
    if (jobsRes.ok && Array.isArray(jobsRes.data.items)) {
      for (const j of jobsRes.data.items) {
        map[j.id] = j;
      }
    }
    setJobsMap(map);

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
      const job = jobsMap[item.job_id];
      if (!job) {
        return activeFilterCount === 0;
      }
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
  }, [recOutput, jobsMap, filters, activeFilterCount]);

  const profileHasContent = Boolean(
    profile &&
      (profile.skills.length > 0 ||
        profile.education.length > 0 ||
        profile.experiences.length > 0 ||
        profile.preferences.positions.length > 0),
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
      ) : !profileHasContent ? (
        <EmptyState
          title="Lengkapi Profilmu untuk Mendapatkan Rekomendasi"
          description="Tambahkan keahlian, riwayat pendidikan, pengalaman, atau posisi yang kamu minati agar kami dapat mencocokkan profilmu dengan lowongan yang tersedia."
          action={
            <>
              <Link href="/onboarding" className="btn btn-primary btn-sm">
                Lengkapi Profil Sekarang
              </Link>
              <Link href="/profile" className="btn btn-outline btn-sm">
                Buka Halaman Profil
              </Link>
              <Link href="/jobs" className="btn btn-secondary btn-sm">
                Cari Semua Lowongan
              </Link>
            </>
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
                        onClick={() => setFilters(EMPTY_FILTERS)}
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
                      onChange={(work_modes) => setFilters({ ...filters, work_modes })}
                    />
                    <CheckboxGroup
                      legend="Jenis Kontrak"
                      options={EMPLOYMENT_FILTER_OPTS}
                      selected={filters.employment_types}
                      onChange={(employment_types) => setFilters({ ...filters, employment_types })}
                    />
                    <CheckboxGroup
                      legend="Tingkat Pengalaman"
                      options={LEVEL_FILTER_OPTS}
                      selected={filters.levels}
                      onChange={(levels) => setFilters({ ...filters, levels })}
                    />
                  </div>
                ) : null}
              </section>

              {filteredItems.length === 0 ? (
                <EmptyState
                  kicker="BELUM ADA HASIL REKOMENDASI"
                  title="Tidak Ada Item Rekomendasi untuk Ditampilkan"
                  description={
                    activeFilterCount > 0
                      ? 'Tidak ada rekomendasi yang cocok dengan kombinasi filter saat ini. Coba reset atau longgarkan filter.'
                      : 'Endpoint rekomendasi tidak mengembalikan lowongan yang sesuai dengan profil saat ini.'
                  }
                  action={
                    activeFilterCount > 0 ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setFilters(EMPTY_FILTERS)}
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
                <div className="jobs-list">
                  {filteredItems.map((item: RecommendationItem) => {
                    const job = jobsMap[item.job_id];
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

                              {job ? <JobStatusBadge status={job.status} /> : null}
                              {job ? (
                                <span className="job-timestamp">
                                  Diambil: {formatDateTimeId(job.last_fetched_at)}
                                </span>
                              ) : null}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                              {job ? (
                                <RecommendationCompanyLogo
                                  company={job.company}
                                  logoUrl={job.company_logo_url}
                                />
                              ) : null}
                              <div style={{ minWidth: 0 }}>
                                <h2 className="rec-card-title" style={{ marginTop: 0 }}>
                                  <Link href={`/jobs/${item.job_id}`}>
                                    {job ? job.title : `Lowongan #${item.job_id}`}
                                  </Link>
                                </h2>

                                {job ? (
                                  <p className="rec-card-company">
                                    {job.company} ·{' '}
                                    <span>{job.location || 'Lokasi tidak dicantumkan'}</span>
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="rec-card-cta">
                            <Link
                              href={`/jobs/${item.job_id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Detail &amp; Sumber Asli
                            </Link>
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
