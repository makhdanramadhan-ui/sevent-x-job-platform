# Anggota 2 — Backend dan integrasi

Rencana kerja SEVENT X, 17 November 2026. Pemilik integrasi dan koordinator teknis. Status implementasi: UNTESTED. Stack berikut merupakan rancangan; layanan dan batas paket belum diverifikasi untuk deployment karya.

## Keputusan bersama

- Cakupan lowongan: Indonesia, semua bidang dan tingkat pengalaman; ketercakupan kategori tidak berarti semua lowongan di internet tersedia.
- Wajib login sebelum melihat lowongan, termasuk pembatasan akses data langsung.
- Profil dipakai bersama untuk rekomendasi dan CV. Pengguna dapat mengimpor CV lama, memeriksa hasil ekstraksi, atau membuat profil dari awal berdasarkan pengalaman dan achievement nyata.
- Pengguna melamar sendiri di sumber asli; auto-submit dan penyimpanan kredensial portal kerja tidak termasuk produk.
- Tidak mengelola VPS dan tidak memakai model bahasa untuk fitur inti. Rekomendasi berbasis aturan; ekstraksi dokumen bukan jaminan pemahaman semua format.
- LinkedIn wajib menurut kebutuhan pengguna, tetapi integrasinya berstatus BLOCKED sampai akses berizin dan hasil pengambilan nyata terbukti. Sumber lain hanya pelengkap, bukan pengganti diam-diam.
- Tidak ada standar CV universal HR atau jaminan lolos ATS. Targetnya format sederhana, teks dapat diseleksi, dan hasil dapat diedit pengguna.

## Kepemilikan dan stack

- Next.js Route Handlers untuk operasi server khusus; gunakan Supabase langsung untuk CRUD yang aman dengan Row Level Security, tanpa backend Express tambahan.
- Supabase PostgreSQL, Auth, dan Storage privat jika file perlu disimpan.
- Vercel sebagai usulan deployment web/API; GitHub Actions sebagai usulan penjadwal scraper anggota 3. Periksa kuota, durasi, biaya, dan kesesuaian layanan sebelum dipilih final.
- Memiliki migrasi, kebijakan akses, validasi server, endpoint, integrasi scraper, deployment, dan pemeriksaan rilis.
- Menentukan skema bersama sebelum implementasi paralel; perubahan skema dan kontrak harus dikomunikasikan ke seluruh pemilik fitur.

## Kontrak data minimum

| Data | Isi |
|---|---|
| Profil | Identitas akun, kontak yang dipilih pengguna, pendidikan, skills, pengalaman, proyek, organisasi, achievement, preferensi posisi/lokasi/level |
| Lowongan | ID internal, identitas dan URL sumber, posisi, perusahaan, lokasi, mode kerja, jenis kerja, level, pendidikan, skills, deskripsi, tenggat bila tersedia, waktu pengambilan, status |
| Rekomendasi | ID lowongan, skor kecocokan, faktor cocok, faktor kurang, faktor tidak diketahui |
| Lowongan tersimpan | ID pengguna dan ID lowongan unik per pasangan |
| Dokumen CV | ID pengguna, data CV terstruktur, versi template; file asal tidak disimpan permanen secara default |

Informasi tidak diketahui tetap null atau ditandai tidak diketahui; jangan mengarang gaji, tenggat, level, persyaratan, atau achievement. Satu tabel lowongan kanonis dapat memiliki beberapa rujukan sumber agar deduplikasi lintas sumber tidak menghapus provenance.

## Keamanan dan privasi

- Semua akses profil, CV, dan lowongan tersimpan dibatasi pemilik melalui RLS. Data lowongan hanya dapat dibaca pengguna terautentikasi.
- Kunci administratif hanya untuk proses terpercaya; tidak pernah masuk browser, repository publik, log, atau video demo.
- Validasi tipe, ukuran, dan isi file; parser memperlakukan dokumen sebagai input tidak terpercaya. Tolak format tak didukung dengan pesan jelas.
- Utamakan parsing CV lokal di browser; jika upload server diperlukan, gunakan penyimpanan privat, akses terbatas, batas retensi, dan penghapusan file sementara.
- Jangan mencatat teks CV atau data pribadi ke log. Sediakan penghapusan profil dan CV beserta file terkait.
- Impor URL sumber dibatasi ke host yang disetujui; jangan membuat endpoint pengambil URL bebas yang membuka risiko SSRF.

## Urutan integrasi

1. Tetapkan kontrak profil, lowongan, rekomendasi, dan data CV bersama seluruh anggota.
2. Buktikan login dan isolasi akses dengan dua akun; siapkan deployment awal.
3. Hubungkan satu sumber yang diizinkan dan mesin rekomendasi dari anggota 3.
4. Hubungkan frontend anggota 1 dan editor CV anggota 4 ke profil yang sama.
5. Uji seluruh alur pada deployment, termasuk kegagalan sumber dan pemisahan data pengguna.
6. Periksa repository publik bebas secret, URL aktif, proposal dan surat orisinalitas sesuai template, serta video maksimal 5 menit.

## Target kerja yang diusulkan

| Tanggal 2026 | Hasil |
|---|---|
| 17–19 November | Kontrak data, validasi sumber LinkedIn, desain alur, spike ekstraksi CV |
| 20–24 November | Fitur inti terintegrasi pada deployment |
| 25–27 November | Uji pengguna, perbaikan, proposal, dan video demo |
| 28 November | Target submit internal lebih awal |
| 29–30 November | Cadangan sebelum batas resmi; jam dan zona waktu penutupan harus dikonfirmasi |

LinkedIn tetap kebutuhan wajib yang belum terpenuhi bila izin/akses tidak tersedia; eskalasi keputusan cakupan kepada tim, jangan menyatakan produk lengkap. Timeline ini target kerja, bukan klaim integrasi pasti tersedia.

## Bukti selesai

- Dua akun tidak dapat membaca atau mengubah profil, CV, dan bookmark satu sama lain.
- Permintaan anonim ditolak pada halaman dan permukaan data yang dilindungi.
- Upsert scraper idempoten, input tidak valid ditolak, dan kegagalan tidak menghapus data valid.
- Alur login, profil, rekomendasi, impor/buat CV, unduh PDF, dan buka sumber asli berhasil pada deployment nyata.
- Bukti pengujian dibedakan LIVE-PROVEN, SIMULATED, atau UNTESTED; hanya data nyata berizin dipakai untuk mengklaim agregasi langsung.
- Menulis bagian arsitektur, keamanan, deployment, dan batas sistem dalam proposal; mengoordinasikan submission bersama seluruh anggota.

## Dokumen anggota lain

- [Anggota 1: Frontend dan UX](01-frontend-ux.md)
- [Anggota 3: Data lowongan dan rekomendasi](03-data-rekomendasi.md)
- [Anggota 4: CV dan QA](04-cv-qa.md)

## Sumber

- Rulebook lokal: `F:/apaelah/TUGAS/smt5/IoT/dokumentasi tambahan/SEVENT X - Software Development Rulebook.pdf`, terutama halaman 6–11 dan 14–16. Deadline pendaftaran/submission 30 November 2026; karya wajib orisinal dan belum pernah dibuat serta dipublikasikan sebelumnya untuk lomba maupun tujuan lain.
- [LinkedIn User Agreement](https://www.linkedin.com/legal/user-agreement), bagian 8.2: larangan scraping, akses otomatis tanpa izin, dan penyalinan/distribusi tanpa persetujuan yang diperlukan. Dibaca 17 November 2026.
