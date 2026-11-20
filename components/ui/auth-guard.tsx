'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api-client';
import { LoadingState, NoticeBanner } from './feedback';
import { Button, FormField, TextInput } from './forms';
import { AuthDivider, GoogleAuthButton } from './google-button';
import { notifyAuthChanged, type SessionInfo } from './navigation';

export function AuthGuard({
  title = 'Masuk untuk Melanjutkan',
  children,
}: {
  title?: string;
  children: (session: SessionInfo) => ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Popup modal form state
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verify = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch<SessionInfo>('/api/auth/me');
    if (res.ok) {
      setSession(res.data);
    } else {
      setSession(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  async function handleModalSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      setFormError('Masukkan alamat email yang valid.');
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setFormError('Password harus terdiri dari 8 hingga 72 karakter.');
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
        setFormError(res.error.message);
        return;
      }

      notifyAuthChanged();
      await verify();
      setSubmitting(false);
      router.refresh();
      return;
    }

    // Signup tab
    if (trimmedName.length > 120) {
      setSubmitting(false);
      setFormError('Nama lengkap maksimal 120 karakter.');
      return;
    }

    const body: { email: string; password: string; full_name?: string } = {
      email: trimmedEmail,
      password,
    };
    if (trimmedName.length > 0) {
      body.full_name = trimmedName;
    }

    const res = await apiFetch<{ user: { id: string; email: string } }>('/api/auth/signup', {
      method: 'POST',
      body,
    });

    if (!res.ok) {
      setSubmitting(false);
      setFormError(res.error.message);
      return;
    }

    notifyAuthChanged();
    await verify();
    setSubmitting(false);
    router.refresh();
  }

  if (loading) {
    return (
      <LoadingState
        title="Memuat halaman..."
        description="Mohon tunggu sebentar."
        lines={3}
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
                <h1
                  id="auth-modal-title"
                  className="font-editorial"
                  style={{ fontSize: '1.4rem', margin: 0 }}
                >
                  {title}
                </h1>
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
                  setFormError(null);
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
                  setFormError(null);
                }}
              >
                Daftar Akun Baru
              </button>
            </div>

            {formError ? (
              <NoticeBanner
                variant="error"
                title={activeTab === 'login' ? 'Belum Berhasil Masuk' : 'Belum Berhasil Mendaftar'}
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </NoticeBanner>
            ) : null}

            <form onSubmit={handleModalSubmit} className="form-stack" noValidate>
              {activeTab === 'signup' ? (
                <FormField id="modal-fullname" label="Nama Lengkap">
                  <TextInput
                    id="modal-fullname"
                    type="text"
                    autoComplete="name"
                    maxLength={120}
                    placeholder="Contoh: Nadia Pratama"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </FormField>
              ) : null}

              <FormField id="modal-email" label="Email" required>
                <TextInput
                  id="modal-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>

              <FormField
                id="modal-password"
                label="Password"
                required
                hint="Minimal 8 karakter"
              >
                <TextInput
                  id="modal-password"
                  type="password"
                  autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormField>

              <Button type="submit" variant="primary" size="lg" loading={submitting}>
                {activeTab === 'login' ? 'Masuk Sekarang' : 'Daftar & Lanjutkan'}
              </Button>
            </form>

            <AuthDivider />
            <GoogleAuthButton
              label={activeTab === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
              next={pathname}
            />

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
