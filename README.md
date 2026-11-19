# RakitKarier

Platform web untuk membantu pengguna menemukan lowongan kerja yang relevan dan menyiapkan CV dari pengalaman serta pencapaian mereka. Dikembangkan untuk kompetisi Software Development SEVENT X dengan subtema SDG 8: Decent Work and Economic Growth.

## Fitur yang direncanakan

- Agregasi lowongan dari sumber eksternal yang memiliki akses berizin, dengan tautan ke sumber asli.
- Rekomendasi lowongan berdasarkan kemampuan, pengalaman, dan preferensi pengguna.
- Impor CV lama untuk ditinjau dan diedit, atau membuat CV baru dari awal menggunakan template sederhana.
- Penyimpanan lowongan favorit. Pengguna mengirim lamaran sendiri melalui sumber asli.

## Teknologi dan pengembangan

Next.js, TypeScript, dan Supabase untuk website, autentikasi, serta database; Python direncanakan untuk pengambilan data lowongan.

Repositori ini digunakan bersama untuk seluruh proyek: frontend, backend, agregasi lowongan, rekomendasi, dan fitur CV. Saat ini backend dan migrasi database sudah tersedia; frontend produk, pipeline lowongan, rekomendasi, serta impor dan ekspor CV belum diimplementasikan. Akses LinkedIn belum tersedia dan tetap memerlukan jalur berizin.

## Unggahan berkas

- Foto profil pengguna adalah satu-satunya unggahan berkas yang diterima.

## Menjalankan secara lokal

1. Gunakan Node.js minimal 20.9.0, lalu jalankan `npm ci`.
2. Buat `.env.local` dari `.env.example` hanya jika belum ada, lalu isi konfigurasi Supabase. Jangan commit kredensial.
3. Untuk proyek Supabase baru, jalankan SQL di `supabase/migrations/` sesuai urutan nama file.
4. Jalankan `npm run dev`.

## Autentikasi dan pembatasan percobaan

- Pendaftaran (`POST /api/auth/signup`) dibuat server-side lewat Supabase Admin API dengan `email_confirm: true`, lalu langsung membuat sesi cookie (tanpa email konfirmasi). Membutuhkan `SUPABASE_SERVICE_ROLE_KEY` di server.
- Login Google: `GET /api/auth/google?next=/path` mengarah ke OAuth Supabase, lalu `GET /auth/callback` menukar kode sesi dan mengarahkan ke `/onboarding` (belum ada profil) atau `next`/`/jobs`. Provider Google harus diaktifkan di dashboard Supabase; jika belum, endpoint mengembalikan alihan gagal yang aman ke `/login`.
- Pembatasan percobaan autentikasi disimpan persisten di Supabase (`public.auth_rate_limits`) melalui RPC `public.consume_rate_limit` (service role saja, kunci berupa hash SHA-256 IP/email, bukan nilai mentah). Batas: `POST /api/auth/signup` 5 percobaan per IP per jam dan 3 per email per jam, `POST /api/auth/login` 10 percobaan per IP per 15 menit, `GET /api/auth/google` 20 percobaan per IP per 15 menit. Respons saat melebihi batas: `429` dengan `{ "error": { "code": "rate_limited", "message": "Terlalu banyak percobaan. Coba lagi dalam N menit." } }` dan header `Retry-After`.
- Jika RPC pembatas gagal: pendaftaran **fail closed** (permintaan ditolak) untuk mencegah bypass batas; login dan awal OAuth Google **fail open** (permintaan dilanjutkan, galat dicatat di log server) agar pengguna tetap bisa masuk saat infrastruktur pembatas bermasalah.

## Migrasi pembatas autentikasi (wajib sebelum deploy kode pembatas)

Migrasi `supabase/migrations/20261119160000_auth_rate_limit.sql` membuat tabel `public.auth_rate_limits` dan RPC `public.consume_rate_limit`. DDL tidak dapat dijalankan dengan `service_role` saja. Terapkan pada proyek Supabase ter-host (`rkrqjmkbrjfudgaivbex`) melalui Supabase SQL Editor: buka editor SQL proyek, tempel isi file migrasi tersebut, lalu jalankan. Pastikan fungsi `extensions.digest` tersedia (ekstensi `pgcrypto` pada skema `extensions`, bawaan Supabase). Jangan men-deploy kode yang memanggil RPC sebelum migrasi berhasil diterapkan.

## Pemeriksaan

Pemeriksaan backend: `npm run typecheck`, `npm run build`, `npm run check`, dan `npm run check:supabase` untuk integrasi dengan proyek Supabase uji. Kedua skrip pemeriksaan ditulis dalam TypeScript dan dijalankan melalui `tsx`; `npm run typecheck` juga memeriksa keduanya.
