'use client';

import Link from 'next/link';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  EMPLOYMENT_TYPE_LABELS,
  formatDateId,
  JOB_STATUS_LABELS,
  SITE_NAME,
  WORK_MODE_LABELS,
} from '@/components/ui/api-client';
import { CompanyLogo } from '@/components/ui/company-logo';
import { ButtonText } from '@/components/ui/button-text';
import { Badge, JobStatusBadge } from '@/components/ui/forms';
import { ScrollStepsProgress } from '@/components/ui/scroll-motion';
import { useAuthSession } from './navigation';
import type { EmploymentType, ExperienceLevel, JobStatus, WorkMode } from '@/lib/contracts';
import { displaySourceName } from '@/lib/job-source';

export type LandingJob = {
  id: string;
  title: string;
  company: string;
  company_logo_url: string | null;
  location: string | null;
  work_mode: WorkMode;
  employment_type: EmploymentType;
  level: ExperienceLevel;
  status: JobStatus;
  deadline: string | null;
  last_fetched_at: string | null;
  updated_at: string;
  source_name: string | null;
  source_published_at: string | null;
  source_fetched_at: string | null;
  matched?: string[];
  missing?: string[];
  unknown?: string[];
};

export type LandingPreviewPayload = {
  mode: 'recommendations' | 'recent';
  auth_state: 'guest' | 'without_profile' | 'ready';
  count: number;
  count_capped: boolean;
  total_jobs: number;
  source_count: number;
  updated_at: string | null;
  jobs: LandingJob[];
  reason?: string;
};

const EMPTY_PREVIEW: LandingPreviewPayload = {
  mode: 'recent',
  auth_state: 'guest',
  count: 0,
  count_capped: false,
  total_jobs: 0,
  source_count: 0,
  updated_at: null,
  jobs: [],
};

function formatRelativeId(value: string | null | undefined): string {
  if (!value) return 'waktu tidak diketahui';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'waktu tidak diketahui';
  const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit yang lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam yang lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari yang lalu`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan yang lalu`;
  return `${Math.floor(months / 12)} tahun yang lalu`;
}

function jobMeta(job: LandingJob): string {
  return [
    job.location || 'Lokasi tidak dicantumkan',
    WORK_MODE_LABELS[job.work_mode] ?? job.work_mode,
    EMPLOYMENT_TYPE_LABELS[job.employment_type] ?? job.employment_type,
  ].join(' · ');
}

function realStatusLabel(job: LandingJob | null): string {
  if (!job) return 'Status tidak tersedia';
  if (job.status === 'open' || job.status === 'closed') return JOB_STATUS_LABELS[job.status];
  if (job.deadline) return `Tenggat ${formatDateId(job.deadline)}`;
  return 'Status tidak tercantum';
}

function matchList(
  items: string[] | undefined,
  unknownItems: string[] | undefined,
  emptyText: string,
): string[] {
  if (items && items.length > 0) return items;
  if (unknownItems && unknownItems.length > 0) {
    return unknownItems.slice(0, 3).map((item) => `Belum bisa dipastikan: ${item}`);
  }
  return [emptyText];
}

const WORKFLOW_STEPS = [
  {
    num: '01',
    title: 'Lengkapi profil dan preferensi kerja',
    desc: 'Tambahkan keahlian, pendidikan, pengalaman kerja, serta pilihan kota dan sistem kerja yang kamu cari.',
    href: '/onboarding',
    label: 'Isi profil',
  },
  {
    num: '02',
    title: 'Saring dan simpan lowongan yang sesuai',
    desc: 'Gunakan filter bidang, lokasi, kontrak, dan jenjang pengalaman, lalu simpan lowongan pilihanmu.',
    href: '/jobs',
    label: 'Cari lowongan',
  },
  {
    num: '03',
    title: 'Cek kecocokan dan rapikan dokumen CV',
    desc: 'Tinjau syarat yang sudah cocok maupun yang masih kurang di profilmu, lalu perbarui CV di Studio CV.',
    href: '/recommendations',
    label: 'Lihat rekomendasi',
  },
  {
    num: '04',
    title: 'Kirim lamaran langsung di situs resmi',
    desc: 'Buka halaman detail lowongan untuk memeriksa tautan sumber asli dan melamar langsung ke penyelenggara.',
    href: '/bookmarks',
    label: 'Lowongan tersimpan',
  },
] as const;

type LandingPreviewContextValue = {
  preview: LandingPreviewPayload;
  authLoading: boolean;
  loading: boolean;
  jobs: LandingJob[];
  selectedJob: LandingJob | null;
  setSelectedId: (id: string | null) => void;
  statsText: string;
  headerMeta: string;
  ctaHref: string;
  ctaLabel: string;
  emptyText: string;
  emptyActionLabel: string;
  emptyActionHref: string;
  sourceTime: string;
  matchedItems: string[];
  missingItems: string[];
};

const LandingPreviewContext = createContext<LandingPreviewContextValue | null>(null);

function useLandingPreview(): LandingPreviewContextValue {
  const ctx = useContext(LandingPreviewContext);
  if (!ctx) {
    throw new Error('useLandingPreview must be used within LandingPreviewProvider');
  }
  return ctx;
}

export function LandingPreviewProvider({ children }: { children: ReactNode }) {
  const [preview, setPreview] = useState<LandingPreviewPayload>(EMPTY_PREVIEW);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { session, loading: authLoading } = useAuthSession();

  useEffect(() => {
    let active = true;
    async function loadPreview() {
      const res = await apiFetch<LandingPreviewPayload>('/api/landing-preview');
      if (!active) return;
      if (res.ok) {
        setPreview(res.data);
        setSelectedId(res.data.jobs[0]?.id ?? null);
      } else {
        setPreview(EMPTY_PREVIEW);
        setSelectedId(null);
      }
      setLoading(false);
    }
    void loadPreview();
    return () => {
      active = false;
    };
  }, []);

  const jobs = preview.jobs;
  const selectedJob = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;
  const statsText = loading
    ? 'Memuat lowongan dari sumber resmi...'
    : preview.total_jobs > 0 || jobs.length > 0
      ? `${preview.total_jobs} lowongan dari ${preview.source_count} sumber${preview.updated_at ? ` · diperbarui ${formatRelativeId(preview.updated_at)}` : ''}`
      : 'Belum ada lowongan dari sumber resmi.';
  const headerMeta = loading
    ? 'Memuat data...'
    : preview.auth_state === 'ready'
      ? `${preview.count}${preview.count_capped ? '+' : ''} rekomendasi`
      : 'Belum ada rekomendasi';
  const ctaHref =
    authLoading || !session ? '/login' : session.has_profile ? '/profile' : '/onboarding';
  const emptyActionHref =
    authLoading || !session
      ? '/login'
      : session.has_profile
        ? '/recommendations'
        : '/onboarding';
  const ctaLabel =
    authLoading || !session
      ? 'Masuk untuk melihat kecocokan'
      : 'Lengkapi bidang & keahlian di profil untuk melihat kecocokan';
  const emptyText = authLoading
    ? 'Memuat data lowongan...'
    : session
      ? session.has_profile
        ? 'Belum ada rekomendasi yang bisa ditampilkan saat ini.'
        : 'Lengkapi bidang & keahlian di profil untuk melihat lowongan yang sesuai'
      : 'Masuk dan lengkapi bidang & keahlian untuk melihat lowongan yang sesuai profilmu';
  const emptyActionLabel = authLoading
    ? ''
    : session
      ? session.has_profile
        ? 'Lihat Rekomendasi'
        : 'Lengkapi Profil'
      : 'Masuk';
  const sourceTime = selectedJob
    ? formatRelativeId(
        selectedJob.source_published_at ??
          selectedJob.source_fetched_at ??
          selectedJob.last_fetched_at,
      )
    : '';

  const matchedItems =
    selectedJob && preview.mode === 'recommendations'
      ? matchList(
          selectedJob.matched,
          selectedJob.unknown,
          'Belum ada poin kecocokan yang tercatat.',
        )
      : [];
  const missingItems =
    selectedJob && preview.mode === 'recommendations'
      ? matchList(
          selectedJob.missing,
          selectedJob.unknown,
          'Tidak ada syarat yang kurang dari profilmu.',
        )
      : [];

  return (
    <LandingPreviewContext.Provider
      value={{
        authLoading,
        preview,
        loading,
        jobs,
        selectedJob,
        setSelectedId,
        statsText,
        headerMeta,
        ctaHref,
        ctaLabel,
        emptyText,
        emptyActionLabel,
        emptyActionHref,
        sourceTime,
        matchedItems,
        missingItems,
      }}
    >
      {children}
    </LandingPreviewContext.Provider>
  );
}

export function LandingHeroStats() {
  const { preview, jobs, statsText } = useLandingPreview();

  return (
    <div className="tk-hero__avatars-row">
      {preview.auth_state === 'ready' && jobs.length > 0 ? (
        <div className="tk-avatar-stack" aria-hidden="true">
          {jobs.slice(0, 3).map((job) => (
            <CompanyLogo
              key={job.id}
              company={job.company}
              logoUrl={job.company_logo_url}
            />
          ))}
        </div>
      ) : null}
      <span style={{ fontSize: '0.875rem', color: 'var(--p-muted)', lineHeight: 1.4 }}>
        {statsText}
      </span>
    </div>
  );
}

export function LandingPreviewStage() {
  const {
    authLoading,
    preview,
    loading,
    jobs,
    selectedJob,
    setSelectedId,
    headerMeta,
    ctaHref,
    ctaLabel,
    emptyText,
    emptyActionLabel,
    emptyActionHref,
    sourceTime,
    matchedItems,
    missingItems,
  } = useLandingPreview();

  return (
    <div className="tk-hero__stage">
      <div className="tk-app-window">
        <div className="tk-app-bar">
          <div className="tk-app-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>{SITE_NAME} — Pencarian &amp; Pemetaan Lowongan</span>
          <span className="font-mono tk-app-bar-meta" style={{ fontSize: '0.75rem' }}>
            {headerMeta}
          </span>
        </div>

        <div className="tk-app-body">
          {loading || authLoading || preview.auth_state !== 'ready' ? (
            <div className="tk-app-empty-state" role="status">
              <strong>{loading || authLoading ? 'Memuat data lowongan...' : emptyText}</strong>
              {loading || authLoading ? (
                <span className="btn btn-primary btn-sm auth-cta-placeholder" aria-hidden="true" />
              ) : (
                <Link href={emptyActionHref} className="btn btn-primary btn-sm">
                  <ButtonText>{emptyActionLabel}</ButtonText>
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="tk-app-sidebar" role="tablist" aria-label="Pilih lowongan">
                {jobs.length > 0 ? (
                  jobs.map((job) => {
                    const active = selectedJob?.id === job.id;
                    return (
                      <button
                        key={job.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`tk-app-job-item ${active ? 'tk-app-job-item--active' : ''}`}
                        onClick={() => setSelectedId(job.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <CompanyLogo
                            company={job.company}
                            logoUrl={job.company_logo_url}
                            size={40}
                            rounded={10}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 500,
                                fontSize: '0.9rem',
                                color: 'var(--p-ink)',
                                marginBottom: 2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {job.title}
                            </div>
                            <div
                              style={{
                                fontSize: '0.78rem',
                                color: 'var(--p-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {job.company} · {job.location || 'Lokasi tidak dicantumkan'}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="tk-app-job-item" aria-hidden="true">
                    Belum ada lowongan
                  </div>
                )}
              </div>

              <div className="tk-app-detail" role="tabpanel">
                {!selectedJob ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      gap: 10,
                      minHeight: 260,
                    }}
                  >
                    <strong style={{ color: 'var(--p-ink)' }}>
                      Belum ada lowongan untuk ditampilkan
                    </strong>
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--p-muted)',
                        fontSize: '0.88rem',
                        maxWidth: '46ch',
                      }}
                    >
                      Data lowongan belum tersedia. Coba lihat halaman Lowongan untuk hasil
                      terbaru.
                    </p>
                    <Link href="/jobs" className="btn btn-primary btn-sm">
                      <ButtonText>Lihat halaman Lowongan</ButtonText>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <CompanyLogo
                          company={selectedJob.company}
                          logoUrl={selectedJob.company_logo_url}
                          size={46}
                          rounded={12}
                        />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '1.2rem',
                              fontWeight: 500,
                              color: 'var(--p-ink)',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {selectedJob.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.88rem',
                              color: 'var(--p-muted)',
                              marginTop: 2,
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {selectedJob.company} · {jobMeta(selectedJob)}
                          </div>
                        </div>
                      </div>
                      {selectedJob.status === 'open' || selectedJob.status === 'closed' ? (
                        <JobStatusBadge status={selectedJob.status} />
                      ) : selectedJob.deadline ? (
                        <Badge variant="warning">Tenggat {formatDateId(selectedJob.deadline)}</Badge>
                      ) : null}
                    </div>

                    {preview.mode === 'recommendations' &&
                    selectedJob.matched &&
                    selectedJob.missing ? (
                      <div className="tk-app-match-grid">
                        <div className="tk-app-match-col">
                          <div className="tk-app-match-head">
                            <span
                              className="tk-app-match-dot tk-app-match-dot--open"
                              aria-hidden="true"
                            />
                            <span className="tk-app-match-title">Cocok dengan profilmu</span>
                            <span className="tk-app-match-count">{matchedItems.length}</span>
                          </div>
                          <ul className="tk-app-match-list">
                            {matchedItems.slice(0, 3).map((item, index) => (
                              <li key={`${item}-${index}`} className="tk-app-match-item">
                                <svg
                                  className="tk-app-match-icon tk-app-match-icon--open"
                                  width="14"
                                  height="14"
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
                                <span>{item}</span>
                              </li>
                            ))}
                            {matchedItems.length > 3 ? (
                              <li className="tk-app-match-more">
                                +{matchedItems.length - 3} poin kecocokan lainnya
                              </li>
                            ) : null}
                          </ul>
                        </div>

                        <div className="tk-app-match-col tk-app-match-col--right">
                          <div className="tk-app-match-head">
                            <span
                              className="tk-app-match-dot tk-app-match-dot--missing"
                              aria-hidden="true"
                            />
                            <span className="tk-app-match-title">Perlu dilengkapi</span>
                            <span className="tk-app-match-count">{missingItems.length}</span>
                          </div>
                          <ul className="tk-app-match-list">
                            {missingItems.slice(0, 3).map((item, index) => (
                              <li key={`${item}-${index}`} className="tk-app-match-item">
                                <svg
                                  className="tk-app-match-icon tk-app-match-icon--missing"
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
                                  <circle cx="12" cy="12" r="9" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{item}</span>
                              </li>
                            ))}
                            {missingItems.length > 3 ? (
                              <li className="tk-app-match-more">
                                +{missingItems.length - 3} catatan lainnya
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="tk-app-match-cta">
                        <div className="tk-app-match-cta__title">{ctaLabel}</div>
                        <p className="tk-app-match-cta__desc">
                          Isi profil untuk melihat syarat yang cocok dan yang masih perlu kamu
                          lengkapi sebelum melamar.
                        </p>
                        {authLoading ? (
                          <span className="auth-link-placeholder" aria-hidden="true" />
                        ) : (
                          <Link
                            href={ctaHref}
                            style={{
                              color: 'var(--p-action)',
                              fontSize: '0.84rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                            }}
                          >
                            Lengkapi Profil
                          </Link>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 10,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                        fontSize: '0.8125rem',
                        color: 'var(--p-muted)',
                      }}
                    >
                      <span>
                        {displaySourceName(selectedJob.source_name)} · {sourceTime}
                      </span>
                      <Link
                        href={`/jobs/${selectedJob.id}`}
                        style={{
                          color: 'var(--p-action)',
                          fontWeight: 500,
                          textDecoration: 'none',
                        }}
                      >
                        Buka di halaman Lowongan
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="tk-hero__fade" aria-hidden="true" />
    </div>
  );
}

export function LandingBentoCard1Panel() {
  const { selectedJob } = useLandingPreview();

  return (
    <div className="tk-feature-panel tk-feature-panel--sky" aria-hidden="true">
      <div className="tk-ui-frag">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'var(--p-surface)',
            marginBottom: 12,
            color: 'var(--p-ink)',
            fontWeight: 500,
            gap: 8,
          }}
        >
          <span>Cari posisi atau perusahaan...</span>
          <span
            style={{
              background: 'var(--p-action)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
            }}
          >
            Cari
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="badge badge-accent">
            {selectedJob ? (WORK_MODE_LABELS[selectedJob.work_mode] ?? selectedJob.work_mode) : 'Mode kerja'}
          </span>
          <span className="badge">{selectedJob?.location || 'Lokasi tidak dicantumkan'}</span>
          <span className="badge">
            {selectedJob
              ? (EMPLOYMENT_TYPE_LABELS[selectedJob.employment_type] ?? selectedJob.employment_type)
              : 'Jenis kontrak'}
          </span>
          <span className="badge">{selectedJob ? realStatusLabel(selectedJob) : 'Status'}</span>
        </div>
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            color: 'var(--p-muted)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {selectedJob ? (
              <>
                <CompanyLogo
                  company={selectedJob.company}
                  logoUrl={selectedJob.company_logo_url}
                  size={28}
                  rounded={7}
                />
                <strong
                  style={{
                    color: 'var(--p-ink)',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selectedJob.title} · {selectedJob.location || 'Lokasi tidak dicantumkan'}
                </strong>
              </>
            ) : (
              <span className="skeleton-line" style={{ width: 180 }} />
            )}
          </div>
          <span>{selectedJob ? realStatusLabel(selectedJob) : 'Status tidak tersedia'}</span>
        </div>
      </div>
    </div>
  );
}

export function LandingBentoCard2Panel() {
  const { selectedJob } = useLandingPreview();

  return (
    <div className="tk-feature-panel tk-feature-panel--sage" aria-hidden="true">
      <div className="tk-ui-frag">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
            minWidth: 0,
          }}
        >
          {selectedJob ? (
            <CompanyLogo
              company={selectedJob.company}
              logoUrl={selectedJob.company_logo_url}
              size={32}
              rounded={8}
            />
          ) : (
            <span className="skeleton-line" style={{ width: 32, height: 32, borderRadius: 8 }} />
          )}
          <div
            style={{
              fontWeight: 500,
              color: 'var(--p-ink)',
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedJob ? `Pemetaan profil: ${selectedJob.title}` : 'Pemetaan profil terhadap syarat posisi'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'var(--status-open-bg)',
              color: 'var(--status-open)',
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedJob?.matched?.[0] ?? 'Isi profil untuk melihat kecocokan'}
            </span>
            <strong>Cocok</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 8,
              background: 'var(--status-warning-bg)',
              color: 'var(--status-warning)',
            }}
          >
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedJob?.missing?.[0] ?? 'Belum ada data kekurangan'}
            </span>
            <strong>Belum ada</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingBentoCard4Panel() {
  const { selectedJob, sourceTime } = useLandingPreview();

  return (
    <div className="tk-feature-panel tk-feature-panel--mist" aria-hidden="true">
      <div className="tk-ui-frag">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 10,
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ fontWeight: 500, color: 'var(--p-ink)' }}>
            {selectedJob ? displaySourceName(selectedJob.source_name) : 'Sumber Asli'}
          </strong>
          <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--p-muted)' }}>
            {selectedJob ? `Diambil ${sourceTime}` : 'Waktu tidak tersedia'}
          </span>
        </div>
        <p style={{ margin: '0 0 14px', color: 'var(--p-muted)', fontSize: '0.82rem' }}>
          Membuka halaman pendaftaran resmi perusahaan di tab baru. Kamu memegang kendali
          penuh atas berkas yang dikirim.
        </p>
        <div
          style={{
            background: 'var(--p-ink)',
            color: '#ffffff',
            textAlign: 'center',
            padding: '9px 14px',
            borderRadius: 8,
            fontWeight: 500,
          }}
        >
          Buka &amp; Lamar di Sumber Asli
        </div>
      </div>
    </div>
  );
}

export function LandingWorkflowSteps() {
  return (
    <ScrollStepsProgress>
      {(activeIndex) => (
        <div className="tk-steps-list">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx <= activeIndex;
            return (
              <div
                key={step.num}
                className={`tk-step-row ${isActive ? 'tk-step-row--active' : ''} ${
                  !isPast ? 'tk-step-row--dim' : ''
                }`.trim()}
              >
                <span className="tk-step-num">{step.num}</span>
                <h3 className="tk-step-title">{step.title}</h3>
                <p className="tk-step-desc">{step.desc}</p>
                <Link href={step.href} className="tk-step-link">
                  {step.label}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </ScrollStepsProgress>
  );
}
