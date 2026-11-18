'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { type ApiCallError, apiFetch, SITE_NAME } from './api-client';
import { LoadingState, NoticeBanner } from './feedback';
import { Badge, Button, FormField, TextInput } from './forms';
import { notifyAuthChanged, type SessionInfo } from './navigation';

type SignupResponse = {
  user: { id: string; email: string };
  requires_email_confirmation: boolean;
};

export function AuthGuard({
  title = 'Masuk untuk Mengakses Halaman Ini',
  children,
}: {
  title?: string;
  children: (session: SessionInfo) => ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [initError, setInitError] = useState<ApiCallError | null>(null);
  const [loading, setLoading] = useState(true);

  // Popup modal form state
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const verify = useCallback(async () => {
    setLoading(true);
    setInitError(null);
    const res = await apiFetch<SessionInfo>('/api/auth/me');
    if (res.ok) {
      setSession(res.data);
    } else {
      setSession(null);
      if (res.error.status === 503) {
        setInitError(res.error);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    verify();
  }, [verify]);

  async function handleModalSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setConfirmationMsg(null);

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

    const res = await apiFetch<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body,
    });

    if (!res.ok) {
      setSubmitting(false);
      setFormError(res.error.message);
      return;
    }

    if (res.data.requires_email_confirmation) {
      setSubmitting(false);
      setConfirmationMsg(
        `Akun ${res.data.user.email} berhasil dibuat. Silakan cek email Anda untuk verifikasi sebelum masuk.`,
      );
      setActiveTab('login');
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
        title="Memverifikasi sesi autentikasi..."
        description="Memastikan sesi pengguna aktif sebelum memuat halaman."
        lines={3}
      />
    );
  }

  if (!session) {
    const loginHref = pathname ? `/login?next=${encodeURIComponent(pathname)}` : '/login';

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
        <div className="auth-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
          <div className="auth-modal-dialog">
            <div className="auth-modal-header">
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                  <Badge variant="accent">WAJIB LOGIN · {SITE_NAME.toUpperCase()}</Badge>
                </div>
                <h1
                  id="auth-modal-title"
                  className="font-editorial"
                  style={{ fontSize: '1.35rem', margin: 0 }}
                >
                  {title}
                </h1>
              </div>

              <Link
                href="/"
                className="auth-modal-close"
                aria-label="Tutup popup dan kembali ke Beranda"
                title="Kembali ke Beranda"
              >
                ✕
              </Link>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
              Silakan masuk atau daftar akun terlebih dahulu untuk mengakses fitur ini. Setelah
              masuk, halaman ini akan langsung terbuka otomatis.
            </p>

            {/* Tab Switcher: Masuk / Daftar */}
            <div className="auth-modal-tabs" role="tablist" aria-label="Pilih mode autentikasi">
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
                Masuk ke Akun
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

            {initError ? (
              <NoticeBanner variant="warning" title="Konfigurasi Server (503)">
                {initError.message} Pastikan variabel Supabase di <code>.env.local</code> sudah
                diisi.
              </NoticeBanner>
            ) : null}

            {confirmationMsg ? (
              <NoticeBanner
                variant="success"
                title="Cek Email Anda"
                onDismiss={() => setConfirmationMsg(null)}
              >
                {confirmationMsg}
              </NoticeBanner>
            ) : null}

            {formError ? (
              <NoticeBanner
                variant="error"
                title={activeTab === 'login' ? 'Gagal Masuk' : 'Gagal Mendaftar'}
                onDismiss={() => setFormError(null)}
              >
                {formError}
              </NoticeBanner>
            ) : null}

            <form onSubmit={handleModalSubmit} className="form-stack" noValidate>
              {activeTab === 'signup' ? (
                <FormField id="modal-fullname" label="Nama Lengkap (Opsional)">
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

              <FormField id="modal-email" label="Alamat Email" required>
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
                {activeTab === 'login' ? 'Masuk & Buka Halaman' : 'Daftar & Lanjutkan'}
              </Button>
            </form>

            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: '0.8rem',
              }}
            >
              <Link href="/" style={{ color: 'var(--ink-secondary)', fontWeight: 600 }}>
                ← Kembali ke Beranda
              </Link>
              <Link href={loginHref} style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                Halaman Login Penuh ↗
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(session)}</>;
}
