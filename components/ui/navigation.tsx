'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, SITE_NAME } from './api-client';
import { Button } from './forms';

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
        <div className="site-header-inner">
          <div className="site-header-bar">
            <Link href="/" className="brand-link" onClick={() => setMenuOpen(false)}>
              <span className="brand-title">{SITE_NAME}</span>
            </Link>

            <button
              type="button"
              className={`nav-menu-toggle ${menuOpen ? 'nav-menu-toggle-active' : ''}`}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
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
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className={`nav-auth-area ${session ? 'nav-auth-area-user' : 'nav-auth-area-guest'}`}>
              {checking ? (
                <span style={{ fontSize: '0.875rem', color: 'var(--p-muted)' }}>Memuat...</span>
              ) : session ? (
                <>
                  <div className="nav-user-meta">
                    <span className="nav-user-pill" title={session.user.email ?? session.user.id}>
                      {session.user.email ?? 'Akun Aktif'}
                    </span>
                    {!session.has_profile ? (
                      <Link
                        href="/onboarding"
                        className="nav-onboarding-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        Lengkapi profil
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
                    className="nav-signin-link nav-auth-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/signup"
                    className="btn btn-primary nav-auth-btn"
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>Daftar Akun</span>
                    <span className="btn-arrow" aria-hidden="true">
                      →
                    </span>
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
        <div className="footer-close-row">
          <div>
            <h2
              style={{
                fontSize: 'clamp(1.6rem, 2.8vw, 2.35rem)',
                margin: '0 0 8px',
                maxWidth: '22ch',
              }}
            >
              Mulai cari lowongan yang sesuai dengan profilmu.
            </h2>
            <p style={{ margin: 0, color: 'var(--p-muted)', fontSize: '1rem' }}>
              Daftar akun untuk melihat daftar lowongan, mengecek kecocokan, dan menyusun CV.
            </p>
          </div>
          <div className="footer-close-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              <span>Daftar Akun</span>
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link href="/jobs" className="btn btn-outline btn-lg">
              Lihat Lowongan
            </Link>
          </div>
        </div>

        <p className="footer-wordmark" aria-hidden="true">
          {SITE_NAME}
        </p>

        <div className="footer-bottom-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <nav aria-label="Tautan Footer" className="footer-nav-links">
              <Link href="/">Beranda</Link>
              <Link href="/jobs">Lowongan</Link>
              <Link href="/recommendations">Rekomendasi</Link>
              <Link href="/bookmarks">Tersimpan</Link>
              <Link href="/profile">Profil</Link>
              <Link href="/cv">Studio CV</Link>
            </nav>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--p-muted)' }}>
              © 2026 {SITE_NAME} · Dikembangkan oleh Tim SEVENT X.
            </p>
          </div>

          <div className="footer-disclaimer-box" aria-label="Catatan bagi pelamar kerja">
            <strong style={{ color: 'var(--p-ink)', fontWeight: 500, display: 'block', marginBottom: 4 }}>
              Informasi Pelamaran
            </strong>
            Tombol lamar di {SITE_NAME} membuka halaman rekrutmen resmi penyelenggara secara
            langsung tanpa auto-submit. Periksa selalu ketentuan lowongan pada situs asli dan
            waspadai pungutan biaya dalam bentuk apa pun.
          </div>
        </div>
      </div>
    </footer>
  );
}
