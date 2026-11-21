'use client';

import Link from 'next/link';
import { BrandMark } from './brand-mark';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, SITE_NAME } from './api-client';
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

const SESSION_CACHE_TTL_MS = 15_000;
let inflightSessionPromise: Promise<SessionInfo | null> | null = null;
let cachedSession: { value: SessionInfo | null; expiresAt: number } | null = null;

export function hasAuthSessionCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((entry) => {
    const name = entry.trim().split('=')[0] ?? '';
    return name.startsWith('sb-') && name.includes('auth-token');
  });
}

export async function fetchSessionIfCookie(forceRefresh = false): Promise<SessionInfo | null> {
  if (!hasAuthSessionCookie()) {
    cachedSession = null;
    return null;
  }
  if (!forceRefresh && cachedSession && Date.now() < cachedSession.expiresAt) {
    return cachedSession.value;
  }
  if (!inflightSessionPromise || forceRefresh) {
    inflightSessionPromise = apiFetch<SessionInfo>('/api/auth/me')
      .then((res) => {
        const value = res.ok ? res.data : null;
        cachedSession = { value, expiresAt: Date.now() + SESSION_CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inflightSessionPromise = null;
      });
  }
  return inflightSessionPromise;
}

export function notifyAuthChanged(): void {
  inflightSessionPromise = null;
  cachedSession = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seventx:auth-changed'));
  }
}

export function useAuthSession() {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    if (!hasAuthSessionCookie()) {
      setSession(null);
      setLoading(false);
      return;
    }
    const nextSession = await fetchSessionIfCookie();
    setSession(nextSession);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSession();
  }, [pathname, loadSession]);

  useEffect(() => {
    const handler = () => {
      void loadSession();
    };
    window.addEventListener('seventx:auth-changed', handler);
    return () => window.removeEventListener('seventx:auth-changed', handler);
  }, [loadSession]);

  return { session, loading };
}

const NAV_ITEMS = [
  { href: '/', label: 'Beranda', exact: true },
  { href: '/jobs', label: 'Lowongan', exact: false },
  { href: '/recommendations', label: 'Rekomendasi', exact: false },
  { href: '/bookmarks', label: 'Tersimpan', exact: false },
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
          <span className="avatar-circle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.avatar_url ?? undefined}
              alt={label}
              width={32}
              height={32}
              decoding="async"
              className="avatar-image"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          </span>
        ) : (
          <span className="avatar-circle">
            <span className="avatar-initials" aria-hidden="true">
              {getInitials(label)}
            </span>
          </span>
        )}
        <svg
          className="avatar-chevron"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div className="avatar-dropdown" role="menu" aria-label="Menu akun">
          <div className="avatar-dropdown-header">
            {user.name && user.name !== user.email ? (
              <span className="avatar-dropdown-name">{user.name}</span>
            ) : null}
            <span className="avatar-dropdown-email">{user.email ?? 'Akun Aktif'}</span>
          </div>
          <Link href="/profile" role="menuitem" className="avatar-dropdown-item" onClick={handleNavigate}>
            Profil
          </Link>
          <Link href="/cv" prefetch={false} role="menuitem" className="avatar-dropdown-item" onClick={handleNavigate}>
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
  const [loggingOut, setLoggingOut] = useState(false);
  const { session, loading } = useAuthSession();

  async function executeLogout() {
    setLoggingOut(true);
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setLoggingOut(false);
    setMenuOpen(false);
    notifyAuthChanged();
    router.push('/login');
    router.refresh();
  }

  async function handleLogout() {
    const guardEvent = new CustomEvent<{ proceed: () => void }>('seventx:before-logout', {
      cancelable: true,
      detail: {
        proceed: () => {
          void executeLogout();
        },
      },
    });
    if (!window.dispatchEvent(guardEvent)) {
      return;
    }
    await executeLogout();
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
              <BrandMark size={30} className="brand-mark" />
              <span className="brand-title">{SITE_NAME}</span>
            </Link>

            <div className="site-header-mobile-actions">
              {session ? (
                <div className="nav-mobile-avatar">
                  <AvatarMenu
                    user={session.user}
                    loggingOut={loggingOut}
                    onNavigate={() => setMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                </div>
              ) : null}

              <button
                type="button"
                className={`nav-menu-toggle ${menuOpen ? 'nav-menu-toggle-active' : ''}`}
                aria-expanded={menuOpen}
                aria-controls="primary-navigation"
                aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                <svg
                  className="nav-menu-icon"
                  width={18}
                  height={18}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12L20 12" className="nav-menu-line nav-menu-line-top" />
                  <path d="M4 12H20" className="nav-menu-line nav-menu-line-mid" />
                  <path d="M4 12H20" className="nav-menu-line nav-menu-line-bot" />
                </svg>
              </button>
            </div>
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
                    prefetch={item.href === '/cv' ? false : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div
              className={`nav-auth-area ${
                session
                  ? session.has_profile
                    ? 'nav-auth-area-user nav-auth-area-user-only'
                    : 'nav-auth-area-user'
                  : 'nav-auth-area-guest'
              }`}
            >
              {loading ? (
                <span className="nav-auth-placeholder" aria-hidden="true" />
              ) : session ? (
                <>
                  <div className="nav-desktop-avatar">
                    <AvatarMenu
                      user={session.user}
                      loggingOut={loggingOut}
                      onNavigate={() => setMenuOpen(false)}
                      onLogout={handleLogout}
                    />
                  </div>
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
  const { session, loading } = useAuthSession();
  const isLoggedIn = session !== null;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-columns-grid">
          {/* Column 1: Brand & Description */}
          <div>
            <Link href="/" className="footer-brand-row">
              <BrandMark size={30} className="brand-mark" />
              <span className="footer-brand-name">{SITE_NAME}</span>
            </Link>
            <p className="footer-brand-desc">
              Membantu pencari kerja di Indonesia menemukan lowongan lintas bidang, mengecek
              kecocokan profil secara terbuka, dan menyiapkan CV sebelum melamar di situs resmi
              perusahaan.
            </p>
            <div className="footer-cta-row">
              {loading ? (
                <span className="btn btn-primary btn-sm auth-cta-placeholder" aria-hidden="true" />
              ) : session ? null : (
                <Link href="/signup" className="btn btn-primary btn-sm">
                  Daftar Akun
                </Link>
              )}
              <Link
                href="/jobs"
                className={isLoggedIn ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                style={
                  isLoggedIn
                    ? undefined
                    : {
                        background: 'transparent',
                        color: '#ffffff',
                        borderColor: 'rgba(255,255,255,0.24)',
                      }
                }
              >
                Cari Lowongan
              </Link>
            </div>
          </div>

          {/* Column 2: Fitur */}
          <div>
            <h2 className="footer-col-title">Fitur</h2>
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
                <Link href="/cv" prefetch={false}>Studio CV</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Akun */}
          <div>
            <h2 className="footer-col-title">Akun</h2>
            <ul className="footer-col-list">
              <li>
                <Link href="/profile">Profil &amp; Preferensi</Link>
              </li>
              <li>
                <Link href="/onboarding">Lengkapi Onboarding</Link>
              </li>
              {loading ? (
                <>
                  <li><span className="auth-link-placeholder" aria-hidden="true" /></li>
                  <li><span className="auth-link-placeholder" aria-hidden="true" /></li>
                </>
              ) : session ? null : (
                <>
                  <li>
                    <Link href="/login">Masuk Akun</Link>
                  </li>
                  <li>
                    <Link href="/signup">Daftar Akun Baru</Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Column 4: Informasi Pelamaran */}
          <div>
            <h2 className="footer-col-title">Panduan Melamar</h2>
            <p className="footer-col-note">
              Tombol melamar mengarahkan kamu langsung ke portal resmi perusahaan tanpa auto-submit.
              Periksa selalu ketentuan di sumber asli dan waspadai segala bentuk pungutan biaya.
            </p>
          </div>
        </div>

        {/* Bottom Copyright & Legal Row */}
        <div className="footer-bottom-bar">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
            <span>© 2026 {SITE_NAME} · Proyek Tim cepetsubmitjurnalbentarlagimagang.</span>
            <span className="footer-status-pill">
              <span className="footer-status-dot" aria-hidden="true" />
              Sumber resmi terhubung
            </span>
          </div>

          <div className="footer-bottom-meta">
            <Link href="/">Beranda</Link>
            <Link href="/jobs">Lowongan</Link>
            <Link href="/recommendations">Rekomendasi</Link>
            <Link href="/cv" prefetch={false}>Studio CV</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
