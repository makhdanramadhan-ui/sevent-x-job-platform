'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import {
  type ApiCallError,
  apiFetch,
  Button,
  ErrorState,
  FormField,
  NoticeBanner,
  notifyAuthChanged,
  TextInput,
} from '@/components/ui';

type SignupResponse = {
  user: { id: string; email: string };
  requires_email_confirmation: boolean;
};

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
  const [confirmationNeeded, setConfirmationNeeded] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setApiError(null);
    setConfirmationNeeded(null);

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
    const res = await apiFetch<SignupResponse>('/api/auth/signup', {
      method: 'POST',
      body,
    });
    setSubmitting(false);

    if (!res.ok) {
      setApiError(res.error);
      return;
    }

    if (res.data.requires_email_confirmation) {
      setConfirmationNeeded(res.data.user.email);
      return;
    }

    notifyAuthChanged();
    router.push('/onboarding');
    router.refresh();
  }

  return (
    <div className="container-auth">
      <div className="ledger-card">
        <span className="page-kicker">REGISTRASI KANDIDAT · SEVENT X</span>
        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          Daftar Akun Baru
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
          Buat akun untuk mengakses agregasi lowongan Indonesia, menyusun profil kandidat, dan
          melihat pemetaan rekomendasi lowongan.
        </p>

        {confirmationNeeded ? (
          <NoticeBanner variant="success" title="Pendaftaran Berhasil — Konfirmasi Email Diperlukan">
            <p style={{ margin: '0 0 10px' }}>
              Akun untuk <strong>{confirmationNeeded}</strong> telah dibuat. Silakan periksa kotak
              masuk email Anda untuk menyelesaikan verifikasi sebelum masuk.
            </p>
            <Link href="/login" className="btn btn-primary btn-sm">
              Lanjut ke Halaman Masuk →
            </Link>
          </NoticeBanner>
        ) : null}

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
          <span style={{ color: 'var(--ink-secondary)' }}>Sudah punya akun SEVENT X?</span>
          <Link href="/login" className="btn btn-outline btn-sm">
            Masuk di Sini →
          </Link>
        </div>
      </div>
    </div>
  );
}
