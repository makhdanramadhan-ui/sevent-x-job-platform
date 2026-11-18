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
          <span className="page-kicker">ONBOARDING KANDIDAT · LANGKAH AWAL</span>
          <h1 className="page-title">Siapkan Profil &amp; Preferensi Kerja Anda</h1>
          <p className="page-subtitle">
            Lengkapi identitas dasar, keahlian, dan preferensi lowongan. Data ini disimpan ke{' '}
            <code>/api/profile</code> dan dipakai sebagai dasar pencocokan rekomendasi lowongan
            serta pembuatan CV.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/jobs" className="btn btn-outline btn-sm">
            Lewati ke Feed Lowongan →
          </Link>
        </div>
      </div>

      {completed ? (
        <NoticeBanner variant="success" title="Onboarding Selesai — Profil Tersimpan">
          <p style={{ margin: '0 0 12px' }}>
            Data profil awal Anda telah tersimpan. Anda kini dapat menelusuri feed lowongan,
            memeriksa kecocokan rekomendasi, atau melengkapi rincian portofolio dan organisasi di
            halaman Profil.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/jobs" className="btn btn-primary btn-sm">
              Buka Feed Lowongan →
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
          title="Memuat data profil awal..."
          description="Mengambil status profil Anda dari /api/profile."
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
