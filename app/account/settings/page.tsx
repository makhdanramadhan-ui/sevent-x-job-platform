'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import { type ApiCallError, apiFetch } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button, FormField, PasswordInput, TextInput } from '@/components/ui/forms';
import { notifyAuthChanged, type SessionInfo } from '@/components/ui/navigation';
import { PageBanner } from '@/components/ui/page-banner';
import { PasswordPolicyChecklist } from '@/components/ui/password-policy-checklist';
import { validatePassword } from '@/lib/password-policy';

type AccountSettings = {
  email: string;
  canManageCredentials: boolean;
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
    return 'Email baru sudah digunakan oleh akun lain.';
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

function SectionCard({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string;
  description: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  const headingId = useId();
  return (
    <section
      className={tone === 'danger' ? 'surface-card' : 'ledger-card'}
      style={tone === 'danger' ? { borderColor: 'var(--status-danger-border)' } : undefined}
      aria-labelledby={headingId}
    >
      <h2 id={headingId} style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>
        {title}
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
        {description}
      </p>
      {children}
    </section>
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
      <div>
        <Button type="button" variant="primary" onClick={onContinue}>
          Masuk Kembali
        </Button>
      </div>
    </div>
  );
}

type EmailStep = 'request' | 'confirm' | 'done';

function ChangeEmailSection({ settingsEmail }: { settingsEmail: string }) {
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

  function resetFlow() {
    setStep('request');
    setCurrentPassword('');
    setNewEmail('');
    setVerificationId('');
    setCurrentCode('');
    setNewCode('');
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <SectionCard
      title="Ubah Email"
      description="Perubahan email memerlukan password saat ini dan kode verifikasi yang dikirim ke email lama dan email baru."
    >
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
          <FormField
            id="settings-email-current"
            label="Email Saat Ini"
            hint="Email ini digunakan untuk menerima kode konfirmasi."
          >
            <TextInput id="settings-email-current" type="email" value={settingsEmail} disabled readOnly />
          </FormField>
          <FormField id="settings-email-new" label="Email Baru" error={fieldErrors.newEmail} required>
            <TextInput
              id="settings-email-new"
              type="email"
              autoComplete="email"
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
            required
          >
            <PasswordInput
              id="settings-email-current-password"
              autoComplete="current-password"
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
          <div>
            <Button type="submit" variant="primary" loading={submitting}>
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
            required
          >
            <TextInput
              id="settings-email-current-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
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
            required
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button type="submit" variant="primary" loading={submitting}>
              Konfirmasi Email Baru
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={resetFlow}>
              Batal
            </Button>
          </div>
        </form>
      ) : null}
    </SectionCard>
  );
}

type PasswordStep = 'request' | 'confirm' | 'done';

function ChangePasswordSection() {
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
    if (!passwordValidation.ok) {
      errors.newPassword = 'Password baru belum memenuhi syarat.';
    } else if (newPassword.length > 72) {
      errors.newPassword = 'Password maksimal 72 karakter.';
    }
    if (confirmNewPassword !== newPassword) {
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

  function resetFlow() {
    setStep('request');
    setCurrentPassword('');
    setVerificationId('');
    setCurrentCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <SectionCard
      title="Ubah Password"
      description="Gunakan password baru yang memenuhi syarat. Setelah password diperbarui, Anda perlu masuk kembali."
    >
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
            required
          >
            <PasswordInput
              id="settings-password-current"
              autoComplete="current-password"
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
          <div>
            <Button type="submit" variant="primary" loading={submitting}>
              Kirim Kode Verifikasi
            </Button>
          </div>
        </form>
      ) : null}

      {step === 'confirm' ? (
        <form onSubmit={handleConfirm} className="form-stack" noValidate>
          <NoticeBanner variant="info" title="Kode Verifikasi Dikirim">
            Kode 8 digit telah dikirim ke email Anda. Masukkan kode tersebut dan password baru Anda.
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
            required
          >
            <TextInput
              id="settings-password-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
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
            required
          >
            <PasswordInput
              id="settings-password-new"
              autoComplete="new-password"
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
            required
          >
            <PasswordInput
              id="settings-password-confirm"
              autoComplete="new-password"
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button type="submit" variant="primary" loading={submitting}>
              Simpan Password Baru
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={resetFlow}>
              Batal
            </Button>
          </div>
        </form>
      ) : null}
    </SectionCard>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    confirmation?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmArmed, setConfirmArmed] = useState(false);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const errors: { currentPassword?: string; confirmation?: string } = {};
    if (!currentPassword) {
      errors.currentPassword = 'Password saat ini wajib diisi.';
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
      body: { currentPassword, confirmation },
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
    <SectionCard
      title="Hapus Akun"
      description="Tindakan ini menghapus akun Anda secara permanen. Data yang terkait akun dapat ikut terhapus sesuai kebijakan sistem."
      tone="danger"
    >
      <form onSubmit={handleDelete} className="form-stack" noValidate>
        {formError ? (
          <NoticeBanner variant="error" title="Penghapusan Gagal" onDismiss={() => setFormError(null)}>
            {formError}
          </NoticeBanner>
        ) : null}
        <NoticeBanner variant="warning" title="Tindakan Permanen">
          Penghapusan akun tidak dapat dibatalkan. Pastikan Anda benar-benar ingin menghapus akun ini.
        </NoticeBanner>
        <FormField
          id="settings-delete-password"
          label="Password Saat Ini"
          error={fieldErrors.currentPassword}
          required
        >
          <PasswordInput
            id="settings-delete-password"
            autoComplete="current-password"
            value={currentPassword}
            hasError={Boolean(fieldErrors.currentPassword)}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              if (fieldErrors.currentPassword) setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
            }}
          />
        </FormField>
        <FormField
          id="settings-delete-confirmation"
          label={`Ketik ${DELETE_CONFIRMATION} untuk konfirmasi`}
          hint={`Masukkan kata ${DELETE_CONFIRMATION} dengan huruf kapital.`}
          error={fieldErrors.confirmation}
          required
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
              if (fieldErrors.confirmation) setFieldErrors((prev) => ({ ...prev, confirmation: undefined }));
            }}
          />
        </FormField>

        {!confirmArmed ? (
          <div>
            <Button
              type="button"
              variant="danger"
              disabled={submitting}
              onClick={() => setConfirmArmed(true)}
            >
              Hapus Akun...
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Button type="submit" variant="danger" loading={submitting}>
              Ya, Hapus Akun Permanen
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmArmed(false)}
            >
              Batal
            </Button>
          </div>
        )}
      </form>
    </SectionCard>
  );
}

function GoogleManagedNotice({ email }: { email: string }) {
  return (
    <section className="ledger-card" aria-labelledby="google-managed-heading">
      <h2 id="google-managed-heading" style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>
        Akun Dikelola Google
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
        Akun ini masuk menggunakan Google. Perubahan email, password, dan penghapusan kredensial
        RakitKarier tidak tersedia dari halaman ini.
      </p>
      <NoticeBanner variant="info" title="Kelola Akun Melalui Google">
        Untuk keamanan akun Anda, kelola kredensial melalui akun Google yang terhubung
        {email ? (
          <>
            {' '}(<strong>{email}</strong>)
          </>
        ) : null}
        .
      </NoticeBanner>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href="/profile" className="btn btn-outline btn-sm">
          Kembali ke Profil
        </Link>
      </div>
    </section>
  );
}

function AccountSettingsInner({ session }: { session: SessionInfo }) {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);

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

  if (!settings.canManageCredentials) {
    return <GoogleManagedNotice email={settings.email || session.user.email || ''} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <ChangeEmailSection settingsEmail={settings.email} />
      <ChangePasswordSection />
      <DeleteAccountSection />
    </div>
  );
}

export default function AccountSettingsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBanner
        kicker="Akun & Keamanan"
        title="Pengaturan Akun"
        subtitle="Kelola email, password, dan keamanan akun RakitKarier Anda."
        tone="sand"
        imageSrc="/images/banner-profile.jpg"
        actions={
          <Link href="/profile" className="btn btn-outline btn-sm">
            Kembali ke Profil
          </Link>
        }
      />

      <AuthGuard title="Masuk untuk Mengakses Pengaturan Akun">
        {(session) => <AccountSettingsInner session={session} />}
      </AuthGuard>
    </div>
  );
}
