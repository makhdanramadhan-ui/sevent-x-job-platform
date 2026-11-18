import Link from 'next/link';
import { Badge } from '@/components/ui';

const ROUTES = [
  { method: 'POST', path: '/api/auth/signup', note: 'Pendaftaran akun Supabase Auth' },
  { method: 'POST', path: '/api/auth/login', note: 'Login sesi cookie atau Bearer' },
  { method: 'POST', path: '/api/auth/logout', note: 'Mengakhiri sesi aktif' },
  { method: 'GET', path: '/api/auth/me', note: 'Identitas sesi terverifikasi & status profil' },
  { method: 'GET, PUT, DELETE', path: '/api/profile', note: 'Profil kandidat & preferensi kerja' },
  { method: 'GET', path: '/api/jobs', note: 'Daftar lowongan dengan filter dan paginasi' },
  { method: 'GET', path: '/api/jobs/[id]', note: 'Detail lowongan beserta daftar sumber asli (job_sources)' },
  { method: 'GET, POST', path: '/api/bookmarks', note: 'Lowongan tersimpan milik pengguna' },
  { method: 'DELETE', path: '/api/bookmarks/[jobId]', note: 'Menghapus lowongan tersimpan' },
  { method: 'GET, POST', path: '/api/cv', note: 'Dokumen CV terstruktur milik pengguna' },
  { method: 'GET, PUT, DELETE', path: '/api/cv/[id]', note: 'Satu dokumen CV milik pengguna' },
  {
    method: 'GET (Kontrak)',
    path: '/api/recommendations',
    note: 'Rekomendasi berbasis profil (RecommendationOutput v1: matched, missing, unknown)',
  },
] as const;

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Autentikasi & Profil Terstruktur',
    desc: 'Pengguna wajib masuk terlebih dahulu. Isi keahlian, pendidikan, pengalaman, proyek, dan preferensi kerja melalui halaman Onboarding atau Profil.',
    href: '/onboarding',
    cta: 'Mulai Isi Profil',
  },
  {
    step: '02',
    title: 'Eksplorasi Feed Lowongan Lintas Bidang',
    desc: 'Telusuri lowongan hasil agregasi dari berbagai sumber berizin di Indonesia. Saring menurut lokasi, mode kerja, jenis kontrak, dan tingkat pengalaman.',
    href: '/jobs',
    cta: 'Buka Feed Lowongan',
  },
  {
    step: '03',
    title: 'Pemetaan Kecocokan & Kekurangan',
    desc: 'Lihat alasan kecocokan (matched), persyaratan yang belum terpenuhi (missing), serta atribut yang belum diketahui pada lowongan terhadap profil Anda.',
    href: '/recommendations',
    cta: 'Lihat Rekomendasi',
  },
  {
    step: '04',
    title: 'Persiapan CV & Lamaran di Sumber Asli',
    desc: 'Susun atau impor CV Anda, simpan lowongan incaran, lalu buka tautan sumber asli untuk mengirim lamaran secara mandiri tanpa auto-submit.',
    href: '/bookmarks',
    cta: 'Lowongan Tersimpan',
  },
] as const;

export default function HomePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Hero Ledger Section */}
      <section className="ledger-card" style={{ padding: '36px 28px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <Badge variant="accent">SEVENT X · SDG 8</Badge>
          <Badge variant="neutral">Agregasi Lowongan Indonesia</Badge>
          <Badge variant="open">Akses Terautentikasi</Badge>
        </div>

        <h1
          className="font-editorial"
          style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 800,
            maxWidth: '24ch',
            marginBottom: 14,
          }}
        >
          Temukan Lowongan Relevan, Pahami Kecocokan Profil, dan Lamar di Sumber Asli.
        </h1>

        <p
          style={{
            fontSize: '1.04rem',
            color: 'var(--ink-secondary)',
            maxWidth: '72ch',
            margin: '0 0 24px',
          }}
        >
          <strong>SEVENT X</strong> adalah platform agregasi lowongan kerja Indonesia untuk semua
          bidang dan tingkat pengalaman. Kami menghubungkan profil kandidat dengan data lowongan
          secara transparan—menampilkan alasan rekomendasi, syarat yang belum terpenuhi, waktu
          pengambilan data, dan tautan langsung ke penyelenggara rekrutmen asli.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <Link href="/jobs" className="btn btn-primary btn-lg">
            Jelajahi Feed Lowongan
          </Link>
          <Link href="/recommendations" className="btn btn-secondary btn-lg">
            Cek Rekomendasi Profil
          </Link>
          <Link href="/login" className="btn btn-outline btn-lg">
            Masuk / Daftar Akun
          </Link>
        </div>
      </section>

      {/* 4-Step Honest Workflow */}
      <section aria-labelledby="heading-workflow">
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <span className="page-kicker">ALUR PENGGUNAAN PLATFORM</span>
            <h2 id="heading-workflow" className="page-title" style={{ fontSize: '1.65rem' }}>
              Empat Tahap Pencarian Kerja yang Terukur
            </h2>
          </div>
          <p className="page-subtitle" style={{ fontSize: '0.9rem' }}>
            Seluruh halaman lowongan, rekomendasi, profil, dan CV memerlukan sesi login aktif.
          </p>
        </div>

        <div className="form-grid-2">
          {WORKFLOW_STEPS.map((item) => (
            <article key={item.step} className="surface-card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      background: 'var(--ink-primary)',
                      color: 'var(--ink-inverse)',
                      borderRadius: 3,
                    }}
                  >
                    TAHAP {item.step}
                  </span>
                </div>
                <h3 className="font-editorial" style={{ fontSize: '1.22rem', marginBottom: 8 }}>
                  {item.title}
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
                  {item.desc}
                </p>
              </div>
              <div>
                <Link href={item.href} className="btn btn-outline btn-sm">
                  {item.cta} →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Transparency & Guardrails Section */}
      <section className="ledger-card" aria-labelledby="heading-boundaries">
        <span className="page-kicker">PRINSIP TRANSPARANSI &amp; BATAS TAMPILAN</span>
        <h2 id="heading-boundaries" className="font-editorial" style={{ fontSize: '1.5rem', marginBottom: 14 }}>
          Komitmen Kejujuran Informasi untuk Pencari Kerja
        </h2>
        <div className="form-grid-2">
          <div className="surface-card">
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>
              1. Sumber Asli &amp; Kesegaran Data
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Setiap lowongan mencantumkan sumber asli, status pembukaan lowongan, serta waktu
              pengambilan data (<code>fetched_at</code>). Keberadaan lowongan di dalam feed bukan
              klaim bahwa lowongan tersebut telah diverifikasi aman oleh SEVENT X.
            </p>
          </div>

          <div className="surface-card">
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>
              2. Tanpa Auto-Submit Lamaran
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Tombol melamar mengarahkan Anda langsung ke URL sumber asli. SEVENT X tidak mengirim
              lamaran otomatis dan tidak mengubah status lowongan menjadi &ldquo;terkirim&rdquo;.
            </p>
          </div>

          <div className="surface-card">
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>
              3. Arti Skor Kecocokan Rekomendasi
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Rekomendasi membandingkan atribut profil Anda dengan syarat lowongan untuk menampilkan
              alasan cocok, kekurangan, dan data yang tidak diketahui. Skor kecocokan bukan peluang
              diterima bekerja.
            </p>
          </div>

          <div className="surface-card">
            <h3 style={{ fontSize: '1rem', marginBottom: 6 }}>
              4. Persiapan CV yang Realistis
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Fitur pembuatan CV baru dan impor CV lama membantu merapikan struktur pengalaman Anda,
              tanpa klaim bahwa seluruh HR menggunakan satu format tunggal atau pasti lolos ATS.
            </p>
          </div>
        </div>
      </section>

      {/* Preserved Backend API Route Documentation (Shared with Anggota 2) */}
      <section aria-labelledby="heading-api-contract">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <span className="page-kicker">DOKUMENTASI TEKNIS · KONTRAK BACKEND</span>
            <h2 id="heading-api-contract" className="font-editorial" style={{ fontSize: '1.45rem', margin: 0 }}>
              SEVENT X — Indeks Permukaan Endpoint API
            </h2>
          </div>
          <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            Format Respons: &#123; &quot;data&quot;: ... &#125; | &#123; &quot;error&quot;: &#123; &quot;code&quot;, &quot;message&quot; &#125; &#125;
          </span>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th style={{ width: '180px' }}>Metode HTTP</th>
                <th style={{ width: '240px' }}>Path Endpoint</th>
                <th>Keterangan &amp; Kontrak Akses</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((route) => (
                <tr key={route.path}>
                  <td className="font-mono" style={{ fontWeight: 600 }}>
                    {route.method}
                  </td>
                  <td className="font-mono" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                    {route.path}
                  </td>
                  <td style={{ color: 'var(--ink-secondary)' }}>{route.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
