'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { type ApiCallError, apiFetch } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ButtonText } from '@/components/ui/button-text';
import { ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button, FormField, PasswordInput, TextInput } from '@/components/ui/forms';
import { notifyAuthChanged, type SessionInfo } from '@/components/ui/navigation';
import { PageBanner } from '@/components/ui/page-banner';
import { PasswordPolicyChecklist } from '@/components/ui/password-policy-checklist';
import { validatePassword } from '@/lib/password-policy';

type AccountSettings = {
  email: string;
  canManageCredentials: boolean;
  canDeleteAccount: boolean;
};

type RequestResponse = {
  status: 'code_sent';
  verificationId: string;
};

type ConfirmResponse = {
  status: 'updated';
};

type DeleteResponse = {
  status: 'deleted';
};

const CODE_PATTERN = /^\d{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DELETE_CONFIRMATION = 'HAPUS';

function friendlyAccountError(error: ApiCallError, fallback: string): string {
  if (error.code === 'invalid_code' || error.code === 'expired_code' || error.code === 'code_expired') {
    return 'Kode tidak valid atau sudah kedaluwarsa. Minta kode baru lalu coba lagi.';
  }
  if (error.code === 'invalid_password' || error.code === 'incorrect_password') {
    return 'Password saat ini tidak sesuai.';
  }
  if (error.code === 'duplicate_email' || error.code === 'email_already_exists') {
    return 'Email sudah terdaftar.';
  }
  if (error.status === 429 || error.code === 'rate_limited' || error.code === 'too_many_attempts') {
    return 'Terlalu banyak percobaan. Coba lagi nanti.';
  }
  if (error.code === 'smtp_error' || error.code === 'email_send_failed') {
    return 'Layanan email sedang tidak tersedia. Coba lagi beberapa saat lagi.';
  }
  if (error.kind === 'validation') {
    return error.message || fallback;
  }
  if (error.kind === 'service_unavailable') {
    return 'Layanan belum siap saat ini. Coba lagi beberapa saat lagi.';
  }
  if (error.kind === 'session_expired') {
    return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  }
  if (error.kind === 'forbidden_or_csrf') {
    return 'Permintaan ditolak. Muat ulang halaman lalu coba lagi.';
  }
  return fallback;
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SuccessSignInAgain({
  title,
  message,
  onContinue,
}: {
  title: string;
  message: string;
  onContinue: () => void;
}) {
  return (
    <div className="form-stack" role="status" aria-live="polite">
      <NoticeBanner variant="success" title={title}>
        {message}
      </NoticeBanner>
      <div className="unsaved-modal-actions">
        <Button type="button" variant="primary" size="md" onClick={onContinue}>
          Masuk Kembali
        </Button>
      </div>
    </div>
  );
}

type EmailStep = 'request' | 'confirm' | 'done';

function ChangeEmailModal({
  settingsEmail,
  onClose,
}: {
  settingsEmail: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<EmailStep>('request');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newEmail?: string;
    currentCode?: string;
    newCode?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: { currentPassword?: string; newEmail?: string } = {};
    if (!currentPassword) {
      errors.currentPassword = 'Password saat ini wajib diisi.';
    }
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      errors.newEmail = 'Email baru wajib diisi.';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errors.newEmail = 'Masukkan alamat email yang valid.';
    } else if (trimmedEmail === settingsEmail.toLowerCase()) {
      errors.newEmail = 'Email baru harus berbeda dari email saat ini.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<RequestResponse>('/api/account/settings/request', {
      method: 'POST',
      body: { action: 'email', currentPassword, newEmail: trimmedEmail },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Permintaan ubah email tidak dapat diproses.'));
      return;
    }

    setVerificationId(res.data.verificationId);
    setStep('confirm');
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: { currentCode?: string; newCode?: string } = {};
    if (!CODE_PATTERN.test(currentCode)) {
      errors.currentCode = 'Masukkan kode 8 digit dari email saat ini.';
    }
    if (!CODE_PATTERN.test(newCode)) {
      errors.newCode = 'Masukkan kode 8 digit dari email baru.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<ConfirmResponse>('/api/account/settings/confirm', {
      method: 'POST',
      body: {
        action: 'email',
        verificationId,
        currentCode: currentCode.trim(),
        newCode: newCode.trim(),
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Konfirmasi ubah email tidak dapat diproses.'));
      return;
    }

    setStep('done');
  }

  function handleSignInAgain() {
    notifyAuthChanged();
    router.push('/login');
    router.refresh();
  }

  return (
    <div
      className="auth-modal-overlay"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="unsaved-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-change-email-title"
        aria-describedby="modal-change-email-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="unsaved-modal-head">
          <h2
            id="modal-change-email-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.18rem',
              margin: 0,
              fontWeight: 600,
            }}
          >
            Ubah Email
          </h2>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Tutup dialog ubah email"
            disabled={submitting}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <p id="modal-change-email-desc" className="unsaved-modal-desc">
          Email saat ini: <strong>{settingsEmail || '-'}</strong>. Perubahan email memerlukan
          password saat ini dan kode verifikasi ke email lama dan email baru.
        </p>

        {step === 'done' ? (
          <SuccessSignInAgain
            title="Email Berhasil Diperbarui"
            message="Email akun Anda telah diperbarui. Masuk kembali untuk melanjutkan."
            onContinue={handleSignInAgain}
          />
        ) : null}

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="form-stack" noValidate>
            {formError ? (
              <NoticeBanner variant="error" title="Permintaan Gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </NoticeBanner>
            ) : null}

            <FormField id="settings-email-new" label="Email Baru" error={fieldErrors.newEmail}>
              <TextInput
                id="settings-email-new"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="nama-baru@email.com"
                value={newEmail}
                hasError={Boolean(fieldErrors.newEmail)}
                onChange={(e) => {
                  setNewEmail(e.target.value);
                  if (fieldErrors.newEmail) setFieldErrors((prev) => ({ ...prev, newEmail: undefined }));
                }}
              />
            </FormField>

            <FormField
              id="settings-email-current-password"
              label="Password Saat Ini"
              error={fieldErrors.currentPassword}
            >
              <PasswordInput
                id="settings-email-current-password"
                autoComplete="current-password"
                placeholder="Masukkan password saat ini"
                value={currentPassword}
                hasError={Boolean(fieldErrors.currentPassword)}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
              />
            </FormField>

            <div className="unsaved-modal-actions" style={{ marginTop: 6 }}>
              <Button type="button" variant="outline" size="md" disabled={submitting} onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Kirim Kode Verifikasi
              </Button>
            </div>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <form onSubmit={handleConfirm} className="form-stack" noValidate>
            <NoticeBanner variant="info" title="Kode Verifikasi Dikirim">
              Kode 8 digit telah dikirim ke email saat ini dan email baru. Masukkan kedua kode untuk
              menyelesaikan perubahan email.
            </NoticeBanner>
            {formError ? (
              <NoticeBanner variant="error" title="Konfirmasi Gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </NoticeBanner>
            ) : null}

            <FormField
              id="settings-email-current-code"
              label="Kode dari Email Saat Ini"
              error={fieldErrors.currentCode}
            >
              <TextInput
                id="settings-email-current-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                placeholder="00000000"
                value={currentCode}
                hasError={Boolean(fieldErrors.currentCode)}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setCurrentCode(next);
                  if (fieldErrors.currentCode) setFieldErrors((prev) => ({ ...prev, currentCode: undefined }));
                }}
              />
            </FormField>

            <FormField
              id="settings-email-new-code"
              label="Kode dari Email Baru"
              error={fieldErrors.newCode}
            >
              <TextInput
                id="settings-email-new-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="00000000"
                value={newCode}
                hasError={Boolean(fieldErrors.newCode)}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setNewCode(next);
                  if (fieldErrors.newCode) setFieldErrors((prev) => ({ ...prev, newCode: undefined }));
                }}
              />
            </FormField>

            <div className="unsaved-modal-actions" style={{ marginTop: 6 }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={submitting}
                onClick={() => {
                  setStep('request');
                  setCurrentCode('');
                  setNewCode('');
                  setFieldErrors({});
                  setFormError(null);
                }}
              >
                Kembali
              </Button>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Konfirmasi Email Baru
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

type PasswordStep = 'request' | 'confirm' | 'done';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<PasswordStep>('request');
  const [currentPassword, setCurrentPassword] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    currentCode?: string;
    newPassword?: string;
    confirmNewPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    if (!currentPassword) {
      setFieldErrors({ currentPassword: 'Password saat ini wajib diisi.' });
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<RequestResponse>('/api/account/settings/request', {
      method: 'POST',
      body: { action: 'password', currentPassword },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Permintaan ubah password tidak dapat diproses.'));
      return;
    }

    setVerificationId(res.data.verificationId);
    setStep('confirm');
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: {
      currentCode?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    } = {};
    if (!CODE_PATTERN.test(currentCode)) {
      errors.currentCode = 'Masukkan kode 8 digit dari email Anda.';
    }
    const passwordValidation = validatePassword(newPassword);
    if (!newPassword) {
      errors.newPassword = 'Password baru wajib diisi.';
    } else if (!passwordValidation.ok) {
      errors.newPassword = 'Password baru belum memenuhi syarat.';
    } else if (newPassword.length > 72) {
      errors.newPassword = 'Password maksimal 72 karakter.';
    }
    if (!confirmNewPassword) {
      errors.confirmNewPassword = 'Konfirmasi password baru wajib diisi.';
    } else if (confirmNewPassword !== newPassword) {
      errors.confirmNewPassword = 'Konfirmasi password baru tidak sama.';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<ConfirmResponse>('/api/account/settings/confirm', {
      method: 'POST',
      body: {
        action: 'password',
        verificationId,
        currentCode: currentCode.trim(),
        newPassword,
      },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Konfirmasi ubah password tidak dapat diproses.'));
      return;
    }

    setStep('done');
  }

  function handleSignInAgain() {
    notifyAuthChanged();
    router.push('/login');
    router.refresh();
  }

  return (
    <div
      className="auth-modal-overlay"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="unsaved-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-change-password-title"
        aria-describedby="modal-change-password-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="unsaved-modal-head">
          <h2
            id="modal-change-password-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.18rem',
              margin: 0,
              fontWeight: 600,
            }}
          >
            Ubah Kata Sandi
          </h2>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Tutup dialog ubah kata sandi"
            disabled={submitting}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <p id="modal-change-password-desc" className="unsaved-modal-desc">
          Masukkan password saat ini untuk menerima kode verifikasi ke email Anda, lalu buat password
          baru.
        </p>

        {step === 'done' ? (
          <SuccessSignInAgain
            title="Password Berhasil Diperbarui"
            message="Password akun Anda telah diperbarui. Masuk kembali untuk melanjutkan."
            onContinue={handleSignInAgain}
          />
        ) : null}

        {step === 'request' ? (
          <form onSubmit={handleRequest} className="form-stack" noValidate>
            {formError ? (
              <NoticeBanner variant="error" title="Permintaan Gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </NoticeBanner>
            ) : null}

            <FormField
              id="settings-password-current"
              label="Password Saat Ini"
              error={fieldErrors.currentPassword}
            >
              <PasswordInput
                id="settings-password-current"
                autoComplete="current-password"
                autoFocus
                placeholder="Masukkan password saat ini"
                value={currentPassword}
                hasError={Boolean(fieldErrors.currentPassword)}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
              />
            </FormField>

            <div className="unsaved-modal-actions" style={{ marginTop: 6 }}>
              <Button type="button" variant="outline" size="md" disabled={submitting} onClick={onClose}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Kirim Kode Verifikasi
              </Button>
            </div>
          </form>
        ) : null}

        {step === 'confirm' ? (
          <form onSubmit={handleConfirm} className="form-stack" noValidate>
            <NoticeBanner variant="info" title="Kode Verifikasi Dikirim">
              Kode 8 digit telah dikirim ke email Anda. Masukkan kode tersebut dan password baru
              Anda.
            </NoticeBanner>
            {formError ? (
              <NoticeBanner variant="error" title="Konfirmasi Gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </NoticeBanner>
            ) : null}

            <FormField
              id="settings-password-code"
              label="Kode Verifikasi"
              error={fieldErrors.currentCode}
            >
              <TextInput
                id="settings-password-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
                placeholder="00000000"
                value={currentCode}
                hasError={Boolean(fieldErrors.currentCode)}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 8);
                  setCurrentCode(next);
                  if (fieldErrors.currentCode) setFieldErrors((prev) => ({ ...prev, currentCode: undefined }));
                }}
              />
            </FormField>

            <FormField
              id="settings-password-new"
              label="Password Baru"
              error={fieldErrors.newPassword}
            >
              <PasswordInput
                id="settings-password-new"
                autoComplete="new-password"
                placeholder="Minimal 8 karakter dan 1 huruf besar"
                value={newPassword}
                hasError={Boolean(fieldErrors.newPassword)}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (fieldErrors.newPassword) setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                }}
              />
              <PasswordPolicyChecklist password={newPassword} />
            </FormField>

            <FormField
              id="settings-password-confirm"
              label="Konfirmasi Password Baru"
              error={fieldErrors.confirmNewPassword}
            >
              <PasswordInput
                id="settings-password-confirm"
                autoComplete="new-password"
                placeholder="Ulangi password baru"
                value={confirmNewPassword}
                hasError={Boolean(fieldErrors.confirmNewPassword)}
                onChange={(e) => {
                  setConfirmNewPassword(e.target.value);
                  if (fieldErrors.confirmNewPassword) {
                    setFieldErrors((prev) => ({ ...prev, confirmNewPassword: undefined }));
                  }
                }}
              />
            </FormField>

            <div className="unsaved-modal-actions" style={{ marginTop: 6 }}>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={submitting}
                onClick={() => {
                  setStep('request');
                  setCurrentCode('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setFieldErrors({});
                  setFormError(null);
                }}
              >
                Kembali
              </Button>
              <Button type="submit" variant="primary" size="md" loading={submitting}>
                Simpan Password Baru
              </Button>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function DeleteAccountModal({
  email,
  canManageCredentials,
  onClose,
}: {
  email: string;
  canManageCredentials: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    currentCode?: string;
    confirmation?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitting, onClose]);

  async function handleRequestDeleteCode() {
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);
    const res = await apiFetch<RequestResponse>('/api/account/settings/request', {
      method: 'POST',
      body: { action: 'delete' },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Kode konfirmasi penghapusan akun tidak dapat dikirim.'));
      return;
    }

    setVerificationId(res.data.verificationId);
    setCodeSent(true);
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: { currentPassword?: string; currentCode?: string; confirmation?: string } = {};
    if (canManageCredentials) {
      if (!currentPassword) {
        errors.currentPassword = 'Password saat ini wajib diisi.';
      }
    } else {
      if (!codeSent || !verificationId) {
        setFormError('Minta kode verifikasi terlebih dahulu sebelum menghapus akun.');
        return;
      }
      if (!CODE_PATTERN.test(currentCode)) {
        errors.currentCode = 'Masukkan kode 8 digit dari email Anda.';
      }
    }
    if (confirmation !== DELETE_CONFIRMATION) {
      errors.confirmation = `Ketik ${DELETE_CONFIRMATION} untuk mengonfirmasi penghapusan akun.`;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<DeleteResponse>('/api/account/settings', {
      method: 'DELETE',
      body: canManageCredentials
        ? { currentPassword, confirmation }
        : { verificationId, currentCode: currentCode.trim(), confirmation },
    });
    setSubmitting(false);

    if (!res.ok) {
      setFormError(friendlyAccountError(res.error, 'Akun tidak dapat dihapus saat ini.'));
      return;
    }

    notifyAuthChanged();
    router.push('/login');
    router.refresh();
  }

  return (
    <div
      className="auth-modal-overlay"
      role="presentation"
      onClick={() => {
        if (!submitting) onClose();
      }}
    >
      <div
        className="unsaved-modal-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="modal-delete-account-title"
        aria-describedby="modal-delete-account-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="unsaved-modal-head">
          <div className="unsaved-modal-title-wrap">
            <span className="unsaved-modal-icon settings-danger-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            <h2
              id="modal-delete-account-title"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.18rem',
                margin: 0,
                fontWeight: 600,
              }}
            >
              Konfirmasi Hapus Akun
            </h2>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            aria-label="Tutup dialog hapus akun"
            disabled={submitting}
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <p id="modal-delete-account-desc" className="unsaved-modal-desc">
          {canManageCredentials ? (
            <>
              Tindakan ini akan menghapus akun <strong>{email}</strong> beserta seluruh data secara
              permanen dan tidak dapat dibatalkan.
            </>
          ) : (
            <>
              Tindakan ini akan menghapus akun RakitKarier (<strong>{email}</strong>) secara
              permanen dan tidak memengaruhi akun Google Anda.
            </>
          )}
        </p>

        <form onSubmit={handleDelete} className="form-stack" noValidate>
          {formError ? (
            <NoticeBanner variant="error" title="Penghapusan Gagal" onDismiss={() => setFormError(null)}>
              {formError}
            </NoticeBanner>
          ) : null}

          {canManageCredentials ? (
            <FormField
              id="settings-delete-password"
              label="Password Saat Ini"
              error={fieldErrors.currentPassword}
            >
              <PasswordInput
                id="settings-delete-password"
                autoComplete="current-password"
                autoFocus
                placeholder="Masukkan password saat ini"
                value={currentPassword}
                hasError={Boolean(fieldErrors.currentPassword)}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (fieldErrors.currentPassword) {
                    setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                  }
                }}
              />
            </FormField>
          ) : !codeSent ? (
            <div className="unsaved-modal-actions" style={{ marginTop: 4 }}>
              <Button type="button" variant="outline" size="md" disabled={submitting} onClick={onClose}>
                Batal
              </Button>
              <Button
                type="button"
                variant="danger"
                size="md"
                loading={submitting}
                onClick={handleRequestDeleteCode}
              >
                Kirim Kode Konfirmasi
              </Button>
            </div>
          ) : (
            <>
              <NoticeBanner variant="info" title="Kode Verifikasi Dikirim">
                Kode 8 digit telah dikirim ke email Anda. Masukkan kode tersebut untuk mengonfirmasi
                penghapusan akun.
              </NoticeBanner>
              <FormField
                id="settings-delete-code"
                label="Kode Verifikasi"
                error={fieldErrors.currentCode}
              >
                <TextInput
                  id="settings-delete-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={8}
                  placeholder="00000000"
                  value={currentCode}
                  hasError={Boolean(fieldErrors.currentCode)}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, '').slice(0, 8);
                    setCurrentCode(next);
                    if (fieldErrors.currentCode) {
                      setFieldErrors((prev) => ({ ...prev, currentCode: undefined }));
                    }
                  }}
                />
              </FormField>
            </>
          )}

          {canManageCredentials || codeSent ? (
            <>
              <FormField
                id="settings-delete-confirmation"
                label={`Ketik ${DELETE_CONFIRMATION} untuk konfirmasi`}
                hint={`Masukkan kata ${DELETE_CONFIRMATION} dengan huruf kapital.`}
                error={fieldErrors.confirmation}
              >
                <TextInput
                  id="settings-delete-confirmation"
                  type="text"
                  value={confirmation}
                  placeholder={DELETE_CONFIRMATION}
                  hasError={Boolean(fieldErrors.confirmation)}
                  autoComplete="off"
                  onChange={(e) => {
                    setConfirmation(e.target.value);
                    if (fieldErrors.confirmation) {
                      setFieldErrors((prev) => ({ ...prev, confirmation: undefined }));
                    }
                  }}
                />
              </FormField>

              <div className="unsaved-modal-actions" style={{ marginTop: 6 }}>
                <Button type="button" variant="outline" size="md" disabled={submitting} onClick={onClose}>
                  Batal
                </Button>
                <Button type="submit" variant="danger" size="md" loading={submitting}>
                  Ya, Hapus Akun
                </Button>
              </div>
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function AccountSettingsInner({ session }: { session: SessionInfo }) {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [activeModal, setActiveModal] = useState<'email' | 'password' | 'delete' | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<AccountSettings>('/api/account/settings');
    if (res.ok) {
      setSettings(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  if (loading) {
    return (
      <LoadingState
        title="Memuat pengaturan akun..."
        description="Mohon tunggu sebentar."
        lines={4}
        reserved
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        title="Belum Dapat Memuat Pengaturan Akun"
        onRetry={loadSettings}
        loginRedirectPath="/account/settings"
      />
    );
  }

  if (!settings) {
    return (
      <ErrorState
        error={{
          status: 500,
          code: 'settings_missing',
          message: 'Data pengaturan akun tidak tersedia.',
          kind: 'generic',
        }}
        title="Belum Dapat Memuat Pengaturan Akun"
        onRetry={loadSettings}
        loginRedirectPath="/account/settings"
      />
    );
  }

  const displayEmail = settings.email || session.user.email || '-';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        className={`settings-grid${!settings.canManageCredentials ? ' settings-grid--two' : ''}`}
      >
        {/* Kartu 1: Email */}
        <section className="settings-tile" aria-labelledby="heading-account-email">
          <div className="settings-tile__top">
            <h2 id="heading-account-email" className="settings-tile__title">
              Email
            </h2>
            {settings.canManageCredentials ? (
              <button
                type="button"
                className="settings-tile__icon-btn"
                aria-label="Ubah alamat email"
                title="Ubah alamat email"
                onClick={() => setActiveModal('email')}
              >
                <PencilIcon />
              </button>
            ) : (
              <span className="settings-tile__badge">Google</span>
            )}
          </div>
          <p className="settings-tile__value">{displayEmail}</p>
          <p className="settings-tile__hint">
            {settings.canManageCredentials
              ? 'Digunakan untuk masuk dan menerima kode verifikasi keamanan.'
              : 'Email & kata sandi dikelola langsung oleh akun Google Anda.'}
          </p>
        </section>

        {/* Kartu 2: Kata Sandi (khusus akun email/password) */}
        {settings.canManageCredentials ? (
          <section className="settings-tile" aria-labelledby="heading-account-password">
            <div className="settings-tile__top">
              <h2 id="heading-account-password" className="settings-tile__title">
                Kata sandi
              </h2>
              <button
                type="button"
                className="settings-tile__icon-btn"
                aria-label="Ubah kata sandi"
                title="Ubah kata sandi"
                onClick={() => setActiveModal('password')}
              >
                <PencilIcon />
              </button>
            </div>
            <p className="settings-tile__value">••••••••••••</p>
            <p className="settings-tile__hint">
              Gunakan kombinasi minimal 8 karakter dan 1 huruf besar.
            </p>
          </section>
        ) : null}

        {/* Kartu 3: Hapus Akun */}
        {settings.canDeleteAccount ? (
          <section className="settings-tile" aria-labelledby="heading-account-delete">
            <div className="settings-tile__top">
              <h2 id="heading-account-delete" className="settings-tile__title">
                Hapus akun
              </h2>
              <button
                type="button"
                className="settings-tile__icon-btn settings-tile__icon-btn--danger"
                aria-label="Hapus akun"
                title="Hapus akun"
                onClick={() => setActiveModal('delete')}
              >
                <TrashIcon />
              </button>
            </div>
            <p className="settings-tile__value">
              {settings.canManageCredentials
                ? 'Hapus akun secara permanen'
                : 'Hapus akun RakitKarier'}
            </p>
            <p className="settings-tile__hint">
              {settings.canManageCredentials
                ? 'Menghapus profil, bookmark, dan seluruh data secara permanen.'
                : 'Tidak memengaruhi akun Google Anda, namun data RakitKarier akan terhapus.'}
            </p>
          </section>
        ) : null}
      </div>

      {/* Ringkasan Keamanan Akun */}
      <section className="settings-info-panel" aria-labelledby="heading-security-overview">
        <div className="settings-info-panel__head">
          <div>
            <h2 id="heading-security-overview" className="settings-info-panel__title">
              Ringkasan Keamanan Akun
            </h2>
            <p className="settings-info-panel__subtitle">
              Setiap perubahan sensitif dilindungi verifikasi kode 8 digit agar akun tetap aman.
            </p>
          </div>
          <span className="settings-status-pill">
            <span className="settings-status-pill__dot" aria-hidden="true" />
            {settings.canManageCredentials ? 'Email Terverifikasi' : 'Terhubung Google'}
          </span>
        </div>

        <div className="settings-info-grid">
          <div className="settings-info-item">
            <span className="settings-info-item__label">Metode Masuk</span>
            <p className="settings-info-item__value">
              {settings.canManageCredentials ? 'Email & Kata Sandi' : 'Google OAuth'}
            </p>
            <p className="settings-info-item__desc">
              {settings.canManageCredentials
                ? 'Anda dapat memperbarui email maupun kata sandi kapan saja dari kartu di atas.'
                : 'Autentikasi dikelola Google sehingga Anda tidak perlu mengatur kata sandi terpisah.'}
            </p>
          </div>

          <div className="settings-info-item">
            <span className="settings-info-item__label">Verifikasi OTP</span>
            <p className="settings-info-item__value">Kode 8 digit via email</p>
            <p className="settings-info-item__desc">
              Kode verifikasi berlaku 15 menit. Cek juga folder Spam jika email belum terlihat di
              kotak masuk.
            </p>
          </div>

          <div className="settings-info-item">
            <span className="settings-info-item__label">Perlindungan Sesi</span>
            <p className="settings-info-item__value">Keluar otomatis setelah ubah</p>
            <p className="settings-info-item__desc">
              Setelah email atau kata sandi diperbarui, sesi lama otomatis berakhir dan Anda diminta
              masuk kembali.
            </p>
          </div>
        </div>
      </section>

      {activeModal === 'email' && settings.canManageCredentials ? (
        <ChangeEmailModal
          settingsEmail={displayEmail}
          onClose={() => setActiveModal(null)}
        />
      ) : null}

      {activeModal === 'password' && settings.canManageCredentials ? (
        <ChangePasswordModal onClose={() => setActiveModal(null)} />
      ) : null}

      {activeModal === 'delete' && settings.canDeleteAccount ? (
        <DeleteAccountModal
          email={displayEmail}
          canManageCredentials={settings.canManageCredentials}
          onClose={() => setActiveModal(null)}
        />
      ) : null}
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Akun & Keamanan"
        title="Pengaturan Akun"
        subtitle="Kelola email, kata sandi, dan keamanan akun RakitKarier Anda."
        tone="mist"
        imageSrc="/images/banner-profile-vector.svg"
        actions={
          <Link href="/profile" className="btn btn-outline btn-sm">
            <ButtonText>Kembali ke Profil</ButtonText>
          </Link>
        }
      />

      <AuthGuard title="Masuk untuk Mengakses Pengaturan Akun">
        {(session) => <AccountSettingsInner session={session} />}
      </AuthGuard>
    </div>
  );
}
