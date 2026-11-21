'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  apiFetch,
  EMPLOYMENT_TYPE_LABELS,
  formatDateId,
  JOB_STATUS_LABELS,
  SITE_NAME,
  WORK_MODE_LABELS,
} from '@/components/ui/api-client';
import { CompanyLogo } from '@/components/ui/company-logo';
import { Badge, JobStatusBadge } from '@/components/ui/forms';
import {
  ScrollReveal,
  ScrollStepsProgress,
  ScrollWordHighlight,
} from '@/components/ui/scroll-motion';
import type { EmploymentType, ExperienceLevel, JobStatus, WorkMode } from '@/lib/contracts';
import { displaySourceName } from '@/lib/job-source';

type LandingJob = {
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

type LandingPreviewPayload = {
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

export default function HomePage() {
  const [preview, setPreview] = useState<LandingPreviewPayload>(EMPTY_PREVIEW);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const ctaHref = preview.auth_state === 'guest' ? '/login' : '/profile';
  const ctaLabel =
    preview.auth_state === 'guest'
      ? 'Masuk untuk melihat kecocokan'
      : 'Lengkapi bidang & keahlian di profil untuk melihat kecocokan';
  const emptyText =
    preview.auth_state === 'guest'
      ? 'Masuk dan lengkapi bidang & keahlian untuk melihat lowongan yang sesuai profilmu'
      : 'Lengkapi bidang & keahlian di profil untuk melihat lowongan yang sesuai';
  const emptyActionLabel = preview.auth_state === 'guest' ? 'Masuk' : 'Lengkapi Profil';
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
    <div>
      <section className="tk-hero" aria-labelledby="hero-heading">
        <div className="tk-hero__top">
          <div className="tk-hero__text">
            <h1 id="hero-heading" className="tk-hero__h1">
              Cari lowongan Indonesia dan cek kecocokan profilmu.
            </h1>
            <p className="tk-hero__lead">
              Saring peluang kerja lintas bidang dari sumber resmi, lihat syarat yang cocok maupun
              yang belum tercantum di profilmu, lalu susun CV sebelum melamar.
            </p>
            <div className="tk-hero__actions">
              <Link href="/jobs" className="btn btn-primary btn-lg">
                Cari Lowongan
              </Link>
              <Link href="/signup" className="btn btn-outline btn-lg">
                Daftar Akun
              </Link>
            </div>

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
          </div>

          <div className="tk-hero__visual">
            <Image
              src="/images/hero-3d-seeker.jpg"
              alt="Ilustrasi 3D pencari kerja Indonesia menyiapkan lamaran dan CV dengan laptop"
              width={1200}
              height={896}
              priority
              fetchPriority="high"
              sizes="(max-width: 960px) 100vw, 480px"
            />
          </div>
        </div>

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
              {loading || preview.auth_state !== 'ready' ? (
                <div className="tk-app-empty-state" role="status">
                  <strong>{loading ? 'Memuat data lowongan...' : emptyText}</strong>
                  <Link
                    href={ctaHref}
                    className="btn btn-primary btn-sm"
                    style={loading ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
                    aria-hidden={loading || undefined}
                    tabIndex={loading ? -1 : undefined}
                  >
                    {emptyActionLabel}
                  </Link>
                </div>
              ) : (
                <>
              <div className="tk-app-sidebar" role="tablist" aria-label="Pilih lowongan">
                {loading
                  ? [0, 1, 2].map((index) => (
                      <div key={index} className="tk-app-job-item" aria-hidden="true">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            className="skeleton-line"
                            style={{ width: 40, height: 40, borderRadius: 10 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span
                              className="skeleton-line"
                              style={{ width: '85%', marginBottom: 7 }}
                            />
                            <span className="skeleton-line" style={{ width: '60%' }} />
                          </div>
                        </div>
                      </div>
                    ))
                  : jobs.length > 0
                    ? jobs.map((job) => {
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
                    : (
                        <div className="tk-app-job-item" aria-hidden="true">
                          Belum ada lowongan
                        </div>
                      )}
              </div>

              <div className="tk-app-detail" role="tabpanel">
                {loading ? (
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          className="skeleton-line"
                          style={{ width: 46, height: 46, borderRadius: 12 }}
                        />
                        <div>
                          <span
                            className="skeleton-line"
                            style={{ width: 220, height: 18, marginBottom: 8 }}
                          />
                          <span className="skeleton-line" style={{ width: 300 }} />
                        </div>
                      </div>
                      <span
                        className="skeleton-line"
                        style={{ width: 92, height: 26, borderRadius: 999 }}
                      />
                    </div>
                    <div className="tk-app-match-grid">
                      <div className="tk-app-match-box">
                        <span className="skeleton-line" style={{ width: '70%', marginBottom: 8 }} />
                        <span className="skeleton-line" style={{ width: '90%', marginBottom: 6 }} />
                        <span className="skeleton-line" style={{ width: '75%' }} />
                      </div>
                      <div className="tk-app-match-box">
                        <span className="skeleton-line" style={{ width: '70%', marginBottom: 8 }} />
                        <span className="skeleton-line" style={{ width: '85%', marginBottom: 6 }} />
                        <span className="skeleton-line" style={{ width: '65%' }} />
                      </div>
                    </div>
                    <div
                      style={{
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <span className="skeleton-line" style={{ width: 180 }} />
                      <span className="skeleton-line" style={{ width: 150 }} />
                    </div>
                  </>
                ) : !selectedJob ? (
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
                      Lihat halaman Lowongan
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
      </section>

      {/* SCROLL MOMENT: Word-Highlight Statement (tasteskill) */}
      <section aria-label="Ringkasan cara kerja RakitKarier">
        <ScrollWordHighlight
          text={`Di ${SITE_NAME}, kamu tidak hanya melihat daftar lowongan, tetapi langsung memahami syarat mana yang cocok dengan profilmu, melengkapi CV, lalu melamar di situs resmi perusahaan.`}
          accentWords={[SITE_NAME, 'cocok', 'profilmu', 'CV', 'resmi']}
        />
      </section>

      {/* INDONESIAN COMPANIES SHOWCASE (3x2 Grid Left + Copy & CTA Right) */}
      <ScrollReveal>
        <section className="tk-companies-section" aria-labelledby="heading-companies">
          <div className="tk-companies-split">
            <div
              className="tk-companies-grid"
              role="group"
              aria-label="Contoh perusahaan terkemuka di Indonesia"
            >
              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#003D79' }}>
                  mandiri
                </span>
                <span className="tk-company-bar" aria-hidden="true">
                  <span style={{ flex: 1, background: '#FFB700' }} />
                </span>
                <span className="tk-company-sector">Perbankan</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#111111', fontSize: '1.1rem' }}>
                  Telkom <span style={{ color: '#CC1F16' }}>Indonesia</span>
                </span>
                <span className="tk-company-sector">Telekomunikasi</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#00880F', fontSize: '1.45rem' }}>
                  goto
                </span>
                <span className="tk-company-sector">Teknologi Digital</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#006CB7', fontSize: '1.08rem', letterSpacing: '0.02em' }}>
                  PERTAMINA
                </span>
                <span className="tk-company-bar" aria-hidden="true">
                  <span style={{ flex: 1, background: '#006CB7' }} />
                  <span style={{ flex: 1, background: '#8CC63F' }} />
                  <span style={{ flex: 1, background: '#ED1C24' }} />
                </span>
                <span className="tk-company-sector">Energi &amp; Rekayasa</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#005DAA', fontSize: '1.45rem', letterSpacing: '0.04em' }}>
                  BCA
                </span>
                <span className="tk-company-sector">Jasa Keuangan</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#00338D', fontSize: '1.3rem', letterSpacing: '0.06em' }}>
                  ASTRA
                </span>
                <span className="tk-company-sector">Otomotif &amp; Industri</span>
              </Link>
            </div>

            <div className="tk-companies-copy">
              <h2 id="heading-companies">
                Temukan pekerjaan yang kamu sukai di berbagai perusahaan Indonesia.
              </h2>
              <p>
                Langkah kariermu berikutnya bisa dimulai dari perusahaan lintas sektor—telusuri
                lowongan dan buka langsung halaman karier resminya.
              </p>
              <Link href="/jobs" className="btn btn-outline btn-lg">
                Lihat semua lowongan
              </Link>
              <span className="tk-companies-footnote">
                Nama dan merek perusahaan adalah milik masing-masing pemegang hak.
              </span>
            </div>
          </div>
        </section>
      </ScrollReveal>

      {/* 2. FEATURE BENTO (2x2 clean white cards with 3D render & live UI fragments) */}
      <ScrollReveal>
        <section className="tk-surface-band" aria-labelledby="heading-features">
        <div className="tk-section__head">
          <h2 id="heading-features" className="tk-section__h2">
            Semua alat persiapan melamar.{' '}
            <span className="muted">Terhubung dalam satu akun.</span>
          </h2>
          <p className="tk-section__intro">
            Setiap bagian dirancang agar kamu dapat menyaring lowongan lebih cepat, memahami
            kesiapan profil, dan menyiapkan CV dengan rapi.
          </p>
        </div>

        <div className="tk-bento-grid">
          {/* Card 1: Search & Filter */}
          <article className="tk-feature-card">
            <div>
              <h3 className="tk-feature-card__title">Saring lowongan lintas bidang</h3>
              <p className="tk-feature-card__desc">
                Cari posisi menurut kota di Indonesia, mode kerja Onsite, Hybrid, atau Remote,
                hingga jenjang pengalaman dari magang sampai senior.
              </p>
            </div>
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
          </article>

          {/* Card 2: Profile Matching */}
          <article className="tk-feature-card">
            <div>
              <h3 className="tk-feature-card__title">Cek alasan cocok dan syarat yang kurang</h3>
              <p className="tk-feature-card__desc">
                Lihat bagian kualifikasi mana yang sudah selaras dengan profilmu dan keahlian apa
                yang sebaiknya kamu lengkapi sebelum mendaftar.
              </p>
            </div>
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
          </article>

          {/* Card 3: Studio CV with bespoke 3D workspace render */}
          <article className="tk-feature-card">
            <div>
              <h3 className="tk-feature-card__title">Buat CV baru atau impor CV lama</h3>
              <p className="tk-feature-card__desc">
                Susun riwayat pendidikan, pengalaman kerja, proyek, dan pencapaian ke format yang
                rapi, lalu unduh dalam bentuk PDF siap kirim.
              </p>
            </div>
            <div className="tk-feature-panel tk-feature-panel--photo">
              <Image
                src="/images/cv-3d-workspace.jpg"
                alt="Ilustrasi 3D dokumen CV, tas kerja, pena biru, dan kaca pembesar di meja kerja"
                width={1376}
                height={768}
                loading="lazy"
                sizes="(max-width: 960px) 100vw, 560px"
              />
            </div>
          </article>

          {/* Card 4: Original Source */}
          <article className="tk-feature-card">
            <div>
              <h3 className="tk-feature-card__title">Lamar langsung di sumber resmi</h3>
              <p className="tk-feature-card__desc">
                Setiap detail lowongan menampilkan asal sumber dan waktu pembaruan data agar kamu
                dapat mendaftar langsung di halaman resmi perusahaan.
              </p>
            </div>
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
          </article>
        </div>
      </section>
      </ScrollReveal>

      {/* 3. CALM STEPS SECTION (Scroll-linked vertical progress rail) */}
      <section className="tk-section" aria-labelledby="heading-steps">
        <ScrollReveal>
          <div className="tk-section__head">
            <h2 id="heading-steps" className="tk-section__h2">
              Alur melamar kerja di {SITE_NAME}.
            </h2>
            <p className="tk-section__intro">
              Empat langkah sederhana dari pembuatan profil hingga membuka halaman pendaftaran
              resmi.
            </p>
          </div>
        </ScrollReveal>

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
      </section>
    </div>
  );
}
