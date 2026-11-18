'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  Badge,
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

  const [filters, setFilters] = useState<RecommendationFilters>({
    work_modes: [],
    employment_types: [],
    levels: [],
  });

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

  const filteredItems = useMemo(() => {
    if (!recOutput) return [];
    return recOutput.items.filter((item) => {
      const job = jobsMap[item.job_id];
      if (!job) return true;
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
  }, [recOutput, jobsMap, filters]);

  const profileHasContent = Boolean(
    profile &&
      (profile.skills.length > 0 ||
        profile.education.length > 0 ||
        profile.experiences.length > 0 ||
        profile.preferences.positions.length > 0),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Rekomendasi Lowongan Untukmu</h1>
          <p className="page-subtitle">
            Lihat peluang kerja yang paling sesuai dengan keahlian, pengalaman, dan preferensi
            profilmu, beserta persyaratan yang masih perlu kamu lengkapi.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/profile" className="btn btn-outline btn-sm">
            Ubah Profil &amp; Preferensi
          </Link>
          <Link href="/jobs" className="btn btn-secondary btn-sm">
            Cari Semua Lowongan →
          </Link>
        </div>
      </div>

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
                    Lengkapi Profil Sekarang →
                  </Link>
                  <Link href="/profile" className="btn btn-outline btn-sm">
                    Buka Halaman Profil
                  </Link>
                </>
              }
            />
          ) : (
            <section className="surface-card" aria-label="Ringkasan profil kamu">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <strong style={{ fontSize: '0.95rem' }}>Ringkasan Kualifikasi Profilmu</strong>
                <Link href="/profile" className="font-mono" style={{ fontSize: '0.78rem' }}>
                  Perbarui Profil →
                </Link>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge variant="open">{profile?.skills.length ?? 0} Keahlian</Badge>
                <Badge variant="neutral">{profile?.education.length ?? 0} Pendidikan</Badge>
                <Badge variant="neutral">{profile?.experiences.length ?? 0} Pengalaman</Badge>
                <Badge variant="neutral">{profile?.projects.length ?? 0} Proyek</Badge>
                <Badge variant="neutral">
                  {profile?.preferences.positions.length ?? 0} Posisi Diminati
                </Badge>
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
                    Cari Lowongan Sekarang →
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
              <section className="surface-card" aria-label="Filter daftar rekomendasi">
                <div className="form-stack">
                  <CheckboxGroup
                    legend="Filter Mode Kerja"
                    options={WORK_MODE_FILTER_OPTS}
                    selected={filters.work_modes}
                    onChange={(work_modes) => setFilters({ ...filters, work_modes })}
                  />
                  <CheckboxGroup
                    legend="Filter Jenis Kontrak"
                    options={EMPLOYMENT_FILTER_OPTS}
                    selected={filters.employment_types}
                    onChange={(employment_types) => setFilters({ ...filters, employment_types })}
                  />
                  <CheckboxGroup
                    legend="Filter Tingkat Pengalaman"
                    options={LEVEL_FILTER_OPTS}
                    selected={filters.levels}
                    onChange={(levels) => setFilters({ ...filters, levels })}
                  />
                </div>
              </section>

              {filteredItems.length === 0 ? (
                <EmptyState
                  kicker="BELUM ADA HASIL REKOMENDASI"
                  title="Tidak Ada Item Rekomendasi untuk Ditampilkan"
                  description="Endpoint rekomendasi tidak mengembalikan lowongan yang sesuai dengan profil atau filter yang dipilih saat ini."
                  action={
                    <Link href="/jobs" className="btn btn-primary btn-sm">
                      Lihat Semua Lowongan di Feed →
                    </Link>
                  }
                />
              ) : (
                <div className="jobs-list">
                  {filteredItems.map((item: RecommendationItem) => {
                    const job = jobsMap[item.job_id];
                    const displayScore =
                      item.score <= 1 && item.score >= 0
                        ? `${Math.round(item.score * 100)}%`
                        : `${Math.round(item.score)}`;

                    return (
                      <article key={item.job_id} className="ledger-card">
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
                              <Badge variant="accent">Indeks Kecocokan: {displayScore}</Badge>
                              {job ? <JobStatusBadge status={job.status} /> : null}
                              {job ? (
                                <span className="job-timestamp">
                                  Diambil: {formatDateTimeId(job.last_fetched_at)}
                                </span>
                              ) : null}
                            </div>

                            <h2
                              className="font-editorial"
                              style={{ fontSize: '1.35rem', margin: '0 0 4px' }}
                            >
                              <Link
                                href={`/jobs/${item.job_id}`}
                                style={{ textDecoration: 'none' }}
                              >
                                {job ? job.title : `Lowongan #${item.job_id}`}
                              </Link>
                            </h2>

                            {job ? (
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
                            ) : null}
                          </div>

                          <Link
                            href={`/jobs/${item.job_id}`}
                            className="btn btn-primary btn-sm"
                          >
                            Detail &amp; Sumber Asli →
                          </Link>
                        </div>

                        {/* Matched, Missing, Unknown Breakdown */}
                        <div
                          className="form-grid-3"
                          style={{
                            marginTop: 16,
                            paddingTop: 14,
                            borderTop: '1px solid var(--border-subtle)',
                          }}
                        >
                          <div className="surface-card" style={{ padding: 14 }}>
                            <strong
                              className="font-mono"
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--status-open)',
                                display: 'block',
                                marginBottom: 8,
                              }}
                            >
                              ✓ ALASAN COCOK ({item.matched.length})
                            </strong>
                            {item.matched.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {item.matched.map((m, i) => (
                                  <Badge key={`${m}-${i}`} variant="matched">
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="form-hint">Tidak ada poin kecocokan tercatat.</p>
                            )}
                          </div>

                          <div className="surface-card" style={{ padding: 14 }}>
                            <strong
                              className="font-mono"
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--status-warning)',
                                display: 'block',
                                marginBottom: 8,
                              }}
                            >
                              ! BELUM COCOK / KURANG ({item.missing.length})
                            </strong>
                            {item.missing.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {item.missing.map((ms, i) => (
                                  <Badge key={`${ms}-${i}`} variant="missing">
                                    {ms}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="form-hint">Tidak ada kekurangan persyaratan tercatat.</p>
                            )}
                          </div>

                          <div className="surface-card" style={{ padding: 14 }}>
                            <strong
                              className="font-mono"
                              style={{
                                fontSize: '0.75rem',
                                color: 'var(--ink-muted)',
                                display: 'block',
                                marginBottom: 8,
                              }}
                            >
                              ? DATA TIDAK DIKETAHUI ({item.unknown.length})
                            </strong>
                            {item.unknown.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {item.unknown.map((unk, i) => (
                                  <Badge key={`${unk}-${i}`} variant="neutral">
                                    {unk}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="form-hint">Seluruh atribut pembanding terdata.</p>
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
