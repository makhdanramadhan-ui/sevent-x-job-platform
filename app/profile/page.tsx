'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  type ApiCallError,
  AuthGuard,
  apiFetch,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  formatDateTimeId,
  LoadingState,
  NoticeBanner,
  notifyAuthChanged,
  ProfileEditorForm,
  type SessionInfo,
} from '@/components/ui';
import type { ProfileRecord } from '@/lib/contracts';

function ProfileInner({ session }: { session: SessionInfo }) {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiCallError | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearNotice, setClearNotice] = useState<string | null>(null);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <div>
          <span className="page-kicker">PROFIL &amp; PREFERENSI KANDIDAT</span>
          <h1 className="page-title">Arsip Profil &amp; Preferensi Kerja</h1>
          <p className="page-subtitle">
            Kelola data riwayat pendidikan, pengalaman kerja, keahlian, portofolio, serta
            preferensi pencarian kerja untuk akun{' '}
            <strong className="font-mono">{session.user.email ?? session.user.id}</strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/recommendations" className="btn btn-secondary btn-sm">
            Lihat Rekomendasi →
          </Link>
          <Link href="/cv" className="btn btn-outline btn-sm">
            Buka Studio CV
          </Link>
        </div>
      </div>

      {clearNotice ? (
        <NoticeBanner
          variant="warning"
          title="Data Profil Dikembalikan ke Kondisi Kosong"
          onDismiss={() => setClearNotice(null)}
        >
          {clearNotice}
        </NoticeBanner>
      ) : null}

      {loading ? (
        <LoadingState
          title="Memuat profil kandidat..."
          description="Mengambil data profil dan preferensi Anda dari /api/profile."
          lines={4}
        />
      ) : error ? (
        <ErrorState
          error={error}
          title="Gagal Memuat Profil"
          onRetry={loadProfile}
          loginRedirectPath="/profile"
        />
      ) : (
        <>
          {!profile ? (
            <EmptyState
              kicker="STATUS PROFIL · BELUM TERISI"
              title="Profil Kandidat Masih Kosong"
              description="Anda belum menyimpan data profil di basis data. Isi formulir di bawah ini atau gunakan panduan Onboarding agar sistem rekomendasi dan pembuat CV memiliki data acuan yang akurat."
              action={
                <Link href="/onboarding" className="btn btn-primary btn-sm">
                  Gunakan Mode Onboarding Cepat →
                </Link>
              }
            />
          ) : (
            <section className="surface-card" aria-label="Ringkasan kelengkapan profil">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>
                    {profile.full_name || 'Nama Belum Dicantumkan'}
                  </strong>
                  {profile.headline ? (
                    <span style={{ color: 'var(--ink-secondary)', marginLeft: 10, fontSize: '0.9rem' }}>
                      — {profile.headline}
                    </span>
                  ) : null}
                </div>
                <span className="job-timestamp">
                  Diperbarui: {formatDateTimeId(profile.updated_at)}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Badge variant={profile.skills.length > 0 ? 'open' : 'warning'}>
                  {profile.skills.length} Keahlian
                </Badge>
                <Badge variant={profile.education.length > 0 ? 'open' : 'neutral'}>
                  {profile.education.length} Pendidikan
                </Badge>
                <Badge variant={profile.experiences.length > 0 ? 'open' : 'neutral'}>
                  {profile.experiences.length} Pengalaman Kerja
                </Badge>
                <Badge variant="neutral">{profile.projects.length} Proyek</Badge>
                <Badge variant="neutral">{profile.organizations.length} Organisasi</Badge>
                <Badge variant="neutral">{profile.achievements.length} Pencapaian</Badge>
                <Badge
                  variant={
                    profile.preferences.positions.length > 0 ||
                    profile.preferences.work_modes.length > 0
                      ? 'open'
                      : 'warning'
                  }
                >
                  {profile.preferences.positions.length} Posisi Preferensi
                </Badge>
              </div>
            </section>
          )}

          <ProfileEditorForm
            key={formVersion}
            initialRecord={profile}
            mode="full"
            submitLabel="Simpan Perubahan Profil"
            onSaved={(saved) => {
              setProfile(saved);
              notifyAuthChanged();
            }}
          />

          {/* Danger Zone: DELETE /api/profile */}
          <section
            className="surface-card"
            style={{ borderColor: 'var(--status-danger-border)', marginTop: 12 }}
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
                <span className="page-kicker" style={{ color: 'var(--status-danger)' }}>
                  MANAJEMEN PRIVASI DATA
                </span>
                <h2 id="danger-zone-heading" style={{ fontSize: '1.1rem', margin: '0 0 4px' }}>
                  Bersihkan Seluruh Data Profil &amp; Aktivitas
                </h2>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                  Tindakan ini akan menghapus seluruh data profil, daftar lowongan tersimpan, dan
                  dokumen CV milik akun Anda secara permanen.
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
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard title="Masuk untuk Mengakses Profil & Preferensi">
      {(session) => <ProfileInner session={session} />}
    </AuthGuard>
  );
}
