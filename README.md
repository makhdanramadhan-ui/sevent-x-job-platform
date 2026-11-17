# SEVENT X — Backend

Backend platform agregasi lowongan Indonesia untuk kompetisi SEVENT X. Repositori ini berisi API Next.js App Router, migrasi Supabase PostgreSQL/Auth, kontrak data bersama, dan pemeriksaan rilis. Frontend adalah modul terpisah dari repositori backend ini.

Status bukti: lihat bagian **Verifikasi**. Tidak ada klaim data lowongan nyata, scraping LinkedIn, atau rekomendasi yang sudah berjalan.

## Cakupan

- Autentikasi Supabase Auth dengan verifikasi sesi di server melalui `auth.getUser`.
- Profil pengguna, lowongan, provenance sumber lowongan, bookmark, dan dokumen CV terstruktur.
- RLS dan grant SQL untuk isolasi data pribadi serta pembatasan tulis lowongan.
- Kontrak integrasi untuk pipeline ingestion lowongan, mesin rekomendasi, dan editor CV.
- Tidak ada rekomendasi, scraper, parser CV, upload file, Express, VPS, atau model bahasa di repositori ini.

## Stack

| Komponen | Versi |
| --- | --- |
| Node.js | >= 20.9 |
| Next.js | 16.4.6 |
| React | 19.3.1 |
| TypeScript | 5.9.3 |
| @supabase/supabase-js | 2.119.0 |
| @supabase/ssr | 0.12.7 |
| Database/Auth | Supabase PostgreSQL + Supabase Auth |

## Setup

```bash
npm ci
```

Buat `.env.local` hanya jika belum ada, lalu isi kredensial. Jangan menimpa file yang sudah berisi kredensial:

```bash
[ -f .env.local ] || cp .env.example .env.local
```

PowerShell: `if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }`.

```bash
npm run typecheck
npm run build
npm run check
```

Isi `.env.local` dengan kredensial proyek Supabase. `.env.local` diabaikan Git. Jangan pernah menaruh service role key di kode aplikasi, browser, repository, log, atau rekaman demo.

### Variabel lingkungan

| Nama | Dipakai | Wajib |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Klien server Supabase | Ya |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Klien server Supabase | Ya |
| `SUPABASE_SERVICE_ROLE_KEY` | Hanya `scripts/integration-supabase.mjs` dan proses ingestion tepercaya | Tidak |

Aplikasi tidak mengimpor `SUPABASE_SERVICE_ROLE_KEY`. Handler pengguna hanya memakai anon key + sesi pengguna.

### Migrasi

Jalankan berurutan melalui SQL Editor dashboard Supabase:

1. `supabase/migrations/20261117090000_schema.sql`
2. `supabase/migrations/20261117090100_security.sql`
3. `supabase/migrations/20261117090200_ingest_concurrency.sql`

Alternatif CLI:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Migrasi bersifat idempotent untuk pembuatan ulang objek yang sama (tabel, indeks, kebijakan, fungsi, trigger), tetapi tidak menghapus data. Jangan menjalankan migrasi destruktif pada data produksi tanpa persetujuan.

Pemeriksaan SQL/RLS dengan pgTAP (butuh Supabase lokal/Docker):

```bash
npx supabase test db
```

## Autentikasi

Dua mode diterima:

- **Cookie sesi** (default browser): `@supabase/ssr` menyimpan sesi Supabase. Semua mutasi dengan cookie wajib menyertakan `Origin` yang sama dengan origin aplikasi atau `Sec-Fetch-Site: same-origin`; jika tidak, respons `403 csrf_rejected`. Ini mencegah CSRF. Login dan signup juga menolak `Origin`/`Sec-Fetch-Site` lintas origin bila header tersebut dikirim browser.
- **Bearer**: kirim `Authorization: Bearer <access_token>`. Token diverifikasi server-side dengan `supabase.auth.getUser(token)`. Mode ini tidak memakai cookie dan tidak memerlukan pemeriksaan origin. Tidak ada endpoint refresh token; gunakan alur cookie atau Supabase client untuk refresh.

Sesi diverifikasi ke Supabase Auth pada setiap permintaan. Tidak ada kepercayaan pada klaim JWT tanpa verifikasi, tidak ada `service_role` di handler pengguna.

Proyek hosted mengaktifkan konfirmasi email. `POST /api/auth/signup` mengembalikan `requires_email_confirmation: true` dan tidak membuat sesi sampai pengguna mengonfirmasi email; konfirmasi email tidak dimatikan oleh aplikasi.

Respons sukses selalu `{ "data": ... }`. Respons gagal selalu:

```json
{ "error": { "code": "validation_error", "message": "Input email harus berupa email yang valid.", "details": { "field": "email" } } }
```

Tidak ada stack trace, pesan SQL, atau data pribadi di respons dan log.

## Rute API

Semua rute lowongan, profil, bookmark, dan CV memerlukan sesi terautentikasi. Permintaan anonim ditolak `401 unauthorized`.

| Metode | Rute | Body/query | Sukses | Gagal utama |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/signup` | `email`, `password`, `full_name?` | `201 {user, requires_email_confirmation}` | `400 signup_failed`, `400 validation_error`, `429 rate_limited`, `503 auth_not_configured` |
| POST | `/api/auth/login` | `email`, `password` | `200 {user}` + cookie sesi | `401 invalid_credentials`, `429 rate_limited`, `503 auth_not_configured` |
| POST | `/api/auth/logout` | - | `200 {signed_out}` | `401 unauthorized`, `403 csrf_rejected` |
| GET | `/api/auth/me` | - | `200 {user, auth_mode, has_profile}` | `401 unauthorized` |
| GET | `/api/profile` | - | `200 data: profile \| null` | `401` |
| PUT | `/api/profile` | Profil lengkap (pengganti penuh) | `200 profile` | `400 validation_error`, `400 unknown_field`, `403 csrf_rejected` |
| DELETE | `/api/profile` | - | `200 {cleared, auth_account_deleted: false}` | `401`, `403 csrf_rejected` |
| GET | `/api/jobs` | `page`, `limit`, `q`, `location`, `work_mode`, `employment_type`, `level`, `status` | `200 {items, total, page, limit, pages}` | `400 validation_error`, `400 unknown_query`, `401` |
| GET | `/api/jobs/[id]` | - | `200 job + job_sources` | `400 validation_error`, `404 job_not_found` |
| GET | `/api/bookmarks` | - | `200 {items}` | `401` |
| POST | `/api/bookmarks` | `job_id` | `201 {job_id, saved}` | `404 job_not_found`, `400 validation_error` |
| DELETE | `/api/bookmarks/[jobId]` | - | `200 {job_id, deleted}` | `400 validation_error` |
| GET | `/api/cv` | - | `200 {items}` (tanpa isi) | `401` |
| POST | `/api/cv` | `title`, `template_version?`, `content` | `201 cv` | `400 validation_error`, `413 payload_too_large` |
| GET | `/api/cv/[id]` | - | `200 cv` | `404 not_found` |
| PUT | `/api/cv/[id]` | `title?`, `template_version?`, `content?` | `200 cv` | `400`, `404` |
| DELETE | `/api/cv/[id]` | - | `200 {id, deleted}` | `404` |

Batas input:

- Body JSON maksimum 64 KB untuk profil, 128 KB untuk isi CV, 8 KB untuk autentikasi dan bookmark.
- `page` 1–1000, `limit` 1–50 (default 20).
- `q` dan `location` maksimum 100 karakter; karakter sintaks filter PostgREST dibersihkan.
- Profil: maksimum 10 tautan, 50 skill, 20 item per bagian pendidikan/pengalaman/proyek/organisasi/achievement.
- CV `content` harus objek JSON, kedalaman maksimum 10, ukuran maksimum 128 KB.
- URL wajib `http`/`https`; tanggal wajib `YYYY-MM` atau `YYYY-MM-DD`; ID wajib UUID.
- Field asing pada body atau query ditolak `400 unknown_field`/`400 unknown_query`.

`PUT /api/profile` adalah pengganti penuh. Field yang tidak dikirim menjadi `null` atau array kosong. Frontend harus mengirim profil lengkap agar data lama tidak hilang.

## RLS dan grant

| Tabel | anon | authenticated | service_role |
| --- | --- | --- | --- |
| `jobs` | tidak ada akses | `select` saja | semua (ingestion) |
| `job_sources` | tidak ada akses | `select` saja | semua (ingestion) |
| `profiles` | tidak ada akses | CRUD baris sendiri (`auth.uid() = user_id`, `WITH CHECK`) | semua |
| `bookmarks` | tidak ada akses | select/insert/delete baris sendiri | semua |
| `cv_documents` | tidak ada akses | CRUD baris sendiri (`WITH CHECK`) | semua |

`authenticated` tidak memiliki grant insert/update/delete pada `jobs` maupun `job_sources`, sehingga tidak dapat menulis lowongan meskipun memanggil PostgREST langsung. Semua kebijakan tulis personal memakai `WITH CHECK`.

`DELETE /api/profile` memanggil fungsi `delete_my_data()` yang menghapus profil, bookmark, dan dokumen CV milik pengguna dalam satu transaksi. Akun Supabase Auth **tidak dihapus**. Respons menyatakan `auth_account_deleted: false`. Penghapusan akun Auth memerlukan Admin API dengan service role di proses terpisah dan tidak diekspos ke pengguna.

## Kontrak ingestion lowongan

Ingestion tidak memiliki endpoint HTTP publik. Hanya `service_role` yang boleh mengeksekusi fungsi SQL idempoten `public.ingest_job(payload jsonb)`. Pipeline ingestion memanggilnya dari proses server tepercaya (misalnya GitHub Actions) dengan service role key yang tidak pernah masuk browser.

Payload:

```json
{
  "source": {
    "name": "nama-sumber",
    "job_id": "id-unik-di-sumber",
    "url": "https://sumber.example/lowongan/123",
    "published_at": "2026-11-17T08:00:00Z",
    "fetched_at": "2026-11-17T09:00:00Z"
  },
  "job": {
    "title": "Backend Engineer",
    "company": "Contoh",
    "location": "Jakarta",
    "work_mode": "hybrid",
    "employment_type": "full_time",
    "level": "mid",
    "education": null,
    "skills": ["TypeScript", "PostgreSQL"],
    "description": "Deskripsi dari sumber.",
    "deadline": null,
    "status": "open"
  }
}
```

Sifat kontrak:

- Identitas sumber unik `(source_name, source_job_id)`. Menjalankan ulang payload yang sama memperbarui `source_url`, `published_at`, dan `fetched_at` tanpa menggandakan lowongan.
- Ingestion pertama yang berjalan bersamaan untuk identitas sumber yang sama diserialisasi dengan advisory lock transaksi. Semua pemanggil menerima satu `job_id` yang sama dan hanya satu baris `job_sources` yang dibuat.
- Payload dengan `fetched_at` lebih lama daripada `fetched_at` yang tersimpan diabaikan seluruhnya: tidak menimpa konten job, tidak memundurkan timestamp, dan tetap mengembalikan `job_id` yang ada. Payload dengan waktu sama atau lebih baru memperbarui data.
- Saat menempelkan sumber baru melalui `job.id`, payload yang lebih lama daripada `jobs.last_fetched_at` hanya menambahkan provenance; konten job kanonis tidak diubah.
- `job.id` opsional (UUID) untuk melampirkan sumber baru ke lowongan kanonis yang sudah ada. Tanpa `job.id`, sumber baru membuat lowongan baru; deduplikasi lintas sumber tetap keputusan konservatif pipeline ingestion.
- Nilai `null`, string kosong, dan enum `unknown` tidak menghapus nilai valid yang sudah tersimpan. Status hanya berubah bila payload berisi `open` atau `closed`.
- `last_seen_at`, `last_fetched_at`, `published_at`, dan `fetched_at` disimpan terpisah; status source gagal tidak menutup semua lowongan.
- Field wajib: `source.name`, `source.job_id`, `source.url`, `job.title`, `job.company`. Input tidak valid ditolak exception SQL `22023`; referensi `job.id` yang tidak ada ditolak `23503`.
- Tidak ada pengambilan URL oleh backend. Tidak ada SSRF endpoint.

## Kontrak integrasi rekomendasi

Rekomendasi belum diimplementasikan dan **tidak ada endpoint rekomendasi**. Tipe kontrak ada di `lib/recommendation-contract.ts`:

- Input: `profile` (skills, education, experiences, projects, preferences) dan daftar `jobs` dengan field persyaratan serta provenance.
- Output: `{ contract_version: 1, items: [{ job_id, score, matched, missing, unknown }] }`.
- Mesin rekomendasi memiliki aturan pembobotan, normalisasi istilah, dan evaluasi. Backend hanya menyediakan data; jangan menambahkan skor palsu di backend.
- Skor bukan peluang diterima kerja, dan data kosong tidak boleh dianggap memenuhi syarat.

## Batas CV dan impor

- `cv_documents.content` adalah JSON terstruktur yang dibuat dan dikonfirmasi pengguna. Backend menyimpan objek apa adanya setelah validasi ukuran/kedalaman; skema bagian CV dimiliki editor CV.
- Backend tidak menerima upload file dan tidak menyimpan file CV asli.
- Backend tidak mengubah profil dari hasil ekstraksi CV. Impor wajib menampilkan hasil ekstraksi, meminta konfirmasi pengguna, lalu frontend memanggil `PUT /api/profile` dan/atau `POST /api/cv` secara eksplisit.
- `DELETE /api/profile` juga menghapus semua dokumen CV pengguna.

## Sumber dan batas produk

- LinkedIn tetap **BLOCKED** sampai ada akses berizin dan pengambilan nyata yang terbukti. Tidak ada scraping LinkedIn, CAPTCHA bypass, rotasi akun, atau data manual yang diklaim sebagai hasil scraping.
- Backend tidak mengambil URL apa pun dari input pengguna.
- Lamaran dilakukan pengguna di sumber asli. Tidak ada auto-submit atau penyimpanan kredensial portal kerja.
- Field yang tidak diketahui tetap `null` atau `unknown`; backend tidak mengarang gaji, tenggat, level, atau persyaratan.
- Lowongan kedaluwarsa, tanpa tenggat, dan nonteknologi harus tetap dapat ditampilkan dengan status/tenggat apa adanya.
- Repositori ini tidak memuat data lowongan contoh; feed kosong berarti belum ada ingestion nyata.

## Verifikasi

```bash
npm ci
npm run typecheck
npm run build
npm run check
```

`npm run check` menjalankan server produksi pada port `3417`, lalu memeriksa penolakan anonim pada seluruh rute terlindungi, validasi input, batas ukuran body, content-type, dan tidak adanya `x-powered-by`. Tanpa kredensial Supabase, hasil yang diharapkan adalah `401 unauthorized` untuk anonim dan `503 auth_not_configured` untuk permintaan berkredensial.

Pemeriksaan dua akun dengan Supabase nyata:

```bash
npm run build
npm run check:supabase
```

`check:supabase` memuat `.env.local`, menjalankan server produksi sementara pada port `3418`, lalu memeriksa isolasi profil, CV, bookmark, CSRF, validasi query, ingest idempoten/konkuren/usang, dan Bearer. Jika `SEVENT_BASE_URL` diisi, script memakai server yang sudah berjalan di URL tersebut dan tidak menjalankan server sendiri.

Dengan `SUPABASE_SERVICE_ROLE_KEY`, script membuat dua akun konfirmasi sementara dan menghapusnya bersama lowongan uji di blok `finally`. Tanpa service role key, isi `SEVENT_TEST_EMAIL_A`, `SEVENT_TEST_EMAIL_B`, dan `SEVENT_TEST_PASSWORD` untuk akun uji khusus; data akun tersebut tidak dihapus otomatis.

Status aktual pemeriksaan (17 November 2026):

| Pemeriksaan | Hasil | Bukti |
| --- | --- | --- |
| Typecheck | PASS | `npm run typecheck` exit 0 |
| Build produksi | PASS | `npm run build` exit 0, 13 rute terdeteksi |
| Smoke HTTP | PASS | `npm run check` exit 0, 23 pemeriksaan lulus, `x-powered-by` kosong |
| Integrasi Supabase hosted | LIVE-PROVEN | `npm run check:supabase` exit 0: dua akun, isolasi profil/CV/bookmark, CSRF login dan mutasi, logout, hapus profil/CV/bookmark, filter q/status, ingest idempoten/konkuren/usang, Bearer; data uji dibersihkan |
| Migrasi pada proyek hosted | LIVE-PROVEN | Diterapkan cloud worker pada ref proyek; hashes dicatat di laporan serah terima |
| pgTAP `supabase/tests/rls_checks.sql` | UNTESTED | Docker daemon tidak tersedia saat pemeriksaan |
| Ingestion nyata dari sumber berizin | UNTESTED | Pipeline sumber belum tersedia |
| Rekomendasi | Tidak diimplementasikan | Mesin rekomendasi berada di luar repositori ini |

Semua akun, profil, CV, bookmark, dan lowongan sintetis yang dibuat `check:supabase` dihapus di blok `finally`; tidak ada data uji yang tersisa di proyek hosted.
