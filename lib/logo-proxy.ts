/**
 * Logo perusahaan hasil scraping dimuat lewat route `/api/logo` di domain
 * kita sendiri, supaya browser pengunjung tidak menghubungi situs pihak ketiga
 * secara langsung (mencegah cookie pihak ketiga yang menurunkan skor
 * Lighthouse Best Practices).
 */
export const LOGO_PROXY_PATH = '/api/logo';

export function proxiedLogoSrc(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return url;
    return `${LOGO_PROXY_PATH}?url=${encodeURIComponent(parsed.toString())}`;
  } catch {
    return url;
  }
}
