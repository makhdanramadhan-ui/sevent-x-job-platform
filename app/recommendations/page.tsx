'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

function RecommendationsInner() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [recOutput, setRecOutput] = useState<RecommendationOutput | null>(null);
  const [jobsMap, setJobsMap] = useState<Record<string, Job>>({});
  const [endpointMissing, setEndpointMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [filters, setFilters] = useState<RecommendationFilters>(EMPTY_FILTERS);

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
      ) : (
        <>
          {/* Profile Readiness Bar */}
          {!profileHasContent ? (
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
                </>
              }
            />
          ) : (
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
          )}

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
                    const pct =
                      item.score <= 1 && item.score >= 0
                        ? Math.round(item.score * 100)
                        : Math.max(0, Math.min(100, Math.round(item.score)));
                    const isHighMatch = pct >= 70;

                    return (
                      <article key={item.job_id} className="rec-card">
                        <div className="rec-card-top">
                          <div className="rec-card-main">
                            <div className="rec-card-badges">
                              {job ? <JobStatusBadge status={job.status} /> : null}
                              {job ? (
                                <span className="job-timestamp">
                                  Diambil: {formatDateTimeId(job.last_fetched_at)}
                                </span>
                              ) : null}
                            </div>

                            <h2 className="rec-card-title">
                              <Link href={`/jobs/${item.job_id}`}>
                                {job ? job.title : `Lowongan #${item.job_id}`}
                              </Link>
                            </h2>

                            {job ? (
                              <p className="rec-card-company">
                                {job.company} ·{' '}
                                <span style={{ fontWeight: 400 }}>
                                  {job.location || 'Lokasi tidak dicantumkan'}
                                </span>
                              </p>
                            ) : null}
                          </div>

                          <div className="rec-card-side">
                            <div className="rec-score-box" aria-label={`Indeks kecocokan ${pct} persen`}>
                              <div className="rec-score-row">
                                <span className="rec-score-label">Kecocokan</span>
                                <span
                                  className={`rec-score-value${isHighMatch ? ' rec-score-value--high' : ''}`}
                                >
                                  {pct}%
                                </span>
                              </div>
                              <div className="rec-score-track" aria-hidden="true">
                                <div
                                  className={`rec-score-fill${isHighMatch ? ' rec-score-fill--high' : ''}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            <Link
                              href={`/jobs/${item.job_id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Detail &amp; Sumber Asli
                            </Link>
                          </div>
                        </div>

                        {/* Matched, Missing, Unknown Breakdown */}
                        <div className="rec-breakdown-grid">
                          <div className="rec-panel rec-panel--matched">
                            <div className="rec-panel-head">
                              <span className="rec-panel-label">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Alasan Cocok
                              </span>
                              <span className="rec-panel-count">{item.matched.length}</span>
                            </div>
                            {item.matched.length > 0 ? (
                              <div className="rec-chip-list">
                                {item.matched.map((m, i) => (
                                  <span key={`${m}-${i}`} className="rec-chip rec-chip--matched">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="rec-panel-empty">Tidak ada poin kecocokan tercatat.</p>
                            )}
                          </div>

                          <div className="rec-panel rec-panel--missing">
                            <div className="rec-panel-head">
                              <span className="rec-panel-label">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Perlu Dilengkapi
                              </span>
                              <span className="rec-panel-count">{item.missing.length}</span>
                            </div>
                            {item.missing.length > 0 ? (
                              <div className="rec-chip-list">
                                {item.missing.map((ms, i) => (
                                  <span key={`${ms}-${i}`} className="rec-chip rec-chip--missing">
                                    {ms}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="rec-panel-empty">
                                Tidak ada kekurangan persyaratan tercatat.
                              </p>
                            )}
                          </div>

                          <div className="rec-panel rec-panel--unknown">
                            <div className="rec-panel-head">
                              <span className="rec-panel-label">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10" />
                                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                  <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                Belum Terdata
                              </span>
                              <span className="rec-panel-count">{item.unknown.length}</span>
                            </div>
                            {item.unknown.length > 0 ? (
                              <div className="rec-chip-list">
                                {item.unknown.map((unk, i) => (
                                  <span key={`${unk}-${i}`} className="rec-chip rec-chip--unknown">
                                    {unk}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="rec-panel-empty">
                                Seluruh atribut pembanding terdata.
                              </p>
                            )}
                          </div>
                        </div>
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
