# Dokumentasi Sumber Data, Bukti Pengambilan Nyata, dan Metode Rekomendasi (Anggota 3)

Dokumen ini mencatat sumber lowongan yang digunakan oleh pipeline akuisisi SEVENT X, bukti pengambilan nyata ke Supabase (`ingest_job`), perilaku pembatasan (*rate-limit* HTTP 429) pada LinkedIn, serta metode rekomendasi berbasis aturan.

---

## 1. Daftar Sumber Lowongan Aktif (LinkedIn + 3 Sumber Alternatif)

| No | Nama Sumber (`source.name`) | URL / Endpoint | Cakupan Bidang | Ketentuan & Pengaman | Metode Pengambilan |
|---|---|---|---|---|---|
| **1** | `linkedin_guest` | `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search` | Lowongan Indonesia berdasarkan tag/keyword pekerjaan (`frontend developer`, `backend developer`, `akuntansi`, `digital marketing`, `human resources`) | Mengambil halaman publik tanpa login dengan jeda antar request. **Pengaman ketat:** tidak mem-bypass CAPTCHA/authwall; begitu menerima `HTTP 429 / 999` atau *authwall*, scraper langsung berhenti dan mencatat status `BLOCKED` sambil tetap menyimpan item yang sudah berhasil diambil. | HTTP GET HTML + parser kartu (`urn:li:jobPosting:<id>`) & halaman detail (`Seniority level`, `Employment type`). |
| **2** | `himalayas_api` | `https://himalayas.app/jobs/api` | Design, Marketing, Sales, Finance, Operations, Customer Support, HR, Engineering | Public API terbuka dengan atribusi URL sumber asli (`guid` / `applicationLink`). | HTTP GET JSON client (`httpx` / `urllib.request`) + ekstraksi level, lokasi, kategori, dan HTML strip. |
| **3** | `jobicy_api` | `https://jobicy.com/api/v2/remote-jobs` | Marketing, Copywriting, Business & Finance, HR, Customer Support, Design, Engineering, Data Science | Public API v2 terbuka untuk agregator dengan atribusi URL asli (`url`). | HTTP GET JSON client + normalisasi enum kontrak. |
| **4** | `remotive_api` | `https://remotive.com/api/remote-jobs` | Software Development, Customer Service, Marketing, Design, Sales, Product, Finance/Legal, HR | Public API resmi gratis; wajib menautkan URL sumber asli Remotive (`url`). | HTTP GET JSON client + parser HTML deskripsi. |

*(Catatan: File `scrapers/data/verified_jobs_feed.json` hanya digunakan sebagai fixture unit test deterministik offline dan tidak dikirim ke database pada mode `--live`).*

---

## 2. Bukti Pengambilan Nyata & Idempotensi di Supabase

Hasil eksekusi nyata (`py -3 -m scrapers.run_ingest --live`) telah memasukkan lowongan asli ke database Supabase melalui RPC `public.ingest_job(jsonb)`:

- **Contoh Lowongan dari `linkedin_guest` (Indonesia) yang berhasil masuk:**
  - `4491078917` — *Senior React Js Developer* (**SoftwareSeni**) → UUID `0ab1c859-c476-45f9-8b32-142c39a37951`
  - `4491152237` — *Senior Software Engineer, Frontend* (**Xenith**) → UUID `eecf15e5-844d-404e-b340-7e3deaeba9fa`
  - `4440204415` — *Backend Engineer - Golang (SDE II)* (**Kredivo Group**) → UUID `6aa74748-ced2-42e5-863b-22ca3745e25b`
  - `4487207111` — *Senior Backend Engineer I - Platform* (**Ajaib**) → UUID `0e9d45f1-8237-4a7d-8396-01aceb7d100d`
- **Bukti Pembatasan (`BLOCKED`) & Ketahanan Pipeline:**
  - Pada tag pencarian ke-3 (`akuntansi`), LinkedIn mengembalikan `HTTP 429 (Too Many Requests)`.
  - Sesuai pengaman, scraper segera menghentikan request lanjutan ke LinkedIn dan mencatat status `BLOCKED (HTTP 429)` secara transparan tanpa menghapus 4 lowongan LinkedIn yang sudah didapat, sementara 3 sumber alternatif (`himalayas_api`, `jobicy_api`, `remotive_api`) tetap sukses diproses seluruhnya.
- **Bukti Idempotensi:**
  - Lowongan yang sama (misal `jobicy_api` ID `163239` — *Mobile Application Developer - AI Finance Agent* di **BJAK**) ketika di-ingest ulang mengembalikan UUID yang sama persis (`11c6f40d-7bae-4617-a1ed-3d403f167976`) tanpa menggandakan baris di tabel `jobs` maupun `job_sources`.

---

## 3. Metode Rekomendasi Berbasis Aturan (`lib/recommendation/**`)

- **Rentang Skor:** `0` hingga `100` (bilangan bulat). Skor adalah **indeks kesesuaian persyaratan & preferensi**, **bukan** peluang diterima bekerja.
- **Bobot Dimensi (Total 100 Poin):**
  - **Skills (Syarat Wajib):** 40 poin (mendukung kamus sinonim lintas bidang seperti `React.js` ↔ `React`, `JS` ↔ `JavaScript`, `Golang` ↔ `Go`, `Akuntansi` ↔ `Accounting`, `Brevet Pajak` ↔ `Taxation`, `Ms Excel` ↔ `Microsoft Excel`).
  - **Posisi / Jabatan:** 20 poin.
  - **Level Pengalaman:** 15 poin (`intern`, `entry`, `junior`, `mid`, `senior`, `lead`).
  - **Pendidikan:** 10 poin (`SMA/SMK` ≤ `D3` ≤ `S1/D4` ≤ `S2` ≤ `S3`).
  - **Mode Kerja & Lokasi:** 10 poin (5 poin `work_mode` + 5 poin `location`).
  - **Tipe Kontrak (`employment_type`):** 5 poin.
- **Penanganan Data Kosong (`unknown`) & Pencegahan Presisi Palsu:**
  - Atribut yang kosong di lowongan maupun di profil pengguna tidak dihitung cocok (`matched`) dan tidak dianggap melanggar syarat (`missing`), melainkan dimasukkan ke daftar `unknown`.
  - Apabila profil pengguna masih kosong atau informasi pembanding yang dapat dievaluasi terlalu sedikit (`evaluatableWeight <= 20`), mesin mengembalikan `score: 0` dengan penjelasan `"Informasi belum cukup..."` pada `unknown`.
