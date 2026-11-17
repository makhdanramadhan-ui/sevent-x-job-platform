# Anggota 1 — Frontend dan UX

Rencana kerja SEVENT X, 17 November 2026. Pembagian berdasarkan tanggung jawab, bukan penilaian kemampuan anggota. Nama anggota belum ditentukan. Status implementasi: UNTESTED; dokumen ini bukan bukti fitur sudah berjalan.

## Tujuan produk

Website agregasi lowongan Indonesia untuk semua bidang dan tingkat pengalaman. Pengguna wajib login untuk melihat lowongan. Sistem merekomendasikan lowongan dari profil, menyediakan pembuatan CV baru dan impor CV lama, lalu mengarahkan pengguna melamar sendiri di sumber asli. Tidak ada auto-submit.

## Kepemilikan

- Memiliki halaman login, onboarding, profil, feed, detail lowongan, rekomendasi, dan lowongan tersimpan.
- Menyusun desain responsif dan komponen bersama dengan Next.js dan TypeScript.
- Menyediakan komponen formulir, navigasi, notifikasi, serta state loading, kosong, gagal, dan sukses untuk digunakan anggota 4.
- Mengintegrasikan API nyata anggota 2; tidak menampilkan data contoh sebagai lowongan hasil scraping.
- Menampilkan alasan rekomendasi, persyaratan yang belum cocok, sumber asli, status lowongan, dan waktu pengambilan data.
- Memimpin penjelasan masalah, target pengguna, dan UI/UX dalam proposal serta pembukaan presentasi. Setiap anggota tetap menulis bagian fiturnya.

## Batas tampilan

- Poster adalah elemen opsional bila hak penggunaannya tersedia; detail teks tetap dapat digunakan tanpa gambar.
- Jangan menyebut lowongan terverifikasi aman hanya karena berhasil diambil.
- Tombol lamaran membuka sumber asli, bukan mengubah status menjadi terkirim.
- Skor kecocokan bukan peluang diterima bekerja.
- Tidak ada klaim semua HR memakai satu template atau CV pasti lolos ATS.

## Serah terima

- Kontrak data dan batas keamanan mengikuti [anggota 2](02-backend-integrasi.md).
- Anggota 3 memberikan alasan rekomendasi dan status kesegaran sumber.
- Anggota 4 memiliki isi serta logika halaman impor, editor, preview, dan ekspor CV; anggota 1 menyediakan komponen dan konsistensi desainnya.

## Bukti selesai

- Pengguna yang belum login tidak bisa membuka feed maupun mengambil data lewat API.
- Di browser seluler dan desktop, pengguna dapat login, mengisi profil, melihat rekomendasi, menyimpan lowongan, dan membuka sumber asli.
- Navigasi keyboard, label formulir, fokus terlihat, kontras, pesan kesalahan, dan poster dengan teks alternatif diperiksa pada halaman nyata.
- Profil kosong, hasil pencarian kosong, sesi berakhir, sumber tidak tersedia, dan API gagal memiliki tampilan yang jujur.
- Bagian proposal dan cuplikan demo sesuai fitur yang benar-benar berjalan.
