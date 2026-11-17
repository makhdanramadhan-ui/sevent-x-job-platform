# Anggota 4 — CV dan QA

Rencana kerja SEVENT X, 17 November 2026. Pemilik fitur CV dari input hingga PDF dan koordinator QA. Setiap anggota tetap menguji fiturnya sendiri. Status ekstraksi dan ekspor: UNTESTED.

## Cakupan CV

- Pengguna dapat membuat CV dari nol dengan profil, pengalaman, pendidikan, proyek, organisasi, skills, sertifikasi, dan achievement yang benar-benar dimiliki.
- Pengguna dapat mengimpor CV lama, memeriksa serta mengoreksi hasil ekstraksi, lalu menggunakan datanya untuk CV baru dan rekomendasi lowongan.
- Satu template awal yang sederhana dan satu kolom; personalisasi berupa pilihan bagian, urutan, dan isi berdasarkan data pengguna, bukan mengarang pengalaman.
- Preview dapat diedit sebelum unduh; PDF memiliki teks yang dapat diseleksi, heading jelas, tautan yang berfungsi, dan pemenggalan halaman yang tidak merusak isi.
- Tidak menyebut template sebagai standar universal HR atau menjamin lolos ATS.

## Ekstraksi tanpa model bahasa

- Buktikan lebih dahulu ekstraksi PDF berbasis teks dan DOCX sebagai usulan format awal. Format final dan batas ukuran ditetapkan setelah spike dan disetujui tim; jangan menjanjikan semua dokumen bisa dipahami.
- Gunakan parser yang sudah tersedia bila proyek memilikinya. PDF.js dan parser DOCX merupakan kandidat, bukan dependensi yang sudah dipasang.
- Ekstraksi teks tidak sama dengan identifikasi pengalaman, tanggal, dan achievement. Gunakan pemetaan bagian berbasis aturan serta tahap konfirmasi pengguna.
- Jangan menimpa profil lama sebelum pengguna menyetujui hasil impor. Periksa konflik, duplikasi, urutan tanggal, kontak, dan bagian yang gagal dikenali.
- PDF scan, dokumen terenkripsi, format kompleks, atau input rusak harus menghasilkan pesan jelas dan tidak boleh dianggap sukses kosong.
- Scan memerlukan OCR. OCR lokal bukan layanan model bahasa, tetapi tetap memakai model pengenalan teks; dukungannya belum diputuskan. Jika OCR menjadi kebutuhan pengguna, sepakati cakupannya sebelum menyatakan fitur lengkap.
- Utamakan parsing lokal di browser agar file pribadi tidak perlu diunggah; jika diperlukan proses server, koordinasikan batas ukuran, timeout, privasi, dan penghapusan dengan anggota 2.

## Kepemilikan antarmuka dan integrasi

- Memiliki halaman impor CV, pemetaan/konfirmasi ekstraksi, editor isi, preview, dan ekspor PDF.
- Menggunakan komponen serta gaya dari [anggota 1](01-frontend-ux.md), bukan membuat sistem desain kedua.
- Menulis ke kontrak profil dan CV yang dimiliki [anggota 2](02-backend-integrasi.md).
- Menyerahkan hanya data yang telah dikonfirmasi pengguna untuk rekomendasi [anggota 3](03-data-rekomendasi.md).

## Bukti selesai fitur CV

- Buat CV dari nol menggunakan pengalaman dan achievement; simpan, buka ulang, edit, unduh, dan periksa PDF sebenarnya.
- Impor CV contoh milik sendiri atau sintetis, koreksi hasil, konfirmasi, dan pastikan data yang sama masuk profil serta CV baru.
- Periksa nama Indonesia/non-ASCII, isi panjang beberapa halaman, bagian kosong, tautan, dan format tanggal.
- Periksa file rusak, file terlalu besar, tipe palsu, PDF scan, serta CV multi-kolom; tampilkan keterbatasan dengan jujur.
- Pertahankan satu pemeriksaan runnable untuk memastikan isi penting tetap terbaca setelah ekspor dan impor tidak mengubah profil tanpa konfirmasi.
- Jangan memasukkan CV pribadi pengguna ke repository publik atau rekaman demo.

## QA dan materi lomba

- Susun checklist lintas fitur; anggota pemilik memperbaiki bug masing-masing, anggota 2 memiliki keputusan rilis teknis.
- Uji perjalanan lengkap di deployment: login, impor atau isi profil, koreksi, rekomendasi, detail lowongan, simpan, ekspor CV, dan buka sumber asli.
- Uji dua akun dan akses anonim bersama anggota 2; cek kebocoran data, kegagalan upload, dan sesi kedaluwarsa.
- Dokumentasikan hasil aktual sebagai LIVE-PROVEN, SIMULATED, atau UNTESTED, bukan centang tanpa bukti.
- Menulis bagian CV, hasil pengujian, dan keterbatasan dalam proposal; menyusun video demo bersama tim, maksimal 5 menit.
- Judul video sesuai rulebook: `Nama Tim | SoftDev-SEVENT X National Competition`.
- Proposal mengikuti template panitia tanpa mengubah struktur, maksimal 25 halaman di luar cover, daftar pustaka, dan lampiran. Setiap anggota menyumbang bagian sesuai perannya; surat orisinalitas dan repository publik diperiksa bersama.
