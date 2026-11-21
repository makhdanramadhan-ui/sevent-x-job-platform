'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { type ApiCallError, apiFetch } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ErrorState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { notifyAuthChanged } from '@/components/ui/navigation';
import { PageBanner } from '@/components/ui/page-banner';
import { ProfileEditorForm } from '@/components/ui/profile-editor';
import type { ProfileRecord } from '@/lib/contracts';

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === '1';
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showVerified, setShowVerified] = useState(verified);

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
    <>
      {showVerified ? (
        <NoticeBanner
          variant="success"
          title="Email berhasil diverifikasi"
          onDismiss={() => setShowVerified(false)}
        >
          Akunmu sudah aktif. Kamu bisa melanjutkan pengisian profil.
        </NoticeBanner>
      ) : null}

      {completed ? (
        <NoticeBanner
          variant="success"
          title="Profil Berhasil Disimpan"
          onDismiss={() => setCompleted(false)}
        >
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
          reserved
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
    </>
  );
}

export default function OnboardingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBanner
        kicker="Langkah Awal"
        title="Lengkapi Profil & Preferensi Kerjamu"
        subtitle="Isi informasi dasar, keahlian, dan kriteria pekerjaan yang kamu cari agar kami dapat memberikan rekomendasi lowongan yang sesuai serta memudahkan penyusunan CV-mu."
        tone="sand"
        imageSrc="/images/banner-profile.jpg"
        actions={
          <Link href="/jobs" className="btn btn-outline btn-sm">
            Lihat Lowongan
          </Link>
        }
      />

      <AuthGuard title="Masuk untuk Mengisi Onboarding Profil">
        {() => (
          <Suspense fallback={<LoadingState title="Memuat onboarding..." lines={3} />}>
            <OnboardingInner />
          </Suspense>
        )}
      </AuthGuard>
    </div>
  );
}
