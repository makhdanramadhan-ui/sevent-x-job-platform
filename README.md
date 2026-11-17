# SEVENT X — Job Platform

Website pencarian kerja untuk membantu pengguna menemukan lowongan yang relevan dan menyiapkan CV dari pengalaman serta pencapaian mereka. Dikembangkan untuk kompetisi Software Development SEVENT X dengan subtema SDG 8: Decent Work and Economic Growth.

## Fitur yang direncanakan

- Agregasi lowongan dari sumber eksternal yang memiliki akses berizin, dengan tautan ke sumber asli.
- Rekomendasi lowongan berdasarkan kemampuan, pengalaman, dan preferensi pengguna.
- Impor CV lama untuk ditinjau dan diedit, atau membuat CV baru dari awal menggunakan template sederhana.
- Penyimpanan lowongan favorit. Pengguna mengirim lamaran sendiri melalui sumber asli.

## Teknologi dan pengembangan

Next.js, TypeScript, dan Supabase untuk website, autentikasi, serta database; Python direncanakan untuk pengambilan data lowongan.

Repositori ini digunakan bersama untuk seluruh proyek: frontend, backend, agregasi lowongan, rekomendasi, dan fitur CV. Saat ini backend dan migrasi database sudah tersedia; frontend produk, pipeline lowongan, rekomendasi, serta impor dan ekspor CV belum diimplementasikan. Akses LinkedIn belum tersedia dan tetap memerlukan jalur berizin.

## Menjalankan secara lokal

1. Jalankan `npm ci`.
2. Buat `.env.local` dari `.env.example` hanya jika belum ada, lalu isi konfigurasi Supabase. Jangan commit kredensial.
3. Untuk proyek Supabase baru, jalankan SQL di `supabase/migrations/` sesuai urutan nama file.
4. Jalankan `npm run dev`.

Pemeriksaan backend: `npm run typecheck`, `npm run build`, `npm run check`, dan `npm run check:supabase` untuk integrasi dengan proyek Supabase uji.
