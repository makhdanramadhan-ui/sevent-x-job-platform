import companyLogosData from './company-logos.json';

const COMPANY_LOGOS: Record<string, string> = companyLogosData as Record<string, string>;

/**
 * Mengembalikan URL logo perusahaan hasil scraping berdasarkan nama perusahaan.
 * Mengembalikan null apabila belum tersedia agar UI dapat fallback ke inisial huruf.
 */
export function getCompanyLogoUrl(company: string | null | undefined): string | null {
  if (!company) return null;
  const key = company.trim().toLowerCase();
  if (!key) return null;
  return COMPANY_LOGOS[key] ?? null;
}
