'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ScrollReveal,
  ScrollStepsProgress,
  ScrollWordHighlight,
  SITE_NAME,
} from '@/components/ui';

type PreviewRole = {
  id: string;
  title: string;
  company: string;
  location: string;
  mode: string;
  type: string;
  level: string;
  source: string;
  fetched: string;
  avatar: string;
  avatarAlt: string;
  matched: string[];
  missing: string[];
};

const PREVIEW_ROLES: readonly PreviewRole[] = [
  {
    id: 'frontend',
    title: 'Frontend Engineer',
    company: 'PT Sentosa Teknologi',
    location: 'Jakarta Selatan',
    mode: 'Hybrid',
    type: 'Penuh waktu',
    level: 'Junior – Mid',
    source: 'Portal Karier Perusahaan',
    fetched: 'Diperbarui 2 jam lalu',
    avatar: '/images/avatar-frontend.jpg',
    avatarAlt: 'Avatar 3D pelamar bidang rekayasa perangkat lunak',
    matched: ['TypeScript & React', 'Sistem kerja Hybrid', 'Domisili Jabodetabek'],
    missing: ['Pengujian end-to-end (Playwright)'],
  },
  {
    id: 'finance',
    title: 'Analis Keuangan & Pelaporan',
    company: 'PT Karya Mandiri Niaga',
    location: 'Surabaya',
    mode: 'Onsite',
    type: 'Penuh waktu',
    level: 'Fresh Graduate',
    source: 'Laman Rekrutmen Resmi',
    fetched: 'Diperbarui hari ini',
    avatar: '/images/avatar-finance.jpg',
    avatarAlt: 'Avatar 3D pelamar bidang keuangan dan bisnis',
    matched: ['S1 Akuntansi / Manajemen', 'Analisis laporan keuangan', 'Microsoft Excel'],
    missing: ['Sertifikasi Brevet Pajak A/B'],
  },
  {
    id: 'design',
    title: 'Product Designer',
    company: 'PT Ruang Kreasi Digital',
    location: 'Bandung',
    mode: 'Remote',
    type: 'Kontrak',
    level: 'Mid-Level',
    source: 'Portal Karier Resmi',
    fetched: 'Diperbarui kemarin',
    avatar: '/images/avatar-designer.jpg',
    avatarAlt: 'Avatar 3D pelamar bidang desain produk',
    matched: ['Figma & Design System', 'Riset pengguna', 'Sistem kerja Remote'],
    missing: ['Studi kasus produk mobile B2B'],
  },
];

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
  const [selectedId, setSelectedId] = useState<string>(PREVIEW_ROLES[0].id);
  const selectedRole =
    PREVIEW_ROLES.find((item) => item.id === selectedId) ?? PREVIEW_ROLES[0];

  return (
    <div>
      {/* 1. HERO: Split with 3D Career Avatar + Interactive App-Frame */}
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
              <div className="tk-avatar-stack" aria-hidden="true">
                <img src="/images/avatar-frontend.jpg" alt="" />
                <img src="/images/avatar-finance.jpg" alt="" />
                <img src="/images/avatar-designer.jpg" alt="" />
              </div>
              <span style={{ fontSize: '0.875rem', color: 'var(--p-muted)', lineHeight: 1.4 }}>
                Terbuka untuk magang, fresh graduate, hingga profesional lintas bidang.
              </span>
            </div>
          </div>

          <div className="tk-hero__visual">
            <img
              src="/images/hero-3d-seeker.jpg"
              alt="Ilustrasi 3D pencari kerja Indonesia menyiapkan lamaran dan CV dengan laptop"
            />
          </div>
        </div>

        {/* Live HTML Application Window inside Calm Lit Frame */}
        <ScrollReveal delayMs={100}>
          <div className="tk-hero__stage" aria-label={`Pratinjau antarmuka ${SITE_NAME}`}>
          <div className="tk-app-window">
            <div className="tk-app-bar">
              <div className="tk-app-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span>{SITE_NAME} — Pencarian &amp; Pemetaan Lowongan</span>
              <span className="font-mono tk-app-bar-meta" style={{ fontSize: '0.75rem' }}>
                3 bidang kerja
              </span>
            </div>

            <div className="tk-app-body">
              {/* Interactive Sidebar List with 3D Avatars */}
              <div className="tk-app-sidebar" role="tablist" aria-label="Pilih contoh posisi">
                {PREVIEW_ROLES.map((role) => {
                  const active = role.id === selectedRole.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`tk-app-job-item ${active ? 'tk-app-job-item--active' : ''}`}
                      onClick={() => setSelectedId(role.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img
                          src={role.avatar}
                          alt=""
                          aria-hidden="true"
                          className="tk-role-avatar"
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
                            {role.title}
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
                            {role.location} · {role.mode}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active Role Detail Pane */}
              <div className="tk-app-detail" role="tabpanel">
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
                    <img
                      src={selectedRole.avatar}
                      alt={selectedRole.avatarAlt}
                      className="tk-role-avatar"
                      style={{ width: 46, height: 46, borderRadius: 12 }}
                    />
                    <div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--p-ink)' }}>
                        {selectedRole.title}
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--p-muted)', marginTop: 2 }}>
                        {selectedRole.company} · {selectedRole.location} · {selectedRole.mode} ·{' '}
                        {selectedRole.type}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-open">Masih dibuka</span>
                </div>

                <div className="tk-app-match-grid">
                  <div className="tk-app-match-box tk-app-match-box--open">
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: 'var(--status-open)',
                        marginBottom: 6,
                      }}
                    >
                      Cocok dengan profilmu
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: '0.84rem',
                        color: 'var(--p-ink)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {selectedRole.matched.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="tk-app-match-box tk-app-match-box--missing">
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: 'var(--status-warning)',
                        marginBottom: 6,
                      }}
                    >
                      Perlu dilengkapi di profil
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 16,
                        fontSize: '0.84rem',
                        color: 'var(--p-ink)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      {selectedRole.missing.map((ms) => (
                        <li key={ms}>{ms}</li>
                      ))}
                    </ul>
                  </div>
                </div>

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
                    {selectedRole.source} · {selectedRole.fetched}
                  </span>
                  <Link
                    href="/jobs"
                    style={{
                      color: 'var(--p-action)',
                      fontWeight: 500,
                      textDecoration: 'none',
                    }}
                  >
                    Buka di halaman Lowongan
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="tk-hero__fade" aria-hidden="true" />
        </div>
        </ScrollReveal>
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
            <div className="tk-companies-grid" aria-label="Contoh perusahaan terkemuka di Indonesia">
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
                  Telkom <span style={{ color: '#E1251B' }}>Indonesia</span>
                </span>
                <span className="tk-company-sector">Telekomunikasi</span>
              </Link>

              <Link href="/jobs" className="tk-company-tile">
                <span className="tk-company-wordmark" style={{ color: '#00AA13', fontSize: '1.45rem' }}>
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
                  <span className="badge badge-accent">Hybrid</span>
                  <span className="badge">Jakarta</span>
                  <span className="badge">Full-time</span>
                  <span className="badge">Fresh Graduate</span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src="/images/avatar-designer.jpg"
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: 7, objectFit: 'cover' }}
                    />
                    <strong style={{ color: 'var(--p-ink)', fontWeight: 500 }}>
                      Product Designer · Bandung
                    </strong>
                  </div>
                  <span>Masih dibuka</span>
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
                  }}
                >
                  <img
                    src="/images/avatar-finance.jpg"
                    alt=""
                    style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }}
                  />
                  <div style={{ fontWeight: 500, color: 'var(--p-ink)' }}>
                    Pemetaan profil terhadap syarat posisi
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
                    <span>Keahlian SQL &amp; Pelaporan</span>
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
                    <span>Sertifikasi Brevet Pajak</span>
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
              <img
                src="/images/cv-3d-workspace.jpg"
                alt="Ilustrasi 3D dokumen CV, tas kerja, pena biru, dan kaca pembesar di meja kerja"
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
                    Portal Karier Resmi
                  </strong>
                  <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--p-muted)' }}>
                    Diambil 19 Nov 2026
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
