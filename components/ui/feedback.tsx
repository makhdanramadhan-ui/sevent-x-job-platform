'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiCallError } from './api-client';
import { Button } from './forms';

export function LoadingState({
  title = 'Memuat data...',
  description = 'Mohon tunggu sebentar, sedang mengambil data terbaru dari server.',
  lines = 3,
}: {
  title?: string;
  description?: string;
  lines?: number;
}) {
  return (
    <div className="state-panel" role="status" aria-live="polite">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="font-mono" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
            [MEMUAT]
          </span>
          <strong>{title}</strong>
        </div>
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
  kicker = 'BELUM ADA DATA',
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
      <span className="page-kicker">{kicker}</span>
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
      {action ? <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>{action}</div> : null}
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
  const isServiceDown = error.kind === 'service_unavailable';

  const heading =
    title ??
    (isSession
      ? 'Sesi Berakhir atau Belum Masuk'
      : isCsrfOrForbidden
        ? 'Akses atau Verifikasi Keamanan (CSRF) Ditolak'
        : isInvalidRef
          ? 'Referensi Data Tidak Valid (422)'
          : isServiceDown
            ? 'Layanan Autentikasi Belum Dikonfigurasi (503)'
            : 'Permintaan Gagal Diproses');

  const fieldDetail =
    error.details && typeof error.details.field === 'string' ? error.details.field : null;

  const loginHref = loginRedirectPath
    ? `/login?next=${encodeURIComponent(loginRedirectPath)}`
    : '/login';

  return (
    <div className="state-panel state-panel-error" role="alert">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="font-mono"
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '2px 8px',
              background: 'var(--status-danger)',
              color: '#fff',
              borderRadius: 3,
            }}
          >
            HTTP {error.status || 'ERR'} · {error.code}
          </span>
          {fieldDetail ? (
            <span className="font-mono" style={{ fontSize: '0.75rem' }}>
              Field: <code>{fieldDetail}</code>
            </span>
          ) : null}
        </div>
        <h2 className="font-editorial" style={{ fontSize: '1.25rem', margin: '4px 0 0' }}>
          {heading}
        </h2>
        <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--ink-primary)' }}>
          {error.message}
        </p>
        {isCsrfOrForbidden ? (
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
            Pastikan Anda mengakses aplikasi dari domain/origin yang sama dan cookie sesi aktif.
          </p>
        ) : null}
        {isInvalidRef ? (
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
            Data yang dirujuk mungkin sudah dihapus atau ID tidak terdaftar di basis data.
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {isSession ? (
            <>
              <Link href={loginHref} className="btn btn-primary">
                Masuk ke Akun
              </Link>
              <Link href="/signup" className="btn btn-outline">
                Daftar Akun Baru
              </Link>
            </>
          ) : null}
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
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
