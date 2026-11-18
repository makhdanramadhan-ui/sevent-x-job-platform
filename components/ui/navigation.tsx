'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api-client';
import { Button } from './forms';

/**
 * Ubah konstanta di bawah ini jika tim ingin mengganti nama website sementara.
 */
export const SITE_NAME = 'KerjaLoka';
export const SITE_MONOGRAM = 'KL';
export const SITE_TAGLINE = 'Bursa & Pemetaan Kerja';

export type SessionInfo = {
  user: { id: string; email: string | null };
  auth_mode: 'cookie' | 'bearer';
  has_profile: boolean;
};

export function notifyAuthChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seventx:auth-changed'));
  }
}

const NAV_ITEMS = [
  { href: '/', label: 'Beranda', exact: true },
  { href: '/jobs', label: 'Lowongan', exact: false },
  { href: '/recommendations', label: 'Rekomendasi', exact: false },
  { href: '/bookmarks', label: 'Tersimpan', exact: false },
  { href: '/profile', label: 'Profil', exact: false },
  { href: '/cv', label: 'Studio CV', exact: false },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadSession = useCallback(async () => {
    const res = await apiFetch<SessionInfo>('/api/auth/me');
    if (res.ok) {
      setSession(res.data);
    } else {
      setSession(null);
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    loadSession();
  }, [pathname, loadSession]);

  useEffect(() => {
    const handler = () => {
      loadSession();
    };
    window.addEventListener('seventx:auth-changed', handler);
    return () => window.removeEventListener('seventx:auth-changed', handler);
  }, [loadSession]);

  async function handleLogout() {
    setLoggingOut(true);
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setSession(null);
    setLoggingOut(false);
    setMenuOpen(false);
    notifyAuthChanged();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Lewati ke konten utama
      </a>
      <header className="site-header">
        <div className="site-header-top">
          <div className="site-header-top-inner">
            <span className="font-mono site-header-top-primary">
              SDG 8: PEKERJAAN LAYAK &amp; PERTUMBUHAN EKONOMI · BURSA KERJA INDONESIA
            </span>
            <span className="font-mono site-header-top-secondary">
              Tanpa Auto-Submit · Lamaran Langsung di Sumber Asli
            </span>
          </div>
        </div>

        <div className="site-header-inner">
          <div className="site-header-bar">
            <Link href="/" className="brand-link" onClick={() => setMenuOpen(false)}>
              <span className="brand-mark" aria-hidden="true">
                {SITE_MONOGRAM}
              </span>
              <span className="brand-text-group">
                <span className="brand-title">
                  <span>{SITE_NAME}</span>
                  <span className="brand-stamp">ID</span>
                </span>
                <span className="brand-subtitle">{SITE_TAGLINE}</span>
              </span>
            </Link>

            <button
              type="button"
              className={`nav-menu-toggle ${menuOpen ? 'nav-menu-toggle-active' : ''}`}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span className="nav-menu-toggle-icon" aria-hidden="true">
                {menuOpen ? '✕' : '☰'}
              </span>
              <span>{menuOpen ? 'Tutup' : 'Menu'}</span>
            </button>
          </div>

          <div
            id="primary-navigation"
            className={`nav-collapsible ${menuOpen ? 'nav-collapsible-open' : ''}`}
          >
            <nav aria-label="Navigasi Utama" className="nav-links-wrap">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className={`nav-auth-area ${session ? 'nav-auth-area-user' : 'nav-auth-area-guest'}`}>
              {checking ? (
                <span className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
                  Memeriksa sesi...
                </span>
              ) : session ? (
                <>
                  <div className="nav-user-meta">
                    <span className="nav-user-pill" title={session.user.email ?? session.user.id}>
                      {session.user.email ?? 'Pengguna Aktif'}
                    </span>
                    {!session.has_profile ? (
                      <Link
                        href="/onboarding"
                        className="badge badge-warning"
                        style={{ textDecoration: 'none' }}
                        onClick={() => setMenuOpen(false)}
                      >
                        Isi Onboarding →
                      </Link>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    loading={loggingOut}
                    onClick={handleLogout}
                  >
                    Keluar
                  </Button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="btn btn-outline btn-sm nav-auth-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/signup"
                    className="btn btn-primary btn-sm nav-auth-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Daftar Akun
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div>
          <div className="brand-title" style={{ marginBottom: 8 }}>
            <span>{SITE_NAME} — Platform Pencarian &amp; Pemetaan Kerja</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
            Dikembangkan untuk kompetisi Software Development <strong>SEVENT X</strong> dengan
            subtema <strong>SDG 8: Decent Work and Economic Growth</strong>. Menyajikan agregasi
            lowongan lintas bidang dan tingkat pengalaman di Indonesia secara jujur dan transparan.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <Link href="/">Beranda</Link>
            <Link href="/jobs">Feed Lowongan</Link>
            <Link href="/recommendations">Rekomendasi</Link>
            <Link href="/bookmarks">Lowongan Tersimpan</Link>
            <Link href="/profile">Profil Kandidat</Link>
            <Link href="/onboarding">Onboarding Profil</Link>
          </div>
        </div>

        <div className="footer-disclaimer-box" aria-label="Batas tampilan dan transparansi sistem">
          <strong className="font-mono" style={{ fontSize: '0.76rem', textTransform: 'uppercase' }}>
            Batas Tampilan &amp; Prinsip Kejujuran Data
          </strong>
          <ul>
            <li>
              Pencantuman lowongan dari sumber eksternal bukan klaim bahwa lowongan telah
              diverifikasi aman oleh {SITE_NAME}.
            </li>
            <li>
              Tombol melamar hanya membuka halaman sumber asli di tab baru, tidak mengubah status
              lamaran menjadi terkirim dan tidak melakukan auto-submit.
            </li>
            <li>
              Skor rekomendasi adalah tingkat kecocokan atribut profil terhadap data lowongan, bukan
              peluang diterima bekerja atau jaminan lolos ATS/HR.
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
