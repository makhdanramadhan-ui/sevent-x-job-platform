import Link from 'next/link';
import { SITE_NAME } from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import {
  LandingBentoCard1Panel,
  LandingBentoCard2Panel,
  LandingBentoCard4Panel,
  LandingHeroStats,
  LandingPreviewProvider,
  LandingPreviewStage,
  LandingWorkflowSteps,
} from '@/components/ui/home-landing-client';
import { HomeHeroAuthCta } from '@/components/ui/home-hero-auth-cta';
import { HomeHeroVisual } from '@/components/ui/home-hero-visual';
import { ScrollReveal, ScrollWordHighlight } from '@/components/ui/scroll-motion';

export default function HomePage() {
  return (
    <LandingPreviewProvider>
      <div>
        {/* div role="region", bukan <section>: tetap jadi landmark untuk pembaca layar,
            tapi menghindari peringatan Chrome soal <h1> di dalam <section>. */}
        <div role="region" className="tk-hero" aria-labelledby="hero-heading">
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
                  <ButtonText>Cari Lowongan</ButtonText>
                </Link>
                <HomeHeroAuthCta />
              </div>

              <LandingHeroStats />
            </div>

            <div className="tk-hero__visual">
              <HomeHeroVisual />
            </div>
          </div>

          <LandingPreviewStage />
        </div>

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
                  <ButtonText>Lihat semua lowongan</ButtonText>
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
                <LandingBentoCard1Panel />
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
                <LandingBentoCard2Panel />
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
                <div className="tk-feature-panel tk-feature-panel--vector">
                  <span className="tk-feature-chip tk-feature-chip--left" aria-hidden="true">
                    Impor PDF / DOCX
                  </span>
                  <span className="tk-feature-chip tk-feature-chip--right" aria-hidden="true">
                    ATS A4 PDF
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/home-cv-vector.svg"
                    alt="Ilustrasi vektor kandidat menyusun dan memperbarui dokumen CV di RakitKarier"
                    width={732}
                    height={576}
                    loading="lazy"
                    decoding="async"
                    className="tk-feature-vector-img"
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
                <LandingBentoCard4Panel />
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

          <LandingWorkflowSteps />
        </section>
      </div>
    </LandingPreviewProvider>
  );
}
