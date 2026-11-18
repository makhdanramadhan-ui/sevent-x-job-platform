'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { type ApiCallError, apiFetch, SITE_NAME } from './api-client';
import { ErrorState, LoadingState } from './feedback';
import type { SessionInfo } from './navigation';

export function AuthGuard({
  title = 'Area Terproteksi — Wajib Masuk',
  children,
}: {
  title?: string;
  children: (session: SessionInfo) => ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<SessionInfo>('/api/auth/me');
    if (res.ok) {
      setSession(res.data);
    } else {
      setSession(null);
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  if (loading) {
    return (
      <LoadingState
        title="Memverifikasi sesi autentikasi..."
        description="Memastikan sesi pengguna aktif sebelum memuat halaman."
        lines={3}
      />
    );
  }

  if (error || !session) {
    const loginHref = pathname ? `/login?next=${encodeURIComponent(pathname)}` : '/login';
    return (
      <div className="container-narrow">
        <div className="ledger-card" style={{ marginBottom: 18 }}>
          <span className="page-kicker">AKSES TERBATAS · AUTENTIKASI WAJIB</span>
          <h1 className="page-title" style={{ fontSize: '1.65rem' }}>
            {title}
          </h1>
          <p style={{ margin: '0 0 16px', color: 'var(--ink-secondary)' }}>
            Sesuai kebijakan platform {SITE_NAME}, pengguna wajib masuk menggunakan akun
            terautentikasi untuk melihat daftar lowongan, rekomendasi, bookmark, maupun mengelola
            profil dan CV.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href={loginHref} className="btn btn-primary">
              Masuk Sekarang
            </Link>
            <Link href="/signup" className="btn btn-outline">
              Buat Akun Baru
            </Link>
          </div>
        </div>
        {error ? (
          <ErrorState
            error={error}
            title="Detail Status Sesi"
            onRetry={verify}
            loginRedirectPath={pathname || '/jobs'}
          />
        ) : null}
      </div>
    );
  }

  return <>{children(session)}</>;
}
