export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export type FileValidationSuccess = {
  ok: true;
  format: 'pdf' | 'docx';
  fileName: string;
  fileSize: number;
};

export type FileValidationError = {
  ok: false;
  error: string;
  details?: string;
};

export type FileValidationResult = FileValidationSuccess | FileValidationError;

export async function validateImportFile(file: File): Promise<FileValidationResult> {
  if (!file) {
    return { ok: false, error: 'Tidak ada file yang dipilih.' };
  }

  // 1. Cek ukuran file
  if (file.size === 0) {
    return { ok: false, error: 'File kosong (0 byte).' };
  }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `Ukuran file terlalu besar (${sizeMb} MB). Batas maksimum file impor adalah 10 MB.`,
    };
  }

  // 2. Baca 16 byte pertama untuk memeriksa tanda tangan file (magic bytes)
  const headerSlice = file.slice(0, 16);
  const buffer = await headerSlice.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Periksa magic bytes PDF: %PDF- (0x25, 0x50, 0x44, 0x46)
  const isPdfMagic =
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;

  // Periksa magic bytes ZIP/DOCX: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  const isDocxMagic =
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  // Periksa magic bytes OLE CFBF / DOC lama: 0xD0, 0xCF, 0x11, 0xE0
  const isLegacyDocMagic =
    bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (isLegacyDocMagic || ext === 'doc') {
    return {
      ok: false,
      error: 'Format Microsoft Word lama (.doc) belum didukung.',
      details:
        'Silakan simpan ulang dokumen Anda ke format modern (.docx) atau ekspor ke PDF sebelum mengimpor.',
    };
  }

  if (isPdfMagic) {
    if (ext !== 'pdf') {
      return {
        ok: false,
        error: `Tanda tangan file adalah PDF, namun berekstensi .${ext}. Mohon sesuaikan nama file.`,
      };
    }
    return {
      ok: true,
      format: 'pdf',
      fileName: file.name,
      fileSize: file.size,
    };
  }

  if (isDocxMagic) {
    if (ext !== 'docx') {
      return {
        ok: false,
        error: `Tanda tangan file berupa arsip dokumen ZIP/DOCX, namun berekstensi .${ext}. Mohon pastikan file berformat .docx.`,
      };
    }
    return {
      ok: true,
      format: 'docx',
      fileName: file.name,
      fileSize: file.size,
    };
  }

  // File tidak dikenal atau tipe palsu
  return {
    ok: false,
    error: 'Format file tidak didukung atau isi file rusak.',
    details:
      'Hanya file PDF berbasis teks (.pdf) dan dokumen Microsoft Word modern (.docx) yang dapat diimpor.',
  };
}
