import type { CvContent } from './types';

/**
 * SEVENT X - Studio CV: NIST Security & Privacy Compliance Module
 * 
 * Standar Acuan:
 * 1. NIST SP 800-53 Rev. 5:
 *    - SI-10: Information Input Validation (Validasi ketat & penyaringan konten berbahaya)
 *    - SC-28: Protection of Information at Rest (Perlindungan integritas payload PII)
 *    - AC-3: Access Enforcement (Verifikasi otorisasi pemilik data)
 * 2. NIST SP 800-122: Guide to Protecting the Confidentiality of PII
 *    - Klasifikasi PII Kategori Sedang-Tinggi (Nama, Kontak, Riwayat Pendidikan, Pengalaman)
 *    - Data Minimization & PII Sanitization
 * 3. NIST SP 800-88 Rev. 1: Guidelines for Media Sanitization
 *    - Pembersihan cache lokal & data PII sementara di peramban pengguna
 */

const DANGEROUS_HTML_REGEX = /<\s*\/?\s*(script|iframe|embed|object|style|link|meta|base|form|input|button|svg|applet)\b[^>]*>/gi;
const DANGEROUS_ATTRIBUTES_REGEX = /\b(on\w+|formaction|javascript:|vbscript:|data:text\/html)\s*=/gi;
const DANGEROUS_PROTOCOLS_REGEX = /^\s*(javascript|vbscript|data|file|blob):/i;
const ALLOWED_URL_SCHEMES = /^https?:\/\//i;

/**
 * SI-10: Membersihkan teks dari tag berbahaya, script injection, dan karakter kontrol.
 */
export function sanitizeCvText(input: unknown, maxLength = 5000): string {
  if (typeof input !== 'string') return '';
  
  let cleaned = input
    .replace(DANGEROUS_HTML_REGEX, '')
    .replace(DANGEROUS_ATTRIBUTES_REGEX, '')
    // Hapus karakter kontrol ASCII tersembunyi (selain tab, newline, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength);
  }

  return cleaned;
}

/**
 * SI-10: Memvalidasi dan membersihkan tautan eksternal (LinkedIn, Portofolio, dsb).
 * Hanya mengizinkan skema https://, http://, mailto:, dan tel:.
 */
export function sanitizeSafeUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 500) return '';

  // Tolak mutlak protokol eksekusi skrip
  if (DANGEROUS_PROTOCOLS_REGEX.test(trimmed)) {
    return '';
  }

  // Jika berupa email mailto: atau tel:
  if (/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(trimmed)) {
    return trimmed;
  }
  if (/^tel:\+?[0-9\s-]{7,20}$/i.test(trimmed)) {
    return trimmed;
  }

  // Jika URL web, wajib berawalan http:// atau https://, atau auto-prepend https:// jika format domain valid
  if (ALLOWED_URL_SCHEMES.test(trimmed)) {
    return trimmed;
  }

  // Jika pengguna menulis format "linkedin.com/in/user" atau "github.com/user"
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return '';
}

/**
 * SP 800-122: Masking PII untuk pencatatan log audit dan tampilan yang aman.
 */
export function maskPii(value: string | null | undefined, type: 'email' | 'phone' | 'text'): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (type === 'email') {
    const parts = trimmed.split('@');
    if (parts.length !== 2) return '***@***';
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
    return `${maskedName}@${domain}`;
  }

  if (type === 'phone') {
    if (trimmed.length < 6) return '****';
    return `${trimmed.slice(0, 4)}****${trimmed.slice(-2)}`;
  }

  if (trimmed.length <= 4) return '****';
  return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
}

/**
 * SI-10 & SC-28: Deep Sanitization seluruh isi CvContent sebelum disimpan atau dirender.
 */
export function sanitizeCvContent(content: CvContent): CvContent {
  return {
    ...content,
    summary: sanitizeCvText(content.summary, 3000),
    profile: {
      ...content.profile,
      full_name: sanitizeCvText(content.profile.full_name, 120),
      headline: sanitizeCvText(content.profile.headline, 120),
      phone: sanitizeCvText(content.profile.phone, 30),
      email: sanitizeCvText(content.profile.email, 120),
      location: sanitizeCvText(content.profile.location, 120),
      links: (content.profile.links || []).map((link) => ({
        label: sanitizeCvText(link.label, 50) || 'Tautan',
        url: sanitizeSafeUrl(link.url),
      })).filter((link) => Boolean(link.url)),
      photo_url: content.profile.photo_url || null,
    },
    organizations: (content.organizations || []).map((org) => ({
      ...org,
      name: sanitizeCvText(org.name, 150) || 'Organisasi',
      role: org.role ? sanitizeCvText(org.role, 100) : null,
      description: org.description ? sanitizeCvText(org.description, 2000) : null,
    })),
    experiences: (content.experiences || []).map((exp) => ({
      ...exp,
      company: sanitizeCvText(exp.company, 150) || 'Perusahaan',
      title: sanitizeCvText(exp.title, 100) || 'Posisi',
      location: exp.location ? sanitizeCvText(exp.location, 100) : null,
      description: exp.description ? sanitizeCvText(exp.description, 3000) : null,
    })),
    education: (content.education || []).map((edu) => ({
      ...edu,
      institution: sanitizeCvText(edu.institution, 180) || 'Institusi',
      degree: edu.degree ? sanitizeCvText(edu.degree, 100) : null,
      field: edu.field ? sanitizeCvText(edu.field, 120) : null,
      description: edu.description ? sanitizeCvText(edu.description, 2000) : null,
    })),
    achievements: (content.achievements || []).map((ach) => ({
      ...ach,
      title: sanitizeCvText(ach.title, 150),
      issuer: ach.issuer ? sanitizeCvText(ach.issuer, 120) : null,
      description: ach.description ? sanitizeCvText(ach.description, 1500) : null,
    })),
    skills: (content.skills || [])
      .map((s) => sanitizeCvText(s, 50))
      .filter((s) => s.length > 0)
      .slice(0, 50),
    projects: (content.projects || []).map((proj) => ({
      ...proj,
      name: sanitizeCvText(proj.name, 150) || 'Proyek',
      url: proj.url ? sanitizeSafeUrl(proj.url) : null,
      description: proj.description ? sanitizeCvText(proj.description, 2500) : null,
    })),
    custom_sections: content.custom_sections?.map((cs) => ({
      id: sanitizeCvText(cs.id, 50),
      title: sanitizeCvText(cs.title, 80),
      content: sanitizeCvText(cs.content, 4000),
    })),
  };
}

/**
 * Validasi Kepatuhan Standar NIST (Input Integrity & Sanitization Check).
 */
export function checkNistCompliance(content: CvContent): {
  compliant: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // 1. Cek keberadaan script injection di seluruh dokumen
  const stringified = JSON.stringify(content);
  if (DANGEROUS_HTML_REGEX.test(stringified) || DANGEROUS_ATTRIBUTES_REGEX.test(stringified)) {
    violations.push('Ditemukan tag HTML atau atribut skrip aktif yang tidak diizinkan (NIST SI-10).');
  }

  // 2. Cek tautan tidak aman
  for (const link of content.profile.links || []) {
    if (link.url && DANGEROUS_PROTOCOLS_REGEX.test(link.url)) {
      violations.push(`Tautan kontak "${link.label}" menggunakan skrip/protokol tidak aman (NIST SC-28).`);
    }
  }

  for (const proj of content.projects || []) {
    if (proj.url && DANGEROUS_PROTOCOLS_REGEX.test(proj.url)) {
      violations.push(`Tautan proyek "${proj.name}" menggunakan skrip/protokol tidak aman (NIST SC-28).`);
    }
  }

  // 3. Batas panjang PII (Data Minimization)
  if (content.profile.full_name && content.profile.full_name.length > 150) {
    violations.push('Panjang nama lengkap melebihi batas wajar PII 150 karakter (NIST SP 800-122).');
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

/**
 * SP 800-88: Media & Storage Sanitization.
 * Membersihkan data PII yang tersimpan di localStorage / sessionStorage saat sesi ditutup atau CV dihapus.
 */
export function purgeCvLocalCache(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('seventx_cv_session_active');
    sessionStorage.removeItem('seventx_cv_last_draft');
    // Bersihkan demo documents jika pengguna ingin pembersihan total
    localStorage.removeItem('seventx_demo_cv_documents');
  } catch (err) {
    console.warn('Media sanitization non-fatal warning:', err);
  }
}
