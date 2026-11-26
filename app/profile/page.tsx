'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  type ChangeEvent,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { type ApiCallError, apiFetch, formatDateTimeId } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ButtonText } from '@/components/ui/button-text';
import { EmptyState, ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/forms';
import { getInitials, notifyAuthChanged, type SessionInfo } from '@/components/ui/navigation';
import { PageBanner } from '@/components/ui/page-banner';
import { ProfileEditorForm } from '@/components/ui/profile-editor';
import type { ProfileRecord } from '@/lib/contracts';

type AvatarUploadResponse = { avatar_url: string | null };
type AvatarSource = 'custom' | 'provider' | null;

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function isAcceptedAvatarType(type: string): boolean {
  return (
    type === 'image/jpeg' ||
    type === 'image/png' ||
    type === 'image/webp'
  );
}

function classifyAvatarError(status: number, code: string): ApiCallError['kind'] {
  if (code === 'email_not_confirmed') return 'email_not_confirmed';
  if (status === 401 || code === 'unauthorized') return 'session_expired';
  if (status === 403 || code === 'csrf_rejected' || code === 'forbidden') {
    return 'forbidden_or_csrf';
  }
  if (status === 413 || status === 415 || status === 400 || code === 'validation_error') {
    return 'validation';
  }
  if (status === 429 || code === 'rate_limited') return 'rate_limited';
  return 'generic';
}

function uploadAvatarWithProgress(
  file: File,
  onProgress: (percent: number) => void,
): Promise<
  | { ok: true; avatar_url: string | null }
  | { ok: false; error: ApiCallError }
> {
  const { promise, resolve } = Promise.withResolvers<
    | { ok: true; avatar_url: string | null }
    | { ok: false; error: ApiCallError }
  >();

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/profile/avatar');
  xhr.withCredentials = true;
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && event.total > 0) {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };
  xhr.onerror = () => {
    resolve({
      ok: false,
      error: {
        status: 0,
        code: 'network_error',
        message: 'Gagal terhubung ke server. Periksa koneksi jaringan Anda lalu coba lagi.',
        kind: 'generic',
      },
    });
  };
  xhr.onload = () => {
    const status = xhr.status;
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(xhr.responseText) as unknown;
    } catch {
      parsed = null;
    }

    if (status >= 200 && status < 300) {
      const data =
        parsed && typeof parsed === 'object' && 'data' in parsed
          ? (parsed as { data?: AvatarUploadResponse }).data
          : (parsed as AvatarUploadResponse | null);
      resolve({ ok: true, avatar_url: data?.avatar_url ?? null });
      return;
    }

    const errBody =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? (parsed as { error?: { code?: string; message?: string; details?: Record<string, unknown> } })
            .error
        : null;
    const code = errBody?.code ?? `http_${status}`;
    const message =
      errBody?.message ??
      (status === 401
        ? 'Sesi Anda telah berakhir atau belum terautentikasi. Silakan masuk kembali.'
        : status === 413
          ? 'Ukuran foto melebihi 2 MB.'
          : status === 415
            ? 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.'
            : status === 429
              ? 'Terlalu banyak percobaan unggah foto. Coba lagi nanti.'
              : 'Foto profil tidak dapat diunggah saat ini.');
    resolve({
      ok: false,
      error: {
        status,
        code,
        message,
        details: errBody?.details,
        kind: classifyAvatarError(status, code),
      },
    });
  };

  const formData = new FormData();
  formData.append('file', file);
  xhr.send(formData);

  return promise;
}

function ProfileAvatarSection({ session }: { session: SessionInfo }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(session.user.avatar_url ?? null);
  const [avatarSource, setAvatarSource] = useState<AvatarSource>(
    session.user.avatar_source ?? null,
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const label = session.user.name ?? session.user.email ?? 'Akun Aktif';
  const displayedUrl = previewUrl ?? avatarUrl;
  const showImage = Boolean(displayedUrl) && !imageFailed;
  const busy = uploading || deleting;

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const refreshAvatarState = useCallback(async () => {
    const res = await apiFetch<SessionInfo>('/api/auth/me');
    if (res.ok) {
      setAvatarUrl(res.data.user.avatar_url ?? null);
      setAvatarSource((res.data.user.avatar_source ?? null) as AvatarSource);
      setImageFailed(false);
    }
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setConfirmDelete(false);

    if (!isAcceptedAvatarType(file.type)) {
      setErrorMessage('Format foto harus JPG, PNG, atau WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setErrorMessage('Ukuran foto maksimal 2 MB.');
      return;
    }

    clearPreview();
    const objectUrl = URL.createObjectURL(file);
    previewUrlRef.current = objectUrl;
    setPreviewUrl(objectUrl);
    setImageFailed(false);
    setUploading(true);
    setUploadProgress(0);

    const result = await uploadAvatarWithProgress(file, setUploadProgress);
    setUploading(false);

    if (!result.ok) {
      clearPreview();
      setUploadProgress(0);
      setErrorMessage(result.error.message);
      return;
    }

    clearPreview();
    setUploadProgress(100);
    setAvatarUrl(result.avatar_url ?? null);
    setAvatarSource('custom');
    setImageFailed(false);
    setSuccessMessage('Foto profil berhasil diperbarui.');
    await refreshAvatarState();
    notifyAuthChanged();
  }

  async function handleDeleteAvatar() {
    setDeleting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const res = await apiFetch<AvatarUploadResponse>('/api/profile/avatar', {
      method: 'DELETE',
    });
    setDeleting(false);
    setConfirmDelete(false);

    if (!res.ok) {
      setErrorMessage(res.error.message);
      return;
    }

    setAvatarUrl(res.data.avatar_url ?? null);
    setAvatarSource(res.data.avatar_url ? 'provider' : null);
    setImageFailed(false);
    setSuccessMessage('Foto profil berhasil dihapus.');
    await refreshAvatarState();
    notifyAuthChanged();
  }

  return (
    <section className="ledger-card profile-avatar-card" aria-labelledby="profile-photo-heading">
      <h2 id="profile-photo-heading" style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>
        Foto Profil
      </h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
        Foto khusus akan menggantikan foto dari penyedia masuk di seluruh RakitKarier.
      </p>

      {errorMessage ? (
        <NoticeBanner
          variant="error"
          title="Foto Profil Belum Berhasil Diproses"
          onDismiss={() => setErrorMessage(null)}
        >
          {errorMessage}
        </NoticeBanner>
      ) : null}
      {successMessage ? (
        <NoticeBanner variant="success" title="Berhasil" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </NoticeBanner>
      ) : null}

      <div className="profile-avatar-row">
        <div
          className="profile-avatar-figure"
          role={showImage ? undefined : 'img'}
          aria-label={showImage ? undefined : `Foto profil ${label}`}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayedUrl ?? undefined}
              alt={`Foto profil ${label}`}
              width={72}
              height={72}
              decoding="async"
              className="profile-avatar-image"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="profile-avatar-initials" aria-hidden="true">
              {getInitials(label)}
            </span>
          )}
        </div>

        <div className="profile-avatar-controls">
          <div className="profile-avatar-actions">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={ACCEPTED_AVATAR_TYPES.join(',')}
              aria-label="Unggah foto profil"
              className="sr-only"
              onChange={handleFileChange}
              disabled={busy}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={busy}
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              Ganti Foto
            </Button>

            {avatarSource === 'custom' && !confirmDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Hapus Foto
              </Button>
            ) : null}

            {avatarSource === 'custom' && confirmDelete ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  loading={deleting}
                  onClick={handleDeleteAvatar}
                >
                  Ya, Hapus Foto
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleting}
                  onClick={() => setConfirmDelete(false)}
                >
                  Batal
                </Button>
              </>
            ) : null}
          </div>

          <p className="profile-avatar-hint">Format JPG, PNG, atau WebP. Maksimal 2 MB.</p>

          {uploading ? (
            <div className="profile-avatar-progress" aria-live="polite">
              <div
                className="profile-avatar-progress-track"
                role="progressbar"
                aria-label="Progres unggah foto"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
              >
                <div
                  className="profile-avatar-progress-bar"
                  style={{ transform: `scaleX(${uploadProgress / 100})` }}
                />
              </div>
              <span className="profile-avatar-progress-text">
                Mengunggah... {uploadProgress}%
              </span>
            </div>
          ) : null}

          {previewUrl ? (
            <p className="profile-avatar-hint" aria-live="polite">
              Pratinjau foto ditampilkan sebelum unggah selesai.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ProfileInner({ session: initialSession }: { session: SessionInfo }) {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === '1';
  const rawNext = searchParams.get('next');
  const returnTo =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null;
  const [session, setSession] = useState(initialSession);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearNotice, setClearNotice] = useState<string | null>(null);
  const [showVerified, setShowVerified] = useState(verified);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<ProfileRecord | null>('/api/profile');
    if (res.ok) {
      setProfile(res.data);
      setFormVersion((v) => v + 1);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handler = () => {
      apiFetch<SessionInfo>('/api/auth/me').then((res) => {
        if (res.ok) setSession(res.data);
      });
    };
    window.addEventListener('seventx:auth-changed', handler);
    return () => window.removeEventListener('seventx:auth-changed', handler);
  }, []);

  async function handleDeleteProfileData() {
    setClearing(true);
    setError(null);
    setClearNotice(null);
    const res = await apiFetch<{ cleared: unknown; auth_account_deleted: boolean }>(
      '/api/profile',
      { method: 'DELETE' },
    );
    setClearing(false);
    setConfirmClear(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    setProfile(null);
    setFormVersion((v) => v + 1);
    setClearNotice(
      'Data profil, bookmark, dan dokumen CV Anda telah dihapus dari basis data (akun login tetap aktif).',
    );
    notifyAuthChanged();
  }

  return (
    <>
      <ProfileAvatarSection session={session} />

      {showVerified ? (
        <NoticeBanner
          variant="success"
          title="Email berhasil diverifikasi"
          onDismiss={() => setShowVerified(false)}
        >
          Email akunmu sudah terverifikasi.
        </NoticeBanner>
      ) : null}

      {clearNotice ? (
        <NoticeBanner
          variant="warning"
          title="Data Profil Telah Dikosongkan"
          onDismiss={() => setClearNotice(null)}
        >
          {clearNotice}
        </NoticeBanner>
      ) : null}

      {loading ? (
        <LoadingState
          title="Memuat profil..."
          description="Mohon tunggu sebentar."
          lines={4}
          reserved
        />
      ) : error ? (
        <ErrorState
          error={error}
          title="Belum Dapat Memuat Profil"
          onRetry={loadProfile}
          loginRedirectPath="/profile"
        />
      ) : (
        <>
          {!profile ? (
            <EmptyState
              title="Profil Kamu Masih Kosong"
              description="Lengkapi formulir di bawah ini agar kami dapat mencocokkan profilmu dengan lowongan yang relevan dan mempermudah pembuatan CV-mu."
            />
          ) : (() => {
            const summaryStats = [
              {
                key: 'skills',
                label: 'Keahlian',
                count: profile.skills.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                ),
              },
              {
                key: 'education',
                label: 'Pendidikan',
                count: profile.education.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                ),
              },
              {
                key: 'experiences',
                label: 'Pengalaman',
                count: profile.experiences.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                ),
              },
              {
                key: 'projects',
                label: 'Proyek',
                count: profile.projects.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                ),
              },
              {
                key: 'organizations',
                label: 'Organisasi',
                count: profile.organizations.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                ),
              },
              {
                key: 'achievements',
                label: 'Pencapaian',
                count: profile.achievements.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="7" />
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                  </svg>
                ),
              },
              {
                key: 'positions',
                label: 'Posisi Preferensi',
                count: profile.preferences.positions.length,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                ),
              },
            ];
            const filledCount = summaryStats.filter((item) => item.count > 0).length;

            return (
              <section className="profile-summary-card" aria-label="Ringkasan kelengkapan profil">
                <div className="profile-summary-head">
                  <div className="profile-summary-identity">
                    <span className="profile-summary-badge" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <div className="profile-summary-title-wrap">
                      <strong className="profile-summary-name">
                        {profile.full_name || 'Nama Belum Dicantumkan'}
                      </strong>
                      {profile.headline ? (
                        <span className="profile-summary-headline">{profile.headline}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="profile-summary-meta">
                    <span className="profile-summary-progress">
                      {filledCount}/{summaryStats.length} bagian terisi
                    </span>
                    <span className="profile-summary-updated">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Diperbarui: {formatDateTimeId(profile.updated_at)}
                    </span>
                  </div>
                </div>

                <div className="profile-stats-grid">
                  {summaryStats.map((stat) => (
                    <div
                      key={stat.key}
                      className={`profile-stat-tile ${stat.count > 0 ? 'profile-stat-tile--filled' : ''}`}
                    >
                      <span className="profile-stat-icon">{stat.icon}</span>
                      <div className="profile-stat-body">
                        <span className="profile-stat-value">{stat.count}</span>
                        <span className="profile-stat-label">{stat.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          <ProfileEditorForm
            key={formVersion}
            initialRecord={profile}
            mode="full"
            returnTo={returnTo}
            submitLabel="Simpan Perubahan Profil"
            warnOnUnsavedChanges
            onSaved={(saved) => {
              setProfile(saved);
              notifyAuthChanged();
            }}
          />

          {/* Danger Zone: DELETE /api/profile */}
          <section
            className="surface-card"
            style={{ marginTop: 12 }}
            aria-labelledby="danger-zone-heading"
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <h2 id="danger-zone-heading" style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>
                  Kosongkan Data Profil &amp; Aktivitas
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                  Tindakan ini akan menghapus seluruh data profil, daftar lowongan tersimpan, dan
                  dokumen CV milik akunmu.
                </p>
              </div>

              {!confirmClear ? (
                <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
                  Hapus Data Profil...
                </Button>
              ) : (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={clearing}
                    onClick={handleDeleteProfileData}
                  >
                    Ya, Hapus Permanen
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearing}
                    onClick={() => setConfirmClear(false)}
                  >
                    Batal
                  </Button>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default function ProfilePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBanner
        kicker="Akun & Karier"
        title="Profil & Preferensi Kerja"
        subtitle="Kelola riwayat pendidikan, pengalaman kerja, keahlian, portofolio, serta preferensi pencarian kerja milikmu."
        tone="sand"
        imageSrc="/images/banner-profile-vector.svg"
        actions={
          <>
            <Link href="/recommendations" className="btn btn-secondary btn-sm">
              <ButtonText>Lihat Rekomendasi</ButtonText>
            </Link>
            <Link href="/cv" prefetch={false} className="btn btn-outline btn-sm">
              <ButtonText>Buka Studio CV</ButtonText>
            </Link>
          </>
        }
      />

      <AuthGuard title="Masuk untuk Mengakses Profil & Preferensi">
        {(session) => (
          <Suspense fallback={<LoadingState title="Memuat profil..." lines={4} />}>
            <ProfileInner session={session} />
          </Suspense>
        )}
      </AuthGuard>
    </div>
  );
}
