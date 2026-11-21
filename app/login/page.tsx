'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { type ApiCallError, apiFetch, SITE_NAME } from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import { ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button, FormField, PasswordInput, TextInput } from '@/components/ui/forms';
import { AuthDivider, GoogleAuthButton } from '@/components/ui/google-button';
import { notifyAuthChanged, type SessionInfo } from '@/components/ui/navigation';
import { ResendVerificationButton } from '@/components/ui/resend-verification';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth: 'Proses masuk dengan Google tidak selesai. Silakan coba lagi.',
  google_unavailable:
    'Masuk dengan Google belum tersedia saat ini. Silakan masuk dengan email dan password.',
};

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get('next');
  const safeNext =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/jobs';
  const oauthMessage = OAUTH_ERROR_MESSAGES[searchParams.get('error') ?? ''] ?? null;
  const verifyInvalid = searchParams.get('verify') === 'invalid';
  const resetSuccess = searchParams.get('reset') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<ApiCallError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailNotConfirmed, setEmailNotConfirmed] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);
    setEmailNotConfirmed(false);

    const trimmedEmail = email.trim();
    const errors: { email?: string; password?: string } = {};

    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
      errors.email = 'Masukkan alamat email yang valid.';
    }
    if (!password) {
      errors.password = 'Password wajib diisi.';
    } else if (password.length < 8 || password.length > 72) {
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
      if (res.error.status === 403 && res.error.code === 'email_not_confirmed') {
        setEmailNotConfirmed(true);
        return;
      }
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
        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Masuk ke Akunmu
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
          Masuk untuk melihat daftar lowongan, mengecek rekomendasi yang sesuai dengan profilmu,
          dan mengelola CV.
        </p>

        {oauthMessage ? (
          <NoticeBanner variant="error" title="Belum Berhasil Masuk dengan Google">
            {oauthMessage}
          </NoticeBanner>
        ) : null}

        {resetSuccess ? (
          <NoticeBanner variant="success" title="Password Berhasil Diubah">
            Password berhasil diubah, silakan masuk.
          </NoticeBanner>
        ) : null}

        {verifyInvalid ? (
          <NoticeBanner variant="warning" title="Link verifikasi tidak valid atau kedaluwarsa">
            <p style={{ margin: '0 0 8px' }}>
              Minta tautan verifikasi baru untuk email yang kamu daftarkan.
            </p>
            <ResendVerificationButton email={email} disabled={!email.trim()} />
          </NoticeBanner>
        ) : null}

        {emailNotConfirmed ? (
          <NoticeBanner variant="warning" title="Email belum diverifikasi">
            <p style={{ margin: '0 0 8px' }}>
              Verifikasi emailmu terlebih dahulu sebelum masuk.
            </p>
            <ResendVerificationButton email={email} disabled={!email.trim()} />
          </NoticeBanner>
        ) : null}

        {apiError ? <ErrorState error={apiError} title="Belum Berhasil Masuk" /> : null}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <FormField
            id="login-email"
            label="Alamat Email"
            error={fieldErrors.email}
          >
            <TextInput
              id="login-email"
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
            id="login-password"
            label="Password"
            error={fieldErrors.password}
          >
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
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
          </FormField>

          <Button type="submit" variant="primary" size="lg" loading={submitting}>
            Masuk Sekarang
          </Button>
        </form>

        <AuthDivider />
        <GoogleAuthButton label="Masuk dengan Google" next={safeNext} />

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
            <ButtonText>Daftar Akun Baru</ButtonText>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="container-auth">
          <LoadingState title="Memuat formulir login..." lines={3} reserved />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
