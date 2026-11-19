'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SITE_NAME } from '@/components/ui';

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
      {/* 1. HERO: centred headline + interactive live-HTML app-frame */}
      <section className="tk-hero" aria-labelledby="hero-heading">
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
              <span>Cari Lowongan</span>
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/signup" className="btn btn-outline btn-lg">
              Daftar Akun
            </Link>
          </div>
        </div>

        {/* Live HTML Application Window inside Calm Lit Frame */}
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
              {/* Interactive Sidebar List */}
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
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: '0.9375rem',
                          color: 'var(--p-ink)',
                          marginBottom: 3,
                        }}
                      >
                        {role.title}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--p-muted)' }}>
                        {role.company} · {role.location}
                      </div>
                      <div
                        style={{
                          marginTop: 8,
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                          fontSize: '0.75rem',
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: active ? 'var(--p-accent-soft)' : 'var(--p-surface)',
                            color: active ? 'var(--p-accent)' : 'var(--p-muted)',
                            fontWeight: 500,
                          }}
                        >
                          {role.mode}
                        </span>
                        <span
                          style={{
                            padding: '2px 7px',
                            borderRadius: 5,
                            background: 'var(--p-surface)',
                            color: 'var(--p-muted)',
                          }}
                        >
                          {role.level}
                        </span>
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
                  <div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--p-ink)' }}>
                      {selectedRole.title}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--p-muted)', marginTop: 2 }}>
                      {selectedRole.company} · {selectedRole.location} · {selectedRole.mode} ·{' '}
                      {selectedRole.type}
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
                    Buka di halaman Lowongan →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="tk-hero__fade" aria-hidden="true" />
        </div>
      </section>

      {/* 2. FEATURE BENTO (2x2 clean white cards with lit soft panels & real HTML UI fragments) */}
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
                    justifyContent: 'space-between',
                    color: 'var(--p-muted)',
                    fontSize: '0.8rem',
                  }}
                >
                  <strong style={{ color: 'var(--p-ink)', fontWeight: 500 }}>
                    Data Analyst · Bandung
                  </strong>
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
                <div style={{ fontWeight: 500, marginBottom: 10, color: 'var(--p-ink)' }}>
                  Pemetaan profil terhadap syarat posisi
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--status-open-bg)',
                      color: 'var(--status-open)',
                    }}
                  >
                    <span>Keahlian SQL &amp; Visualisasi Data</span>
                    <strong>Cocok</strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--status-warning-bg)',
                      color: 'var(--status-warning)',
                    }}
                  >
                    <span>Pengalaman Python untuk analisis</span>
                    <strong>Belum ada</strong>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: 'var(--p-surface)',
                      color: 'var(--p-muted)',
                    }}
                  >
                    <span>Rentang gaji lowongan</span>
                    <span>Tidak dicantumkan</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

          {/* Card 3: Studio CV */}
          <article className="tk-feature-card">
            <div>
              <h3 className="tk-feature-card__title">Buat CV baru atau impor CV lama</h3>
              <p className="tk-feature-card__desc">
                Susun riwayat pendidikan, pengalaman kerja, proyek, dan pencapaian ke format yang
                rapi, lalu unduh dalam bentuk PDF siap kirim.
              </p>
            </div>
            <div className="tk-feature-panel tk-feature-panel--sand" aria-hidden="true">
              <div className="tk-ui-frag">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--p-ink)' }}>CV — Nadia Pratama</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--p-muted)' }}>
                      Terakhir diperbarui hari ini
                    </div>
                  </div>
                  <span className="badge badge-accent">Ekspor PDF</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--p-muted)' }}>
                  <div style={{ color: 'var(--p-ink)', fontWeight: 500 }}>Pengalaman Kerja</div>
                  <div>UI/UX Designer Intern · 2025 – 2026</div>
                  <div style={{ color: 'var(--p-ink)', fontWeight: 500, marginTop: 4 }}>
                    Keahlian Utama
                  </div>
                  <div>Figma, Riset Pengguna, HTML/CSS, Desain Responsif</div>
                </div>
              </div>
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
                  Buka &amp; Lamar di Sumber Asli ↗
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* 3. CALM STEPS SECTION (Hairline rows on pure white ground) */}
      <section className="tk-section" aria-labelledby="heading-steps">
        <div className="tk-section__head">
          <h2 id="heading-steps" className="tk-section__h2">
            Alur melamar kerja di {SITE_NAME}.
          </h2>
          <p className="tk-section__intro">
            Empat langkah sederhana dari pembuatan profil hingga membuka halaman pendaftaran resmi.
          </p>
        </div>

        <div className="tk-steps-list">
          {WORKFLOW_STEPS.map((step) => (
            <div key={step.num} className="tk-step-row">
              <span className="tk-step-num">{step.num}</span>
              <h3 className="tk-step-title">{step.title}</h3>
              <p className="tk-step-desc">{step.desc}</p>
              <Link href={step.href} className="tk-step-link">
                {step.label} →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
