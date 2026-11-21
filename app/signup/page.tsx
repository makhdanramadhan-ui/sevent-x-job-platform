'use client';

import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { type ApiCallError, apiFetch, SITE_NAME } from '@/components/ui/api-client';
import { ErrorState, NoticeBanner } from '@/components/ui/feedback';
import { Button, FormField, PasswordInput, TextInput } from '@/components/ui/forms';
import { AuthDivider, GoogleAuthButton } from '@/components/ui/google-button';
import { PasswordPolicyChecklist } from '@/components/ui/password-policy-checklist';
import { ResendVerificationButton } from '@/components/ui/resend-verification';
import { validatePassword } from '@/lib/password-policy';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
  }>({});
  const [apiError, setApiError] = useState<ApiCallError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim();
    const errors: { fullName?: string; email?: string; password?: string } = {};

    if (trimmedName.length > 120) {
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
    } else if (!passwordValidation.ok) {
      errors.password = 'Password belum memenuhi syarat.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const body: { email: string; password: string; full_name?: string } = {
      email: trimmedEmail,
      password,
    };
    if (trimmedName.length > 0) {
      body.full_name = trimmedName;
    }

    setSubmitting(true);
    const res = await apiFetch<{ status?: string; email?: string; user?: { id: string; email: string } }>(
      '/api/auth/signup',
      {
        method: 'POST',
        body,
      },
    );
    setSubmitting(false);

    if (!res.ok) {
      if (res.error.code === 'weak_password') {
        setFieldErrors((prev) => ({ ...prev, password: res.error.message || 'Password belum memenuhi syarat.' }));
        return;
      }
      setApiError(res.error);
      return;
    }

    if (res.data?.status === 'verification_sent') {
      setPendingVerificationEmail(res.data.email ?? trimmedEmail);
      return;
    }

    // Fallback for legacy response shape during rollout.
    setPendingVerificationEmail(trimmedEmail);
  }

  if (pendingVerificationEmail) {
    return (
      <div className="container-auth">
        <div className="ledger-card">
          <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
            Cek Email Kamu
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Kami telah mengirim tautan verifikasi ke{' '}
            <strong style={{ color: 'var(--ink-primary)' }}>{pendingVerificationEmail}</strong>.
            Buka email tersebut untuk mengaktifkan akunmu.
          </p>

          <NoticeBanner variant="info" title="Belum menerima email?">
            <p style={{ margin: '0 0 8px' }}>
              Periksa folder Spam atau Promosi. Tautan verifikasi berlaku dalam waktu terbatas.
            </p>
            <ResendVerificationButton email={pendingVerificationEmail} />
          </NoticeBanner>

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
            <span style={{ color: 'var(--ink-secondary)' }}>Sudah verifikasi email?</span>
            <Link href="/login" className="btn btn-outline btn-sm">
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-auth">
      <div className="ledger-card">
        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Daftar Akun Baru
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
          Buat akun untuk mulai mencari lowongan, melengkapi profil, dan menyusun CV.
        </p>

        {apiError ? <ErrorState error={apiError} title="Pendaftaran Gagal" /> : null}

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          <FormField
            id="signup-fullname"
            label="Nama Lengkap"
            hint="Opsional saat pendaftaran, dapat dilengkapi saat Onboarding (maks. 120 karakter)"
            error={fieldErrors.fullName}
          >
            <TextInput
              id="signup-fullname"
              type="text"
              autoComplete="name"
              maxLength={120}
              placeholder="Contoh: Nadia Pratama"
              value={fullName}
              hasError={Boolean(fieldErrors.fullName)}
              onChange={(e) => setFullName(e.target.value)}
            />
          </FormField>

          <FormField
            id="signup-email"
            label="Alamat Email"
            error={fieldErrors.email}
          >
            <TextInput
              id="signup-email"
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
            id="signup-password"
            label="Password"
            error={fieldErrors.password}
          >
            <PasswordInput
              id="signup-password"
              autoComplete="new-password"
              placeholder="Minimal 8 karakter"
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
            />
            <PasswordPolicyChecklist password={password} />
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={submitting || !validatePassword(password).ok}
          >
            Buat Akun &amp; Lanjut Onboarding
          </Button>
        </form>

        <AuthDivider />
        <GoogleAuthButton label="Daftar dengan Google" next="/onboarding" />

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
          <span style={{ color: 'var(--ink-secondary)' }}>Sudah punya akun {SITE_NAME}?</span>
          <Link href="/login" className="btn btn-outline btn-sm">
            Masuk di Sini
          </Link>
        </div>
      </div>
    </div>
  );
}
