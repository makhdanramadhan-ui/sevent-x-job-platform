'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, SITE_NAME } from './api-client';
import { Button } from './forms';
import { ScrollProgressBar } from './scroll-motion';

export type SessionInfo = {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatar_url: string | null;
    avatar_source?: 'custom' | 'provider' | null;
  };
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

export function getInitials(label: string): string {
  const base = label.includes('@') ? label.split('@')[0] : label;
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0];
  return letters.toUpperCase();
}

type AvatarMenuProps = {
  user: SessionInfo['user'];
  loggingOut: boolean;
  onNavigate: () => void;
  onLogout: () => void;
};

function AvatarMenu({ user, loggingOut, onNavigate, onLogout }: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const label = user.name ?? user.email ?? 'Akun Aktif';
  const showImage = Boolean(user.avatar_url) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [user.avatar_url]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleNavigate() {
    setOpen(false);
    onNavigate();
  }

  return (
    <div className="avatar-menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="avatar-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu akun"
        title={label}
        onClick={() => setOpen((prev) => !prev)}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar_url ?? undefined}
            alt={label}
            className="avatar-image"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="avatar-initials" aria-hidden="true">
            {getInitials(label)}
          </span>
        )}
      </button>
      {open ? (
        <div className="avatar-dropdown" role="menu" aria-label="Menu akun">
          <div className="avatar-dropdown-header">
            {user.name ? <span className="avatar-dropdown-name">{user.name}</span> : null}
            <span className="avatar-dropdown-email">{user.email ?? 'Akun Aktif'}</span>
          </div>
          <Link href="/profile" role="menuitem" className="avatar-dropdown-item" onClick={handleNavigate}>
            Profil
          </Link>
          <Link href="/cv" role="menuitem" className="avatar-dropdown-item" onClick={handleNavigate}>
            Studio CV
          </Link>
          <div className="avatar-dropdown-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="avatar-dropdown-item avatar-dropdown-logout"
            disabled={loggingOut}
            onClick={onLogout}
          >
            {loggingOut ? 'Keluar...' : 'Keluar'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

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
                  <AvatarMenu
                    user={session.user}
                    loggingOut={loggingOut}
                    onNavigate={() => setMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                  {!session.has_profile ? (
                    <Link
                      href="/onboarding"
                      className="nav-onboarding-link"
                      onClick={() => setMenuOpen(false)}
                    >
                      Lengkapi profil
                    </Link>
                  ) : null}
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
                    Daftar Akun
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        <ScrollProgressBar />
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-columns-grid">
          {/* Column 1: Brand & Description */}
          <div>
            <Link href="/" className="footer-brand-row">
              <span className="footer-brand-name">{SITE_NAME}</span>
            </Link>
            <p className="footer-brand-desc">
              Membantu pencari kerja di Indonesia menemukan lowongan lintas bidang, mengecek
              kecocokan profil secara terbuka, dan menyiapkan CV sebelum melamar di situs resmi
              perusahaan.
            </p>
            <div className="footer-cta-row">
              <Link href="/signup" className="btn btn-primary btn-sm">
                Daftar Akun
              </Link>
              <Link
                href="/jobs"
                className="btn btn-outline btn-sm"
                style={{
                  background: 'transparent',
                  color: '#ffffff',
                  borderColor: 'rgba(255,255,255,0.24)',
                }}
              >
                Cari Lowongan
              </Link>
            </div>
          </div>

          {/* Column 2: Fitur */}
          <div>
            <h3 className="footer-col-title">Fitur</h3>
            <ul className="footer-col-list">
              <li>
                <Link href="/jobs">Cari Lowongan</Link>
              </li>
              <li>
                <Link href="/recommendations">Rekomendasi Profil</Link>
              </li>
              <li>
                <Link href="/bookmarks">Lowongan Tersimpan</Link>
              </li>
              <li>
                <Link href="/cv">Studio CV</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Akun */}
          <div>
            <h3 className="footer-col-title">Akun</h3>
            <ul className="footer-col-list">
              <li>
                <Link href="/profile">Profil &amp; Preferensi</Link>
              </li>
              <li>
                <Link href="/onboarding">Lengkapi Onboarding</Link>
              </li>
              <li>
                <Link href="/login">Masuk Akun</Link>
              </li>
              <li>
                <Link href="/signup">Daftar Akun Baru</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Informasi Pelamaran */}
          <div>
            <h3 className="footer-col-title">Panduan Melamar</h3>
            <p className="footer-col-note">
              Tombol melamar mengarahkan kamu langsung ke portal resmi perusahaan tanpa auto-submit.
              Periksa selalu ketentuan di sumber asli dan waspadai segala bentuk pungutan biaya.
            </p>
          </div>
        </div>

        {/* Bottom Copyright & Legal Row */}
        <div className="footer-bottom-bar">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <span>© 2026 {SITE_NAME} · Proyek Tim SEVENT X.</span>
            <span className="footer-status-pill">
              <span className="footer-status-dot" aria-hidden="true" />
              Sumber resmi terhubung
            </span>
          </div>

          <div className="footer-bottom-meta">
            <Link href="/">Beranda</Link>
            <Link href="/jobs">Lowongan</Link>
            <Link href="/recommendations">Rekomendasi</Link>
            <Link href="/cv">Studio CV</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
