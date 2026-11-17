# Anggota 3 — Data lowongan dan rekomendasi

Rencana kerja SEVENT X, 17 November 2026. Pemilik akuisisi data, normalisasi, deduplikasi, dan pencocokan. Status integrasi sumber dan rekomendasi: UNTESTED.

## Prioritas pertama: LinkedIn

LinkedIn wajib sesuai permintaan pengguna, tetapi akses pasti belum dapat dijanjikan. [User Agreement LinkedIn](https://www.linkedin.com/legal/user-agreement), bagian 8.2, melarang scraping dan akses otomatis tanpa izin serta membatasi penyalinan dan distribusi konten. Ketersediaan layanan juga tidak dijamin pada bagian 3.2 dan 4.1.

- Verifikasi jalur akses berizin, persyaratan persetujuan, cakupan data lowongan, hak menampilkan ulang, kuota, biaya, dan masa akses.
- API posting lowongan tidak otomatis berarti API pencarian atau pengambilan semua lowongan. Klaim kemampuan harus didukung dokumentasi dan hasil nyata.
- Layanan scraper pihak ketiga tidak otomatis memberikan izin atau akses berkelanjutan.
- Jangan menghindari CAPTCHA, menggunakan cookie akun orang lain, merotasi akun untuk melewati pembatasan, atau menjanjikan uptime sumber eksternal.
- Hasil tahap awal harus berupa bukti akses yang diizinkan dan pengambilan nyata, atau laporan BLOCKED dengan penyebab dan keputusan yang dibutuhkan tim.
- Sumber lain tetap pelengkap. Jangan mengganti LinkedIn diam-diam atau memasukkan data manual lalu mengakuinya sebagai scraping.

## Kepemilikan pipeline

- Python dengan HTTP client dan parser HTML untuk sumber yang diizinkan; browser otomatis hanya jika diperlukan dan diperbolehkan.
- Job terjadwal GitHub Actions sebagai usulan, bukan pengambilan di setiap request website. Tidak perlu VPS.
- Mendata sumber pelengkap beserta URL, izin/ketentuan, metode pengambilan, dan hak penggunaan poster.
- Menormalisasi posisi, perusahaan, lokasi, tipe kerja, level pengalaman, skills, pendidikan, tenggat, dan URL sumber.
- Menyimpan provenance dan waktu pengambilan; memisahkan waktu lowongan diterbitkan dari waktu scraper berjalan.
- Upsert berdasarkan identitas sumber; deduplikasi lintas sumber secara konservatif dan pertahankan semua rujukan sumber. Posisi sama di perusahaan sama belum tentu satu lowongan.
- Tidak menandai semua lowongan tutup ketika scraping gagal. Catat sumber gagal, data lama, dan tenggat yang diketahui secara terpisah.
- Instagram merupakan sumber pelengkap yang perlu verifikasi tersendiri. Poster tanpa caption terstruktur memerlukan OCR atau input berizin; jangan mengklaim parser HTML dapat membaca isi gambar.

## Rekomendasi tanpa model bahasa

- Cocokkan profil dan persyaratan menggunakan aturan berbobot yang disepakati tim: skills, posisi, lokasi/mode kerja, pendidikan, dan level pengalaman.
- Bangun normalisasi istilah lintas bidang secara bertahap tanpa menyatakan dukungan bidang sudah lengkap hanya karena filternya tersedia.
- Pisahkan kecocokan preferensi dari syarat wajib. Data kosong tidak dianggap memenuhi atau melanggar syarat.
- Jika informasi pembanding tidak cukup, tampilkan informasi belum cukup, bukan angka presisi palsu.
- Kembalikan alasan cocok, kebutuhan yang belum terpenuhi, dan persyaratan tidak diketahui bersama skor.
- Jangan memakai gender, agama, atau atribut sensitif untuk memberi peringkat pengguna.
- Jangan menafsirkan skor sebagai peluang diterima bekerja.

## Serah terima

- Skema dan endpoint mengikuti [anggota 2](02-backend-integrasi.md).
- Anggota 1 menerima lowongan terstruktur, alasan rekomendasi, status sumber, serta waktu pengambilan.
- Anggota 4 menyediakan profil hasil ekstraksi yang sudah dikonfirmasi pengguna; data ekstraksi mentah tidak langsung digunakan sebagai fakta pengguna.
- Menulis bagian sumber data, metode pencocokan, evaluasi, dan batas cakupan dalam proposal; menunjukkan pengambilan nyata saat demo bila sudah tersedia.

## Bukti selesai

- Pengambilan sumber berizin menghasilkan lowongan nyata, URL asli, dan timestamp; running ulang tidak menggandakan data.
- Sumber gagal tidak menyebabkan data valid terhapus atau laporan sukses palsu.
- Pemeriksaan mencakup lowongan kedaluwarsa, tanpa tenggat, kategori nonteknologi, level senior, duplikat, profil kosong, skill sinonim, dan persyaratan tidak diketahui.
- Satu pemeriksaan deterministik dipertahankan untuk memastikan perubahan skill/preferensi mengubah peringkat dan alasan secara konsisten.
- Keberhasilan satu request dibedakan dari keandalan berulang; akses masa depan tidak pernah dijamin mutlak.
