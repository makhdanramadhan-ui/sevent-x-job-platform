import Link from 'next/link';
import { Badge, HeroCareerIllustration, PillarIllustration, SITE_NAME } from '@/components/ui';

const PROBLEM_SOLUTIONS = [
  {
    problemTitle: 'Lowongan Tersebar & Tidak Jelas Kesegarannya',
    problemDesc:
      'Pencari kerja harus membuka banyak situs satu per satu tanpa mengetahui kapan informasi lowongan tersebut terakhir kali diperbarui.',
    solutionTitle: 'Agregasi Terpusat Beserta Waktu Pengambilan Data',
    solutionDesc: `${SITE_NAME} menghimpun lowongan dari sumber berizin di Indonesia lengkap dengan status pembukaan, waktu pengambilan data (fetched_at), dan tautan langsung ke pengumuman aslinya.`,
  },
  {
    problemTitle: 'Ragu Apakah Kualifikasi Sudah Memenuhi Syarat',
    problemDesc:
      'Banyak kandidat batal melamar atau melamar tanpa persiapan karena sulit memetakan keahlian mana yang sudah sesuai dan mana yang masih kurang.',
    solutionTitle: 'Pemetaan Alasan Cocok & Kekurangan Secara Jujur',
    solutionDesc:
      'Sistem membandingkan profil Anda dengan atribut lowongan untuk merinci kualifikasi yang cocok (matched), syarat yang belum ada di profil (missing), dan data yang belum diketahui.',
  },
  {
    problemTitle: 'Kesulitan Menyusun atau Merapikan CV Lama',
    problemDesc:
      'Menulis ulang riwayat pendidikan, pengalaman, organisasi, dan proyek dari awal sering memakan waktu ketika tenggat lowongan sudah dekat.',
    solutionTitle: 'Studio Pembuatan CV Baru & Impor CV Lama',
    solutionDesc:
      'Susun dokumen CV terstruktur dari nol atau impor CV lama Anda untuk ditinjau, disunting kembali oleh Anda sendiri, lalu disiapkan untuk melamar.',
  },
  {
    problemTitle: 'Ketidakpastian Lamaran Melalui Pihak Ketiga',
    problemDesc:
      'Fitur kirim lamaran otomatis (auto-submit) sering membuat kandidat kehilangan kendali atas dokumen dan proses pendaftaran di perusahaan tujuan.',
    solutionTitle: 'Kendali Penuh: Lamar Mandiri di Sumber Asli',
    solutionDesc: `${SITE_NAME} tidak melakukan auto-submit. Setelah menyiapkan profil dan CV, Anda diarahkan langsung ke portal rekrutmen resmi penyelenggara untuk mengirim lamaran.`,
  },
] as const;

const FEATURE_PILLARS = [
  {
    number: 'PILAR 01',
    tag: 'AGREGASI & PENCARIAN',
    variant: 'feed' as const,
    title: 'Bursa Lowongan Lintas Bidang & Pengalaman',
    description:
      'Temukan peluang kerja dari berbagai industri di Indonesia—mulai dari tingkat magang (internship), fresh graduate, hingga profesional berpengalaman.',
    highlights: [
      'Filter berdasarkan lokasi kota/provinsi, mode kerja (Onsite, Hybrid, Remote), dan jenis kontrak',
      'Informasi transparan: status lowongan, syarat pendidikan, daftar keahlian, dan tenggat waktu',
      'Fitur Bookmark untuk menyimpan dan membandingkan lowongan incaran sebelum melamar',
    ],
    primaryHref: '/jobs',
    primaryLabel: 'Jelajahi Feed Lowongan →',
    secondaryHref: '/bookmarks',
    secondaryLabel: 'Lowongan Tersimpan',
  },
  {
    number: 'PILAR 02',
    tag: 'REKOMENDASI TERUKUR',
    variant: 'match' as const,
    title: 'Pemetaan Kecocokan Profil Kandidat',
    description:
      'Bukan sekadar angka skor tanpa penjelasan. Lihat secara terbuka mengapa sebuah lowongan direkomendasikan untuk profil Anda.',
    highlights: [
      'Menampilkan alasan kecocokan (matched) antara keahlian & preferensi Anda dengan lowongan',
      'Menyoroti persyaratan lowongan yang belum tercantum di profil Anda (missing)',
      'Memberi tahu atribut yang tidak dicantumkan sumber lowongan (unknown) secara jujur',
    ],
    primaryHref: '/recommendations',
    primaryLabel: 'Analisis Kecocokan Profil →',
    secondaryHref: '/profile',
    secondaryLabel: 'Atur Profil & Preferensi',
  },
  {
    number: 'PILAR 03',
    tag: 'DOKUMEN KARIER',
    variant: 'cv' as const,
    title: 'Studio CV Baru & Impor CV Lama',
    description:
      'Siapkan dokumen CV yang rapi, terstruktur, dan mudah dibaca dari pengalaman nyata, proyek, serta pencapaian Anda.',
    highlights: [
      'Buat CV dari awal menggunakan struktur riwayat pendidikan, pengalaman, dan keahlian',
      'Impor CV lama untuk diekstraksi, diperiksa ulang, dan diedit sebelum digunakan',
      'Pratinjau langsung dan ekspor ke format PDF siap pakai untuk melamar di sumber asli',
    ],
    primaryHref: '/cv',
    primaryLabel: 'Buka Studio CV →',
    secondaryHref: '/onboarding',
    secondaryLabel: 'Isi Data Onboarding',
  },
] as const;

const USER_JOURNEY = [
  {
    step: '01',
    title: 'Masuk & Isi Profil Awal',
    desc: 'Buat akun lalu lengkapi keahlian, riwayat pendidikan, pengalaman kerja, dan preferensi posisi maupun lokasi kerja.',
    href: '/onboarding',
    linkText: 'Mulai Onboarding',
  },
  {
    step: '02',
    title: 'Eksplorasi & Simpan Lowongan',
    desc: 'Cari lowongan yang sesuai di Feed Lowongan menggunakan filter mode kerja dan tingkat pengalaman, lalu simpan ke Bookmark.',
    href: '/jobs',
    linkText: 'Buka Feed Lowongan',
  },
  {
    step: '03',
    title: 'Cek Kecocokan & Siapkan CV',
    desc: 'Tinjau alasan kecocokan serta persyaratan yang belum terpenuhi di halaman Rekomendasi, lalu perbarui CV Anda di Studio CV.',
    href: '/recommendations',
    linkText: 'Lihat Rekomendasi',
  },
  {
    step: '04',
    title: 'Lamar di Sumber Asli',
    desc: 'Buka detail lowongan untuk memeriksa sumber asli dan waktu pengambilan data, kemudian kirim lamaran langsung di situs resmi.',
    href: '/bookmarks',
    linkText: 'Tinjau Simpanan',
  },
] as const;

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
      {/* 1. HERO SECTION: Split Narrative + Product Anatomy Visual */}
      <section className="hero-split" aria-labelledby="hero-main-heading">
        <div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <Badge variant="accent">{SITE_NAME.toUpperCase()} · INDONESIA</Badge>
            <Badge variant="neutral">Agregasi Lowongan &amp; Pemetaan Profil</Badge>
            <Badge variant="open">Lamar Langsung di Sumber Asli</Badge>
          </div>

          <h1 id="hero-main-heading" className="hero-headline">
            Temukan Lowongan Kerja, Pahami Kesiapan Profil Anda, dan Lamar Langsung di Sumber
            Resmi.
          </h1>

          <p className="hero-lead">
            <strong>{SITE_NAME}</strong> membantu pencari kerja di Indonesia dari semua bidang dan
            tingkat pengalaman untuk menelusuri lowongan teragregasi, melihat alasan kecocokan
            serta kekurangan profil secara jujur, menyiapkan CV terstruktur, lalu melamar mandiri
            di sumber asli.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Daftar &amp; Mulai Sekarang →
            </Link>
            <Link href="/jobs" className="btn btn-secondary btn-lg">
              Jelajahi Lowongan
            </Link>
          </div>

          <div className="hero-pillars-mini">
            <div className="hero-mini-card" style={{ borderTopColor: 'var(--accent-primary)' }}>
              <strong
                className="font-mono"
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--accent-primary)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                01 · LINTAS BIDANG
              </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', display: 'block', lineHeight: 1.45 }}>
                Terbuka untuk seluruh disiplin ilmu, dari magang hingga level senior.
              </span>
            </div>

            <div className="hero-mini-card" style={{ borderTopColor: 'var(--status-open)' }}>
              <strong
                className="font-mono"
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--status-open)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                02 · PEMETAAN JUJUR
              </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', display: 'block', lineHeight: 1.45 }}>
                Merinci syarat yang sudah cocok, yang masih kurang, dan waktu ambil data.
              </span>
            </div>

            <div className="hero-mini-card" style={{ borderTopColor: 'var(--ink-primary)' }}>
              <strong
                className="font-mono"
                style={{
                  fontSize: '0.73rem',
                  color: 'var(--ink-primary)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                03 · SUMBER RESMI
              </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', display: 'block', lineHeight: 1.45 }}>
                Pelamaran dilakukan langsung oleh Anda di laman resmi penyelenggara.
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Anatomy of How KerjaLoka Works */}
        <aside className="hero-anatomy-card" aria-label="Ilustrasi cara kerja pemetaan KerjaLoka">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span className="page-kicker" style={{ margin: 0 }}>
              ALUR KERJA TERINTEGRASI
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 3,
              }}
            >
              Profil → Kecocokan → Sumber Resmi
            </span>
          </div>

          <HeroCareerIllustration />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
              }}
            >
              <strong style={{ fontSize: '0.76rem', display: 'block', color: 'var(--ink-primary)' }}>
                1. Profil &amp; CV
              </strong>
              <span style={{ fontSize: '0.73rem', color: 'var(--ink-secondary)' }}>
                Isi keahlian, pengalaman, &amp; preferensi kerja.
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
              }}
            >
              <strong style={{ fontSize: '0.76rem', display: 'block', color: 'var(--accent-primary)' }}>
                2. Cek Kecocokan
              </strong>
              <span style={{ fontSize: '0.73rem', color: 'var(--ink-secondary)' }}>
                Tinjau syarat yang cocok &amp; yang belum terpenuhi.
              </span>
            </div>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
              }}
            >
              <strong style={{ fontSize: '0.76rem', display: 'block', color: 'var(--status-open)' }}>
                3. Sumber Asli
              </strong>
              <span style={{ fontSize: '0.73rem', color: 'var(--ink-secondary)' }}>
                Lamar mandiri langsung di situs penyelenggara.
              </span>
            </div>
          </div>
        </aside>
      </section>

      {/* 2. THREE CORE PILLARS (What You Can Do on This Website) */}
      <section aria-labelledby="heading-pillars">
        <div className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="page-kicker">FITUR UTAMA PLATFORM</span>
            <h2 id="heading-pillars" className="page-title" style={{ fontSize: '1.75rem' }}>
              Apa Saja yang Bisa Anda Lakukan di {SITE_NAME}?
            </h2>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.92rem' }}>
            Dirancang untuk menghubungkan pencarian lowongan, evaluasi kesiapan profil, dan
            penyusunan CV dalam satu alur kerja yang utuh.
          </p>
        </div>

        <div className="feature-trio-grid">
          {FEATURE_PILLARS.map((pillar) => (
            <article key={pillar.number} className="feature-pillar-card">
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      background: 'var(--ink-primary)',
                      color: 'var(--ink-inverse)',
                      borderRadius: 3,
                    }}
                  >
                    {pillar.number}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'var(--accent-primary)',
                    }}
                  >
                    {pillar.tag}
                  </span>
                </div>

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
                    fontSize: '0.84rem',
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

      {/* 3. WHY KERJALOKA: Problem vs Solution Ledger */}
      <section aria-labelledby="heading-why">
        <div className="page-header" style={{ marginBottom: 22 }}>
          <div>
            <span className="page-kicker">LATAR BELAKANG &amp; SOLUSI</span>
            <h2 id="heading-why" className="page-title" style={{ fontSize: '1.75rem' }}>
              Mengapa {SITE_NAME} Dibangun?
            </h2>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.92rem' }}>
            Menjawab empat kendala nyata yang sering dihadapi pencari kerja ketika menyaring
            lowongan dan menyiapkan dokumen lamaran.
          </p>
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
                  className="font-mono"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--status-warning)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  KENDALA UMUM #{idx + 1}
                </span>
                <h3 style={{ fontSize: '1.02rem', margin: '0 0 4px' }}>{item.problemTitle}</h3>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                  {item.problemDesc}
                </p>
              </div>

              <div style={{ paddingTop: 2 }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: 'var(--status-open)',
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  SOLUSI {SITE_NAME.toUpperCase()}
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
            <span className="page-kicker">PANDUAN PENGGUNA BARU</span>
            <h2 id="heading-journey" className="page-title" style={{ fontSize: '1.75rem' }}>
              Cara Menggunakan {SITE_NAME} dalam 4 Langkah
            </h2>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.92rem' }}>
            Mulai dari pembuatan akun hingga membuka halaman rekrutmen asli.
          </p>
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
                  LANGKAH {item.step}
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

      {/* 5. TRANSPARENCY PRINCIPLES & CLOSING CTA */}
      <section className="ledger-card" aria-labelledby="heading-ethics">
        <span className="page-kicker">PRINSIP KEJUJURAN &amp; BATAS TAMPILAN</span>
        <h2 id="heading-ethics" className="font-editorial" style={{ fontSize: '1.45rem', marginBottom: 14 }}>
          Transparansi yang Kami Pegang untuk Setiap Kandidat
        </h2>
        <div className="form-grid-2">
          <div className="surface-card">
            <h3 style={{ fontSize: '0.96rem', marginBottom: 6 }}>
              Sumber Asli &amp; Status Kesegaran Data
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
              Setiap lowongan menampilkan sumber asli, status pembukaan, serta waktu pengambilan
              data. Pencantuman lowongan dari sumber eksternal bukan klaim bahwa lowongan tersebut
              telah diverifikasi aman oleh {SITE_NAME}.
            </p>
          </div>

          <div className="surface-card">
            <h3 style={{ fontSize: '0.96rem', marginBottom: 6 }}>
              Makna Skor Kecocokan &amp; Persiapan CV
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
              Skor rekomendasi mengukur kesesuaian data profil Anda terhadap syarat lowongan, bukan
              peluang diterima bekerja. Studio CV membantu merapikan struktur pengalaman Anda tanpa
              klaim bahwa semua HR memakai satu template atau pasti lolos ATS.
            </p>
          </div>
        </div>
      </section>

      {/* 6. CLOSING CTA BANNER */}
      <section className="cta-banner-card" aria-labelledby="heading-final-cta">
        <div style={{ maxWidth: '60ch' }}>
          <span
            className="font-mono"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#f5b09c',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'block',
              marginBottom: 6,
            }}
          >
            SIAP MEMULAI PENCARIAN KERJA YANG TERARAH?
          </span>
          <h2
            id="heading-final-cta"
            className="font-editorial"
            style={{ fontSize: '1.65rem', color: 'var(--ink-inverse)', margin: '0 0 8px' }}
          >
            Bangun Profil Kandidat Anda dan Temukan Peluang Kerja di {SITE_NAME}
          </h2>
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'rgba(253, 252, 249, 0.82)' }}>
            Masuk atau buat akun baru untuk mulai menelusuri feed lowongan Indonesia, melihat
            pemetaan kecocokan profil, dan menyiapkan CV Anda.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Buat Akun Gratis →
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
