'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
  type ApiCallError,
  apiFetch,
  AuthDivider,
  Button,
  ErrorState,
  FormField,
  GoogleAuthButton,
  notifyAuthChanged,
  SITE_NAME,
  TextInput,
} from '@/components/ui';

export default function SignupPage() {
  const router = useRouter();
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

    const body: { email: string; password: string; full_name?: string } = {
      email: trimmedEmail,
      password,
    };
    if (trimmedName.length > 0) {
      body.full_name = trimmedName;
    }

    setSubmitting(true);
    const res = await apiFetch<{ user: { id: string; email: string } }>('/api/auth/signup', {
      method: 'POST',
      body,
    });
    setSubmitting(false);

    if (!res.ok) {
      setApiError(res.error);
      return;
    }

    notifyAuthChanged();
    router.push('/onboarding');
    router.refresh();
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
            required
            error={fieldErrors.email}
          >
            <TextInput
              id="signup-email"
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
            id="signup-password"
            label="Password"
            required
            hint="Gunakan 8–72 karakter"
            error={fieldErrors.password}
          >
            <TextInput
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              placeholder="Minimal 8 karakter"
              value={password}
              hasError={Boolean(fieldErrors.password)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </FormField>

          <Button type="submit" variant="primary" size="lg" loading={submitting}>
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
            Masuk di Sini →
          </Link>
        </div>
      </div>
    </div>
  );
}
