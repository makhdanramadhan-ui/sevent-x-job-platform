'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiCallError } from './api-client';
import { Button } from './forms';
import { EmptyArchiveIllustration } from './illustrations';

export function LoadingState({
  title = 'Memuat data...',
  description = 'Mohon tunggu sebentar.',
  lines = 3,
}: {
  title?: string;
  description?: string;
  lines?: number;
}) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong>{title}</strong>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
          {description}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {Array.from({ length: lines }).map((_, idx) => (
            <div
              key={idx}
              className="skeleton-line"
              style={{ width: idx === lines - 1 ? '65%' : '100%' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="state-panel state-panel-empty">
      <EmptyArchiveIllustration />
      {kicker ? <span className="page-kicker">{kicker}</span> : null}
      <h2 className="font-editorial" style={{ fontSize: '1.3rem', margin: '0 0 8px' }}>
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: 'var(--ink-secondary)',
          fontSize: '0.92rem',
          maxWidth: '64ch',
        }}
      >
        {description}
      </p>
      {action ? (
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>{action}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  error,
  title,
  onRetry,
  loginRedirectPath,
}: {
  error: ApiCallError;
  title?: string;
  onRetry?: () => void;
  loginRedirectPath?: string;
}) {
  const isSession = error.kind === 'session_expired';
  const isCsrfOrForbidden = error.kind === 'forbidden_or_csrf';
  const isInvalidRef = error.kind === 'invalid_reference';

  const heading =
    title ??
    (isSession
      ? 'Sesi Kamu Telah Berakhir'
      : isCsrfOrForbidden
        ? 'Akses Tidak Dapat Dilanjutkan'
        : isInvalidRef
          ? 'Data Tidak Ditemukan'
          : 'Belum Dapat Memproses Permintaan');

  const loginHref = loginRedirectPath
    ? `/login?next=${encodeURIComponent(loginRedirectPath)}`
    : '/login';

  return (
    <div className="state-panel state-panel-error" role="alert">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="font-editorial" style={{ fontSize: '1.2rem', margin: 0 }}>
          {heading}
        </h2>
        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-primary)' }}>
          {error.message}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {isSession ? (
            <>
              <Link href={loginHref} className="btn btn-primary btn-sm">
                Masuk ke Akun
              </Link>
              <Link href="/signup" className="btn btn-outline btn-sm">
                Daftar Akun Baru
              </Link>
            </>
          ) : null}
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              Coba Lagi
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NoticeBanner({
  variant = 'info',
  title,
  children,
  onDismiss,
}: {
  variant?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`notice-banner notice-${variant}`}
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {title ? <strong style={{ fontSize: '0.9rem' }}>{title}</strong> : null}
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup pemberitahuan"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '1.05rem',
            color: 'inherit',
            padding: '0 4px',
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
