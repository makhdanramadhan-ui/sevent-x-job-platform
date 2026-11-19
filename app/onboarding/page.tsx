'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  ErrorState,
  LoadingState,
  NoticeBanner,
  notifyAuthChanged,
  ProfileEditorForm,
} from '@/components/ui';
import type { ProfileRecord } from '@/lib/contracts';

function OnboardingInner() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [completed, setCompleted] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiFetch<ProfileRecord | null>('/api/profile');
    if (res.ok) {
      setProfile(res.data);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lengkapi Profil &amp; Preferensi Kerjamu</h1>
          <p className="page-subtitle">
            Isi informasi dasar, keahlian, dan kriteria pekerjaan yang kamu cari agar kami dapat
            memberikan rekomendasi lowongan yang sesuai serta memudahkan penyusunan CV-mu.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn btn-outline btn-sm">
            Lihat Lowongan
          </Link>
        </div>
      </div>

      {completed ? (
        <NoticeBanner variant="success" title="Profil Berhasil Disimpan">
          <p style={{ margin: '0 0 12px' }}>
            Data profilmu sudah tersimpan. Sekarang kamu bisa mulai mencari lowongan, melihat
            rekomendasi yang sesuai, atau melengkapi detail portofolio di halaman Profil.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/jobs" className="btn btn-primary btn-sm">
              Cari Lowongan
            </Link>
            <Link href="/recommendations" className="btn btn-secondary btn-sm">
              Lihat Rekomendasi
            </Link>
            <Link href="/profile" className="btn btn-outline btn-sm">
              Buka Profil Lengkap
            </Link>
          </div>
        </NoticeBanner>
      ) : null}

      {loading ? (
        <LoadingState
          title="Memuat profil..."
          description="Mohon tunggu sebentar."
        />
      ) : error ? (
        <ErrorState
          error={error}
          title="Gagal Memuat Status Profil"
          onRetry={loadProfile}
          loginRedirectPath="/onboarding"
        />
      ) : (
        <ProfileEditorForm
          initialRecord={profile}
          mode="onboarding"
          submitLabel="Simpan Onboarding & Lanjutkan"
          onSaved={(saved) => {
            setProfile(saved);
            setCompleted(true);
            notifyAuthChanged();
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGuard title="Masuk untuk Mengisi Onboarding Profil">
      {() => <OnboardingInner />}
    </AuthGuard>
  );
}
