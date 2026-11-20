export type EmptyHintCode =
  | 'ingest_pending'
  | 'no_keyword_match'
  | 'location_too_narrow'
  | 'remote_only'
  | 'no_jobs_available';

export type EmptyHint = {
  code: EmptyHintCode;
  title: string;
  description: string;
  loosen: string;
};

export type EmptyHintInput = {
  totalCandidates: number;
  keywordMatches?: number;
  diagnostics: Record<string, number>;
  locations: ReadonlyArray<string>;
  positions: ReadonlyArray<string>;
  ingestPending: boolean;
};

function joinLabels(items: ReadonlyArray<string>, fallback: string): string {
  const cleaned = items.filter((item) => item.trim().length > 0);
  return cleaned.length > 0 ? cleaned.slice(0, 3).join(', ') : fallback;
}

export function buildEmptyHint(input: EmptyHintInput): EmptyHint {
  const locationLabel = joinLabels(input.locations, 'lokasi pilihanmu');
  const positionLabel = joinLabels(input.positions, 'bidang pilihanmu');
  const diagnostics = input.diagnostics;

  if (input.ingestPending) {
    return {
      code: 'ingest_pending',
      title: 'Sedang mencari lowongan untuk lokasimu…',
      description: `Profilmu baru disimpan. Kami sedang mengambil lowongan LinkedIn untuk ${locationLabel} dan ${positionLabel}.`,
      loosen: 'Tunggu beberapa saat lalu muat ulang halaman ini.',
    };
  }

  if (input.totalCandidates === 0) {
    return {
      code: 'no_jobs_available',
      title: 'Belum ada lowongan di sistem',
      description: 'Katalog lowongan belum terisi, jadi belum ada yang bisa dicocokkan dengan profilmu.',
      loosen: 'Coba lagi setelah proses pengambilan lowongan berjalan.',
    };
  }

  if (input.keywordMatches === 0) {
    return {
      code: 'no_keyword_match',
      title: 'Belum ada lowongan untuk keahlian dan posisi ini',
      description: `Tidak ada lowongan yang memuat ${positionLabel} maupun keahlian dari profilmu.`,
      loosen: 'Tambahkan posisi atau keahlian lain di profil, lalu simpan.',
    };
  }

  if ((diagnostics.remote_not_selected ?? 0) > (diagnostics.location_mismatch ?? 0)) {
    return {
      code: 'remote_only',
      title: 'Lowongan yang cocok sebagian besar berstatus remote luar negeri',
      description: 'Lowongan remote tersebut tidak terbuka untuk Indonesia, sehingga tidak ditampilkan.',
      loosen: 'Tambahkan lokasi dalam negeri atau Jabodetabek pada preferensi lokasi.',
    };
  }

  return {
    code: 'location_too_narrow',
    title: `Belum ada lowongan yang cocok di ${locationLabel}`,
    description: `Lowongan untuk ${positionLabel} ditemukan di lokasi lain, misalnya Jabodetabek atau provinsi sekitarnya.`,
    loosen: 'Tambahkan Jabodetabek / provinsi tetangga pada lokasi, atau aktifkan Remote bila tersedia.',
  };
}
