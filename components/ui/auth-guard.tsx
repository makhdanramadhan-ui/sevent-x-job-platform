'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api-client';
import { LoadingState, NoticeBanner } from './feedback';
import { Button, FormField, PasswordInput, TextInput } from './forms';
import { AuthDivider, GoogleAuthButton } from './google-button';
import {
  fetchSessionIfCookie,
  hasAuthSessionCookie,
  notifyAuthChanged,
  type SessionInfo,
} from './navigation';
import { PasswordPolicyChecklist } from './password-policy-checklist';
import { ResendVerificationButton } from './resend-verification';
import { validatePassword } from '@/lib/password-policy';

export function AuthGuard({
  title = 'Masuk untuk Melanjutkan',
  headingAs = 'h2',
  children,
}: {
  title?: string;
  headingAs?: 'h1' | 'h2';
  children: (session: SessionInfo) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const ModalHeading = headingAs;

  // Popup modal form state
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);

  const verify = useCallback(async (forceRefresh = false) => {
    if (!hasAuthSessionCookie()) {
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await fetchSessionIfCookie(forceRefresh);
    setSession(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  async function handleModalSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setEmailNotConfirmed(false);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const errors: { fullName?: string; email?: string; password?: string } = {};

    if (activeTab === 'signup' && trimmedName.length > 120) {
      errors.fullName = 'Nama lengkap maksimal 120 karakter.';
    }
    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      errors.email = 'Masukkan alamat email yang valid.';
    }
    const passwordValidation = validatePassword(password);
    if (!password) {
      errors.password = 'Password wajib diisi.';
    } else if (password.length > 72) {
      errors.password = 'Password maksimal 72 karakter.';
    } else if (activeTab === 'signup' && !passwordValidation.ok) {
      errors.password = 'Password belum memenuhi syarat.';
    } else if (activeTab === 'login' && (password.length < 8 || password.length > 72)) {
      errors.password = 'Password harus terdiri dari 8 hingga 72 karakter.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    if (activeTab === 'login') {
      const res = await apiFetch<{ user: { id: string; email: string } }>('/api/auth/login', {
        method: 'POST',
        body: { email: trimmedEmail, password },
      });

      if (!res.ok) {
        setSubmitting(false);
        if (res.error.status === 403 && res.error.code === 'email_not_confirmed') {
          setEmailNotConfirmed(true);
          return;
        }
        setFormError(res.error.message);
        return;
      }

      notifyAuthChanged();
      await verify(true);
      setSubmitting(false);
      router.refresh();
      return;
    }

    // Signup tab
    const body: { email: string; password: string; full_name?: string } = {
      email: trimmedEmail,
      password,
    };
    if (trimmedName.length > 0) {
      body.full_name = trimmedName;
    }

    const res = await apiFetch<{
      status?: string;
      email?: string;
      user?: { id: string; email: string };
    }>('/api/auth/signup', {
      method: 'POST',
      body,
    });

    setSubmitting(false);

    if (!res.ok) {
      if (res.error.code === 'weak_password') {
        setFieldErrors((prev) => ({ ...prev, password: res.error.message || 'Password belum memenuhi syarat.' }));
        return;
      }
      setFormError(res.error.message);
      return;
    }

    if (res.data?.status === 'verification_sent') {
      setPendingVerificationEmail(res.data.email ?? trimmedEmail);
      setPassword('');
      return;
    }

    // Fallback for legacy response shape during rollout.
    setPendingVerificationEmail(trimmedEmail);
    setPassword('');
  }

  if (loading) {
    return (
      <LoadingState
        title="Memuat halaman..."
        description="Mohon tunggu sebentar."
        lines={3}
        reserved
      />
    );
  }

  if (!session) {
    return (
      <div className="auth-locked-preview">
        {/* Blurred decorative placeholder behind popup */}
        <div className="auth-locked-skeleton-bg" aria-hidden="true">
          <div className="ledger-card">
            <div className="skeleton-line" style={{ width: '35%', marginBottom: 12 }} />
            <div className="skeleton-line" style={{ width: '70%', height: 24, marginBottom: 10 }} />
            <div className="skeleton-line" style={{ width: '55%' }} />
          </div>
          <div className="form-grid-2">
            <div className="surface-card">
              <div className="skeleton-line" style={{ width: '50%', marginBottom: 10 }} />
              <div className="skeleton-line" style={{ width: '90%', marginBottom: 8 }} />
              <div className="skeleton-line" style={{ width: '75%' }} />
            </div>
            <div className="surface-card">
              <div className="skeleton-line" style={{ width: '45%', marginBottom: 10 }} />
              <div className="skeleton-line" style={{ width: '85%', marginBottom: 8 }} />
              <div className="skeleton-line" style={{ width: '65%' }} />
            </div>
          </div>
        </div>

        {/* Popup Modal Dialog */}
        <div
          className="auth-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <div className="auth-modal-dialog">
            <div className="auth-modal-header">
              <div>
                <ModalHeading
                  id="auth-modal-title"
                  className="font-editorial"
                  style={{ fontSize: '1.4rem', margin: 0 }}
                >
                  {title}
                </ModalHeading>
              </div>

              <Link
                href="/"
                className="auth-modal-close"
                aria-label="Tutup dan kembali ke Beranda"
                title="Kembali ke Beranda"
              >
                ✕
              </Link>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Masuk ke akunmu atau daftar gratis untuk melihat daftar lowongan, rekomendasi yang
              cocok dengan profilmu, serta menyimpan lowongan pilihan.
            </p>

            {/* Tab Switcher: Masuk / Daftar */}
            <div className="auth-modal-tabs" role="tablist" aria-label="Pilih masuk atau daftar">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'login'}
                className={`auth-modal-tab ${activeTab === 'login' ? 'auth-modal-tab-active' : ''}`}
                onClick={() => {
                  setActiveTab('login');
                  setFieldErrors({});
                  setFormError(null);
                  setEmailNotConfirmed(false);
                }}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'signup'}
                className={`auth-modal-tab ${activeTab === 'signup' ? 'auth-modal-tab-active' : ''}`}
                onClick={() => {
                  setActiveTab('signup');
                  setFieldErrors({});
                  setFormError(null);
                  setEmailNotConfirmed(false);
                }}
              >
                Daftar Akun Baru
              </button>
            </div>

            {pendingVerificationEmail && activeTab === 'signup' ? (
              <NoticeBanner variant="info" title="Cek email kamu">
                <p style={{ margin: '0 0 8px' }}>
                  Kami telah mengirim tautan verifikasi ke{' '}
                  <strong style={{ color: 'var(--ink-primary)' }}>{pendingVerificationEmail}</strong>.
                  Buka email tersebut untuk mengaktifkan akunmu.
                </p>
                <p style={{ margin: '0 0 8px' }}>
                  Periksa folder Spam atau Promosi. Tautan verifikasi berlaku dalam waktu terbatas.
                </p>
                <ResendVerificationButton email={pendingVerificationEmail} />
              </NoticeBanner>
            ) : null}

            {emailNotConfirmed && activeTab === 'login' ? (
              <NoticeBanner variant="warning" title="Email belum diverifikasi">
                <p style={{ margin: '0 0 8px' }}>
                  Verifikasi emailmu terlebih dahulu sebelum masuk.
                </p>
                <ResendVerificationButton email={email} disabled={!email.trim()} />
              </NoticeBanner>
            ) : null}

            {formError ? (
              <NoticeBanner
                variant="error"
                title={activeTab === 'login' ? 'Belum Berhasil Masuk' : 'Belum Berhasil Mendaftar'}
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </NoticeBanner>
            ) : null}

            {!(pendingVerificationEmail && activeTab === 'signup') ? (
            <form onSubmit={handleModalSubmit} className="form-stack" noValidate>
              {activeTab === 'signup' ? (
                <FormField id="modal-fullname" label="Nama Lengkap" error={fieldErrors.fullName}>
                  <TextInput
                    id="modal-fullname"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Contoh: Nadia Pratama"
                    value={fullName}
                    hasError={Boolean(fieldErrors.fullName)}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (fieldErrors.fullName) {
                        setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                      }
                    }}
                  />
                </FormField>
              ) : null}

              <FormField id="modal-email" label="Email" error={fieldErrors.email}>
                <TextInput
                  id="modal-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@email.com"
                  value={email}
                  hasError={Boolean(fieldErrors.email)}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldErrors.email) {
                      setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                />
              </FormField>

              <FormField
                id="modal-password"
                label="Password"
                hint={activeTab === 'login' ? 'Minimal 8 karakter' : undefined}
                error={fieldErrors.password}
              >
                <PasswordInput
                  id="modal-password"
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  hasError={Boolean(fieldErrors.password)}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                />
                {activeTab === 'login' ? (
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <Link
                      href={
                        email.trim()
                          ? `/forgot-password?email=${encodeURIComponent(email.trim())}`
                          : '/forgot-password'
                      }
                      style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-secondary)' }}
                    >
                      Lupa password?
                    </Link>
                  </div>
                ) : (
                  <PasswordPolicyChecklist password={password} />
                )}
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={submitting || (activeTab === 'signup' && !validatePassword(password).ok)}
              >
                {activeTab === 'login' ? 'Masuk Sekarang' : 'Daftar & Lanjutkan'}
              </Button>
            </form>
            ) : null}

            {!(pendingVerificationEmail && activeTab === 'signup') ? (
              <>
                <AuthDivider />
                <GoogleAuthButton
                  label={activeTab === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
                  next={pathname}
                />
              </>
            ) : (
              <div style={{ marginTop: 12 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPendingVerificationEmail(null);
                    setActiveTab('login');
                    setFormError(null);
                    setFieldErrors({});
                  }}
                >
                  Sudah verifikasi? Masuk
                </Button>
              </div>
            )}

            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'center',
                fontSize: '0.82rem',
              }}
            >
              <Link href="/" style={{ color: 'var(--ink-secondary)', fontWeight: 600 }}>
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(session)}</>;
}
