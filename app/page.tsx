import Link from 'next/link';
import { HeroCareerIllustration, PillarIllustration, SITE_NAME } from '@/components/ui';

const PROBLEM_SOLUTIONS = [
  {
    problemTitle: 'Lowongan Tersebar di Banyak Portal',
    problemDesc:
      'Harus membuka banyak situs satu per satu untuk mencari info lowongan yang masih aktif dan relevan dengan bidangmu.',
    solutionTitle: 'Satu Portal dengan Tautan ke Sumber Resmi',
    solutionDesc: `${SITE_NAME} merangkum lowongan dari berbagai sumber terpercaya di Indonesia, lengkap dengan status pembukaan lowongan, waktu pembaruan terakhir, dan akses langsung ke pengumuman aslinya.`,
  },
  {
    problemTitle: 'Ragu Apakah Kualifikasimu Sudah Cukup',
    problemDesc:
      'Banyak pelamar ragu mengirim lamaran karena sulit menilai keahlian mana yang sudah cocok dan persyaratan mana yang masih belum terpenuhi.',
    solutionTitle: 'Rincian Kecocokan & Syarat yang Perlu Dilengkapi',
    solutionDesc:
      'Lihat perbandingan profilmu dengan syarat lowongan secara terbuka—mulai dari kualifikasi yang sudah cocok hingga keahlian yang sebaiknya kamu tambahkan.',
  },
  {
    problemTitle: 'Repot Menulis Ulang atau Merapikan CV',
    problemDesc:
      'Menyusun CV dari nol atau memperbarui CV lama sering memakan waktu ketika batas pendaftaran lowongan sudah dekat.',
    solutionTitle: 'Studio CV Baru & Impor CV Lama',
    solutionDesc:
      'Buat CV baru yang rapi dan terstruktur dari pengalamanmu, atau unggah CV lama untuk ditinjau, diedit kembali, lalu diunduh dalam format PDF siap lamar.',
  },
  {
    problemTitle: 'Khawatir Lamaran Tidak Sampai ke Perusahaan',
    problemDesc:
      'Mengirim lamaran lewat perantara otomatis sering membuat pelamar tidak tahu apakah dokumennya benar-benar masuk ke sistem perusahaan tujuan.',
    solutionTitle: 'Lamar Langsung di Situs Resmi Perusahaan',
    solutionDesc: `Setelah profil dan CV kamu siap di ${SITE_NAME}, kamu diarahkan langsung ke portal rekrutmen resmi perusahaan agar proses pendaftaranmu tetap di bawah kendalimu.`,
  },
] as const;

const FEATURE_PILLARS = [
  {
    variant: 'feed' as const,
    title: 'Lowongan untuk Semua Bidang & Jenjang Karier',
    description:
      'Temukan peluang kerja di berbagai industri di Indonesia—mulai dari magang, fresh graduate, hingga profesional berpengalaman.',
    highlights: [
      'Saring lowongan menurut kota/provinsi, sistem kerja (Onsite, Hybrid, Remote), dan jenis kontrak',
      'Lihat syarat pendidikan, daftar keahlian yang dibutuhkan, serta batas akhir pendaftaran',
      'Simpan lowongan incaran ke menu Tersimpan untuk dibandingkan sebelum kamu melamar',
    ],
    primaryHref: '/jobs',
    primaryLabel: 'Cari Lowongan →',
    secondaryHref: '/bookmarks',
    secondaryLabel: 'Lowongan Tersimpan',
  },
  {
    variant: 'match' as const,
    title: 'Cek Kecocokan Profil dengan Syarat Lowongan',
    description:
      'Ketahui dengan jelas mengapa sebuah lowongan cocok untukmu dan apa saja yang masih perlu kamu persiapkan.',
    highlights: [
      'Menampilkan daftar keahlian dan pengalamanmu yang sudah sesuai dengan syarat lowongan',
      'Memberi tahu kualifikasi lowongan yang belum tercantum di profilmu',
      'Menandai informasi yang belum dicantumkan oleh penyelenggara lowongan secara transparan',
    ],
    primaryHref: '/recommendations',
    primaryLabel: 'Lihat Rekomendasi →',
    secondaryHref: '/profile',
    secondaryLabel: 'Lengkapi Profil',
  },
  {
    variant: 'cv' as const,
    title: 'Buat CV Baru atau Perbarui CV Lama',
    description:
      'Susun CV yang rapi, terstruktur, dan mudah dibaca dari pengalaman kerja, proyek, organisasi, serta pencapaianmu.',
    highlights: [
      'Buat CV dari awal menggunakan panduan pengisian pendidikan, pengalaman, dan keahlian',
      'Impor CV lama milikmu untuk ditinjau ulang dan diperbarui isinya dengan cepat',
      'Lihat pratinjau dokumen dan unduh dalam format PDF untuk dilampirkan saat melamar',
    ],
    primaryHref: '/cv',
    primaryLabel: 'Buka Studio CV →',
    secondaryHref: '/onboarding',
    secondaryLabel: 'Isi Profil Awal',
  },
] as const;

const USER_JOURNEY = [
  {
    step: 'Langkah 1',
    title: 'Lengkapi Profil & Keahlian',
    desc: 'Buat akun lalu isi keahlian, riwayat pendidikan, pengalaman, serta posisi dan lokasi kerja yang kamu inginkan.',
    href: '/onboarding',
    linkText: 'Isi Profil',
  },
  {
    step: 'Langkah 2',
    title: 'Pilih Lowongan Impian',
    desc: 'Temukan lowongan yang sesuai dengan bidang dan sistem kerja pilihanmu, lalu simpan lowongan yang menarik perhatianmu.',
    href: '/jobs',
    linkText: 'Cari Lowongan',
  },
  {
    step: 'Langkah 3',
    title: 'Cek Kecocokan & Siapkan CV',
    desc: 'Pelajari kualifikasi yang sudah cocok dan yang masih perlu dilengkapi, lalu siapkan dokumen CV terbaikmu.',
    href: '/recommendations',
    linkText: 'Cek Rekomendasi',
  },
  {
    step: 'Langkah 4',
    title: 'Lamar di Situs Resmi',
    desc: 'Buka halaman detail lowongan dan klik tautan menuju portal rekrutmen resmi perusahaan untuk mengirim lamaranmu.',
    href: '/bookmarks',
    linkText: 'Lihat Simpanan',
  },
] as const;

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      {/* 1. HERO SECTION (Tanpa badge pill di atas judul) */}
      <section className="hero-split" aria-labelledby="hero-main-heading">
        <div>
          <h1 id="hero-main-heading" className="hero-headline">
            Cari Lowongan yang Tepat, Kenali Kesiapan Dirimu, dan Lamar di Perusahaan Impian.
          </h1>

          <p className="hero-lead">
            <strong>{SITE_NAME}</strong> memudahkan kamu menemukan peluang kerja di seluruh
            Indonesia, mengecek kualifikasi mana yang sudah cocok dengan profilmu, serta merapikan
            CV sebelum melamar langsung di situs resmi perusahaan.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/jobs" className="btn btn-primary btn-lg">
              Mulai Cari Lowongan →
            </Link>
            <Link href="/signup" className="btn btn-outline btn-lg">
              Buat Akun Gratis
            </Link>
          </div>
        </div>

        <div>
          <HeroCareerIllustration />
        </div>
      </section>

      {/* 2. THREE CORE FEATURES */}
      <section aria-labelledby="heading-pillars">
        <div className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <h2 id="heading-pillars" className="page-title" style={{ fontSize: '1.75rem' }}>
              Semua Persiapan Melamar Kerja dalam Satu Tempat
            </h2>
            <p className="page-subtitle" style={{ fontSize: '0.94rem' }}>
              Mulai dari mencari lowongan, mengecek kesiapan kualifikasi, hingga merapikan CV.
            </p>
          </div>
        </div>

        <div className="feature-trio-grid">
          {FEATURE_PILLARS.map((pillar) => (
            <article key={pillar.title} className="feature-pillar-card">
              <div>
                <h3 className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 10 }}>
                  {pillar.title}
                </h3>

                <PillarIllustration variant={pillar.variant} />

                <p style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
                  {pillar.description}
                </p>

                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    fontSize: '0.85rem',
                    color: 'var(--ink-primary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {pillar.highlights.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 14,
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <Link href={pillar.primaryHref} className="btn btn-primary btn-sm">
                  {pillar.primaryLabel}
                </Link>
                <Link href={pillar.secondaryHref} className="btn btn-outline btn-sm">
                  {pillar.secondaryLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 3. WHY RAKITKARIER */}
      <section aria-labelledby="heading-why">
        <div className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <h2 id="heading-why" className="page-title" style={{ fontSize: '1.75rem' }}>
              Mengapa Mencari Kerja Lewat {SITE_NAME}?
            </h2>
            <p className="page-subtitle" style={{ fontSize: '0.94rem' }}>
              Dirancang untuk membantu kamu melamar kerja dengan persiapan yang lebih matang dan
              terarah.
            </p>
          </div>
        </div>

        <div className="comparison-grid">
          {PROBLEM_SOLUTIONS.map((item, idx) => (
            <article key={idx} className="comparison-card">
              <div
                style={{
                  paddingBottom: 12,
                  borderBottom: '1px dashed var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--status-warning)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Tantangan Pelamar
                </span>
                <h3 style={{ fontSize: '1.02rem', margin: '0 0 4px' }}>{item.problemTitle}</h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                  {item.problemDesc}
                </p>
              </div>

              <div style={{ paddingTop: 2 }}>
                <span
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--status-open)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Kemudahan di {SITE_NAME}
                </span>
                <h4 style={{ fontSize: '1rem', margin: '0 0 4px' }}>{item.solutionTitle}</h4>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-primary)' }}>
                  {item.solutionDesc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 4. 4-STEP USER JOURNEY */}
      <section aria-labelledby="heading-journey">
        <div className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <h2 id="heading-journey" className="page-title" style={{ fontSize: '1.75rem' }}>
              4 Langkah Mudah Memulai Pencarian Kerja
            </h2>
            <p className="page-subtitle" style={{ fontSize: '0.94rem' }}>
              Ikuti langkah berikut untuk menemukan lowongan yang paling cocok dengan profilmu.
            </p>
          </div>
        </div>

        <div className="journey-grid">
          {USER_JOURNEY.map((item) => (
            <article key={item.step} className="journey-card">
              <div>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    display: 'block',
                    marginBottom: 6,
                  }}
                >
                  {item.step}
                </span>
                <h3 className="font-editorial" style={{ fontSize: '1.15rem', marginBottom: 8 }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.87rem', color: 'var(--ink-secondary)' }}>
                  {item.desc}
                </p>
              </div>
              <div>
                <Link href={item.href} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                  {item.linkText} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 5. CLOSING CTA BANNER */}
      <section className="cta-banner-card" aria-labelledby="heading-final-cta">
        <div style={{ maxWidth: '60ch' }}>
          <h2
            id="heading-final-cta"
            className="font-editorial"
            style={{ fontSize: '1.65rem', color: 'var(--ink-inverse)', margin: '0 0 8px' }}
          >
            Siap Menemukan Peluang Karier Berikutnya?
          </h2>
          <p style={{ margin: 0, fontSize: '0.94rem', color: 'rgba(253, 252, 249, 0.85)' }}>
            Buat akun sekarang untuk melihat lowongan kerja terbaru, mengecek kecocokan kualifikasi
            profilmu, dan menyusun CV yang rapi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Daftar Sekarang →
          </Link>
          <Link
            href="/login"
            className="btn btn-outline btn-lg"
            style={{
              background: 'transparent',
              color: 'var(--ink-inverse)',
              borderColor: 'var(--ink-inverse)',
            }}
          >
            Masuk ke Akun
          </Link>
        </div>
      </section>
    </div>
  );
}
