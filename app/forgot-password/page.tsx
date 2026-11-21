'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { apiFetch } from '@/components/ui/api-client';
import { LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button, FormField, PasswordInput, TextInput } from '@/components/ui/forms';
import { PasswordPolicyChecklist } from '@/components/ui/password-policy-checklist';
import { validatePassword } from '@/lib/password-policy';

const COOLDOWN_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ForgotPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') ?? '';

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; code?: string; password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setRateLimited(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldErrors({ email: 'Email wajib diisi.' });
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setFieldErrors({ email: 'Masukkan alamat email yang valid.' });
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<{ status: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: trimmed },
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.error.status === 429 || res.error.code === 'rate_limited') {
        setRateLimited(true);
        return;
      }
      setFormError(res.error.message);
      return;
    }

    setEmail(trimmed);
    setSent(true);
    setCooldown(COOLDOWN_SECONDS);
    setStep(2);
  }

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setRateLimited(false);
    const errors: { code?: string; password?: string; confirmPassword?: string } = {};

    if (!/^\d{8}$/.test(code)) {
      errors.code = 'Masukkan kode 8 digit.';
    }
    const validation = validatePassword(password);
    if (!validation.ok) {
      errors.password = 'Password belum memenuhi syarat.';
    } else if (password.length > 72) {
      errors.password = 'Password maksimal 72 karakter.';
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Password dan konfirmasi tidak sama.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<{ status: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: { email: email.trim(), code: code.trim(), password },
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.error.code === 'invalid_code') {
        setFieldErrors({ code: res.error.message || 'Kode salah atau kedaluwarsa.' });
        return;
      }
      if (res.error.code === 'weak_password') {
        setFieldErrors({ password: res.error.message || 'Password belum memenuhi syarat.' });
        return;
      }
      if (res.error.status === 429 || res.error.code === 'too_many_attempts' || res.error.code === 'rate_limited') {
        setRateLimited(true);
        return;
      }
      setFormError(res.error.message);
      return;
    }

    router.push('/login?reset=1');
  }

  async function handleResend() {
    if (submitting || cooldown > 0) return;
    setFormError(null);
    setRateLimited(false);
    setSubmitting(true);
    const res = await apiFetch<{ status: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.trim() },
    });
    setSubmitting(false);
    if (!res.ok) {
      if (res.error.status === 429 || res.error.code === 'rate_limited') {
        setRateLimited(true);
        return;
      }
      setFormError(res.error.message);
      return;
    }
    setSent(true);
    setCooldown(COOLDOWN_SECONDS);
  }

  return (
    <div className="container-auth">
      <div className="ledger-card">
        <h1 className="page-title" style={{ fontSize: '1.75rem', marginBottom: 8 }}>
          {step === 1 ? 'Lupa Password' : 'Atur Ulang Password'}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
          {step === 1
            ? 'Masukkan email akunmu. Jika email terdaftar, kami akan mengirim kode 8 digit untuk mengatur ulang password.'
            : 'Masukkan kode dari email, lalu buat password baru yang memenuhi syarat.'}
        </p>

        {rateLimited ? (
          <NoticeBanner variant="error" title="Terlalu sering">
            Terlalu sering, coba lagi nanti.
          </NoticeBanner>
        ) : null}

        {formError ? (
          <NoticeBanner variant="error" title="Permintaan Gagal">
            {formError}
          </NoticeBanner>
        ) : null}

        {step === 1 ? (
          <form onSubmit={handleEmailSubmit} className="form-stack" noValidate>
            <FormField id="forgot-email" label="Alamat Email" error={fieldErrors.email}>
              <TextInput
                id="forgot-email"
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
            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              Kirim kode
            </Button>
          </form>
        ) : (
          <>
            <NoticeBanner variant="info" title="Kode dikirim">
              Kode dikirim ke <strong>{email}</strong> (cek Spam). Berlaku maksimal 1 jam.
            </NoticeBanner>

            <form onSubmit={handleResetSubmit} className="form-stack" noValidate>
              <FormField id="forgot-code" label="Kode 8 Digit" error={fieldErrors.code}>
                <TextInput
                  id="forgot-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  placeholder="00000000"
                  value={code}
                  hasError={Boolean(fieldErrors.code)}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setCode(next);
                    if (fieldErrors.code) {
                      setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    const digits = text.replace(/\D/g, '').slice(0, 8);
                    if (digits) {
                      e.preventDefault();
                      setCode(digits);
                    }
                  }}
                />
              </FormField>

              <FormField id="forgot-password" label="Password Baru" error={fieldErrors.password}>
                <PasswordInput
                  id="forgot-password"
                  autoComplete="new-password"
                  placeholder="Minimal 8 karakter dan 1 huruf kapital"
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

              <FormField id="forgot-confirm" label="Konfirmasi Password" error={fieldErrors.confirmPassword}>
                <PasswordInput
                  id="forgot-confirm"
                  autoComplete="new-password"
                  placeholder="Ulangi password baru"
                  value={confirmPassword}
                  hasError={Boolean(fieldErrors.confirmPassword)}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (fieldErrors.confirmPassword) {
                      setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                />
              </FormField>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                disabled={submitting || !validatePassword(password).ok || password !== confirmPassword}
              >
                Simpan Password Baru
              </Button>
            </form>

            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Button type="button" variant="outline" size="sm" loading={submitting} disabled={submitting || cooldown > 0} onClick={handleResend}>
                Kirim ulang kode
              </Button>
              {cooldown > 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }} aria-live="polite">
                  Kirim ulang tersedia dalam {cooldown} detik
                </span>
              ) : null}
            </div>
            {sent && cooldown > 0 && !rateLimited ? (
              <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--status-success-fg, #166534)' }} aria-live="polite">
                Jika email terdaftar, kode baru telah dikirim.
              </p>
            ) : null}
          </>
        )}

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
          <Link href="/login" style={{ color: 'var(--ink-secondary)', fontWeight: 600 }}>
            Kembali ke halaman masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="container-auth">
          <LoadingState title="Memuat formulir..." lines={3} reserved />
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
