'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api-client';
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
  { href: '/jobs', label: 'Feed Lowongan', exact: false },
  { href: '/recommendations', label: 'Rekomendasi', exact: false },
  { href: '/bookmarks', label: 'Tersimpan', exact: false },
  { href: '/profile', label: 'Profil & Preferensi', exact: false },
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
            <span className="font-mono">
              SDG 8: PEKERJAAN LAYAK &amp; PERTUMBUHAN EKONOMI · BURSA KERJA INDONESIA
            </span>
            <span className="font-mono">
              Tanpa Auto-Submit · Lamaran Langsung di Sumber Asli
            </span>
          </div>
        </div>
        <div className="site-header-inner">
          <Link href="/" className="brand-link" onClick={() => setMenuOpen(false)}>
            <span className="brand-title">
              <span>SEVENT X</span>
              <span className="brand-stamp">ID</span>
            </span>
            <span className="brand-subtitle">
              Agregasi Lowongan &amp; Pemetaan Kecocokan Profil
            </span>
          </Link>

          <button
            type="button"
            className="nav-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {menuOpen ? 'TUTUP [×]' : 'MENU [≡]'}
          </button>

          <div
            id="primary-navigation"
            className={`nav-collapsible ${menuOpen ? 'nav-collapsible-open' : ''}`}
            style={{
              display: menuOpen ? undefined : undefined,
              flex: 1,
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <nav aria-label="Navigasi Utama" className="nav-links-wrap" style={{ marginLeft: 12 }}>
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

            <div className="nav-auth-area">
              {checking ? (
                <span className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  Memeriksa sesi...
                </span>
              ) : session ? (
                <>
                  {!session.has_profile ? (
                    <Link
                      href="/onboarding"
                      className="badge badge-warning"
                      style={{ textDecoration: 'none' }}
                      onClick={() => setMenuOpen(false)}
                    >
                      Profil Belum Lengkap → Isi Onboarding
                    </Link>
                  ) : null}
                  <span className="nav-user-pill" title={session.user.email ?? session.user.id}>
                    {session.user.email ?? 'Pengguna Terautentikasi'}
                  </span>
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
                    className="btn btn-outline btn-sm"
                    onClick={() => setMenuOpen(false)}
                  >
                    Masuk
                  </Link>
                  <Link
                    href="/signup"
                    className="btn btn-primary btn-sm"
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
            <span>SEVENT X — Platform Pencarian Kerja</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
            Dikembangkan oleh Tim SEVENT X untuk kompetisi Software Development dengan subtema{' '}
            <strong>SDG 8: Decent Work and Economic Growth</strong>. Menyajikan agregasi lowongan
            lintas bidang dan tingkat pengalaman di Indonesia secara jujur dan transparan.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <Link href="/">Beranda &amp; Kontrak API</Link>
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
              diverifikasi aman oleh SEVENT X.
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
