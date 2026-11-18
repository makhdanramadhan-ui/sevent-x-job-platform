'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import {
  type ApiCallError,
  apiFetch,
  Button,
  ErrorState,
  FormField,
  LoadingState,
  NoticeBanner,
  notifyAuthChanged,
  SITE_NAME,
  type SessionInfo,
  TextInput,
} from '@/components/ui';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/jobs';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<ApiCallError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);

    const trimmedEmail = email.trim();
    const errors: { email?: string; password?: string } = {};

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      errors.email = 'Masukkan alamat email yang valid.';
    }
    if (password.length < 8 || password.length > 72) {
      errors.password = 'Password harus terdiri dari 8 hingga 72 karakter.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<{ user: { id: string; email: string } }>('/api/auth/login', {
      method: 'POST',
      body: {
        email: trimmedEmail,
        password,
      },
    });

    if (!res.ok) {
      setSubmitting(false);
      setApiError(res.error);
      return;
    }

    notifyAuthChanged();

    // Check if user already has a profile
    const meRes = await apiFetch<SessionInfo>('/api/auth/me');
    setSubmitting(false);

    if (meRes.ok && !meRes.data.has_profile) {
      router.push('/onboarding');
    } else {
      router.push(safeNext);
    }
    router.refresh();
  }

  return (
    <div className="container-auth">
      <div className="ledger-card">
        <span className="page-kicker">AUTENTIKASI SESI · {SITE_NAME.toUpperCase()}</span>
        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Masuk ke Akun Anda
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
          Pengguna wajib masuk untuk membuka feed lowongan, melihat rekomendasi profil, menyimpan
          bookmark, dan mengelola CV.
        </p>

        {nextParam ? (
          <NoticeBanner variant="info" title="Akses Halaman Terproteksi">
            Setelah berhasil masuk, Anda akan diarahkan ke <code>{safeNext}</code>.
          </NoticeBanner>
        ) : null}

        {apiError ? <ErrorState error={apiError} title="Gagal Masuk" /> : null}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <FormField
            id="login-email"
            label="Alamat Email"
            required
            error={fieldErrors.email}
          >
            <TextInput
              id="login-email"
              type="email"
              autoComplete="email"
              required
              placeholder="nama@email.com"
              value={email}
              hasError={Boolean(fieldErrors.email)}
              onChange={(e) => setEmail(e.target.value)}
            />
          </FormField>

          <FormField
            id="login-password"
            label="Password"
            required
            hint="Minimal 8 karakter"
            error={fieldErrors.password}
          >
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" loading={submitting}>
            Masuk Sekarang
          </Button>
        </form>

        <div
          style={{
            marginTop: 22,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <span style={{ color: 'var(--ink-secondary)' }}>Belum memiliki akun {SITE_NAME}?</span>
          <Link href="/signup" className="btn btn-outline btn-sm">
            Daftar Akun Baru →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState title="Memuat formulir login..." lines={2} />}>
      <LoginFormContent />
    </Suspense>
  );
}
