'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApiCallError } from './api-client';
import { ButtonText } from './button-text';
import { Button } from './forms';

export function LoadingState({
  title = 'Memuat data...',
  description = 'Mohon tunggu sebentar.',
  lines = 3,
  reserved = false,
}: {
  title?: string;
  description?: string;
  lines?: number;
  reserved?: boolean;
}) {
  return (
    <div
      className={`state-panel${reserved ? ' state-panel--reserved' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <strong style={{ fontWeight: 500 }}>{title}</strong>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--p-muted)' }}>
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
      {kicker ? <span className="page-kicker">{kicker}</span> : null}
      <h2 style={{ fontSize: '1.35rem', margin: '0 0 8px' }}>{title}</h2>
      <p
        style={{
          margin: 0,
          color: 'var(--p-muted)',
          fontSize: '0.9375rem',
          maxWidth: '58ch',
        }}
      >
        {description}
      </p>
      {action ? (
        <div style={{ marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>{action}</div>
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
  const isEmailNotConfirmed = error.kind === 'email_not_confirmed';
  const isSession = error.kind === 'session_expired';
  const isCsrfOrForbidden = error.kind === 'forbidden_or_csrf';
  const isInvalidRef = error.kind === 'invalid_reference';

  const heading =
    title ??
    (isEmailNotConfirmed
      ? 'Email Belum Diverifikasi'
      : isSession
        ? 'Sesi Kamu Telah Berakhir'
        : isCsrfOrForbidden
          ? 'Akses Tidak Dapat Dilanjutkan'
          : isInvalidRef
            ? 'Data Tidak Ditemukan'
            : 'Belum Dapat Memproses Permintaan');

  const loginHref = loginRedirectPath
    ? `/login?next=${encodeURIComponent(loginRedirectPath)}`
    : '/login';
  const verifyHref = loginRedirectPath
    ? `/login?verify=invalid&next=${encodeURIComponent(loginRedirectPath)}`
    : '/login?verify=invalid';

  return (
    <div className="state-panel state-panel-error" role="alert">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>{heading}</h2>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--p-ink)' }}>
          {isEmailNotConfirmed
            ? 'Email akunmu belum diverifikasi. Buka email verifikasi atau kirim ulang tautannya dari halaman masuk.'
            : error.message}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          {isEmailNotConfirmed ? (
            <Link href={verifyHref} className="btn btn-primary btn-sm">
              <ButtonText>Verifikasi / Kirim Ulang</ButtonText>
            </Link>
          ) : null}
          {isSession ? (
            <>
              <Link href={loginHref} className="btn btn-primary btn-sm">
                <ButtonText>Masuk ke Akun</ButtonText>
              </Link>
              <Link href="/signup" className="btn btn-outline btn-sm">
                <ButtonText>Daftar Akun Baru</ButtonText>
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

export type NoticeVariant = 'success' | 'warning' | 'error' | 'info';

const DEFAULT_POPUP_TITLES: Record<NoticeVariant, string> = {
  success: 'Berhasil',
  warning: 'Perhatian',
  error: 'Terjadi Kesalahan',
  info: 'Informasi',
};

function NoticeIcon({ variant }: { variant: NoticeVariant }) {
  if (variant === 'success') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }
  if (variant === 'warning') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  if (variant === 'error') {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function NoticePopup({
  variant = 'info',
  title,
  children,
  onDismiss,
  confirmLabel = 'Mengerti',
}: {
  variant?: NoticeVariant;
  title?: string;
  children: ReactNode;
  onDismiss: () => void;
  confirmLabel?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    confirmRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted, onDismiss]);

  if (!mounted) return null;

  const heading = title ?? DEFAULT_POPUP_TITLES[variant];

  return createPortal(
    <div
      className="notice-popup-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div
        className={`notice-popup-box notice-popup-${variant}`}
        role={variant === 'error' || variant === 'warning' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="notice-popup-top">
          <div className={`notice-popup-icon notice-popup-icon-${variant}`}>
            <NoticeIcon variant={variant} />
          </div>
          <button
            type="button"
            className="notice-popup-close"
            onClick={onDismiss}
            aria-label="Tutup pesan"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <h2 id={titleId} className="notice-popup-title">
          {heading}
        </h2>
        <div className="notice-popup-body">{children}</div>

        <div className="notice-popup-footer">
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onDismiss}
          >
            <ButtonText>{confirmLabel}</ButtonText>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function NoticeBanner({
  variant = 'info',
  title,
  children,
  onDismiss,
  display,
}: {
  variant?: NoticeVariant;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  display?: 'inline' | 'popup';
}) {
  const mode = display ?? (onDismiss ? 'popup' : 'inline');

  if (mode === 'popup' && onDismiss) {
    return (
      <NoticePopup variant={variant} title={title} onDismiss={onDismiss}>
        {children}
      </NoticePopup>
    );
  }

  return (
    <div
      className={`notice-banner notice-${variant}`}
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {title ? <strong style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{title}</strong> : null}
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
            fontWeight: 500,
            fontSize: '1.1rem',
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
