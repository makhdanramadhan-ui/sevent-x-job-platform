'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  AuthGuard,
  Badge,
  Button,
  EmptyState,
  formatDateTimeId,
  LoadingState,
  NoticeBanner,
  PageBanner,
  type SessionInfo,
} from '@/components/ui';
import type { CvDocument, CvDocumentSummary, ProfileRecord } from '@/lib/contracts';
import { CvImportDialog } from './_components/cv-import-dialog';
import { createDefaultCvContent, getSampleAtsCvContent } from './_lib/cv-defaults';
import { getPresetDefinition } from './_lib/presets';

const LOCAL_STORAGE_KEY = 'seventx_demo_cv_documents';

function getDemoDocuments(): CvDocument[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDemoDocuments(docs: CvDocument[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.error('Gagal menyimpan ke localStorage:', err);
  }
}

function CvDashboardInner({
  session,
  isDemo = false,
  onExitDemo,
}: {
  session: SessionInfo;
  isDemo?: boolean;
  onExitDemo?: () => void;
}) {
  const router = useRouter();
  const [cvList, setCvList] = useState<CvDocumentSummary[]>([]);
  const [currentProfile, setCurrentProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemo) {
      const demoDocs = getDemoDocuments();
      setCvList(
        demoDocs.map((d) => ({
          id: d.id,
          title: d.title,
          template_version: d.template_version,
          created_at: d.created_at,
          updated_at: d.updated_at,
        })),
      );
      setLoading(false);
      return;
    }

    const [cvRes, profileRes] = await Promise.all([
      apiFetch<{ items: CvDocumentSummary[] }>('/api/cv'),
      apiFetch<ProfileRecord | null>('/api/profile'),
    ]);

    if (cvRes.ok) {
      setCvList(cvRes.data.items);
    } else {
      setError(cvRes.error.message);
    }

    if (profileRes.ok) {
      setCurrentProfile(profileRes.data);
    }

    setLoading(false);
  }, [isDemo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Buat CV dari data Profil
  async function handleCreateFromScratch() {
    setCreating(true);
    setError(null);

    const initialContent = createDefaultCvContent(
      currentProfile,
      session.user.email ?? undefined,
    );

    const candidateName = currentProfile?.full_name || 'Kandidat';
    const title = `CV ATS ${candidateName}`;

    if (isDemo) {
      const newId = `demo-${Date.now()}`;
      const now = new Date().toISOString();
      const newDoc: CvDocument = {
        id: newId,
        title,
        template_version: 'v1-default',
        content: initialContent,
        created_at: now,
        updated_at: now,
      };
      const existing = getDemoDocuments();
      saveDemoDocuments([newDoc, ...existing]);
      setCreating(false);
      router.push(`/cv/${newId}`);
      return;
    }

    const res = await apiFetch<CvDocument>('/api/cv', {
      method: 'POST',
      body: {
        title,
        template_version: 'v1-default',
        content: initialContent,
      },
    });

    setCreating(false);

    if (res.ok) {
      router.push(`/cv/${res.data.id}`);
    } else {
      setError(`Gagal membuat dokumen CV: ${res.error.message}`);
    }
  }

  // Gunakan Preset Template Contoh Standar ATS
  async function handleLoadSampleAtsTemplate() {
    setCreating(true);
    setError(null);

    const sampleContent = getSampleAtsCvContent();
    const title = 'Contoh Dokumen CV ATS Standar';

    if (isDemo) {
      const newId = `demo-${Date.now()}`;
      const now = new Date().toISOString();
      const newDoc: CvDocument = {
        id: newId,
        title,
        template_version: 'v1-default',
        content: sampleContent,
        created_at: now,
        updated_at: now,
      };
      const existing = getDemoDocuments();
      saveDemoDocuments([newDoc, ...existing]);
      setCreating(false);
      router.push(`/cv/${newId}`);
      return;
    }

    const res = await apiFetch<CvDocument>('/api/cv', {
      method: 'POST',
      body: {
        title,
        template_version: 'v1-default',
        content: sampleContent,
      },
    });

    setCreating(false);

    if (res.ok) {
      router.push(`/cv/${res.data.id}`);
    } else {
      setError(`Gagal membuat dokumen CV: ${res.error.message}`);
    }
  }

  async function handleDeleteCv(id: string) {
    setDeleting(true);

    if (isDemo) {
      const existing = getDemoDocuments();
      saveDemoDocuments(existing.filter((d) => d.id !== id));
      setCvList((prev) => prev.filter((item) => item.id !== id));
      setDeleting(false);
      setDeleteConfirmId(null);
      return;
    }

    const res = await apiFetch(`/api/cv/${id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteConfirmId(null);

    if (res.ok) {
      setCvList((prev) => prev.filter((item) => item.id !== id));
    } else {
      setError(`Gagal menghapus dokumen CV: ${res.error.message}`);
    }
  }

  const filteredList = cvList.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {isDemo ? (
        <NoticeBanner
          variant="warning"
          title="Mode Uji Coba Demo Aktif (Penyimpanan Lokal Browser)"
          onDismiss={onExitDemo}
        >
          Anda sedang menggunakan Studio CV dalam mode pengujian lokal. Data disimpan ke peramban
          (localStorage) sehingga Anda dapat mencoba membuat, mengimpor, menerjemahkan, dan mengunduh
          PDF standar ATS tanpa login.{' '}
          {onExitDemo ? (
            <button
              type="button"
              onClick={onExitDemo}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Kembali ke Mode Akun
            </button>
          ) : null}
        </NoticeBanner>
      ) : null}

      {/* Header Halaman */}
      <div className="page-header">
        <div>
          <span className="page-kicker">Studio &amp; Pemetaan Karier</span>
          <h1 className="page-title">Studio CV Standar ATS</h1>
          <p className="page-subtitle">
            Buat CV berformat ATS profesional (1 kolom, Times New Roman, divider solid, teks dapat diseleksi,
            dan link aktif). Dilengkapi fitur <strong>Auto-Generate Terjemahan Kontekstual</strong> dari
            Bahasa Indonesia ke Bahasa Inggris dengan kaidah resume profesional.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" size="md" onClick={handleLoadSampleAtsTemplate} loading={creating}>
            ⭐ Muat Contoh CV ATS
          </Button>
          <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
            📄 Impor CV (PDF / DOCX)
          </Button>
          <Button variant="primary" size="md" loading={creating} onClick={handleCreateFromScratch}>
            + Buat CV Baru
          </Button>
        </div>
      </div>

      {error ? (
        <NoticeBanner variant="error" title="Perhatian" onDismiss={() => setError(null)}>
          {error}
        </NoticeBanner>
      ) : null}

      {/* Main Content */}
      {loading ? (
        <LoadingState title="Memuat dokumen CV..." description="Mohon tunggu sebentar." lines={4} />
      ) : (
        <>
          {cvList.length > 0 ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ width: '100%', maxWidth: 360 }}>
                <input
                  type="search"
                  className="input-control"
                  placeholder="Cari judul CV..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <span
                className="font-mono"
                style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}
              >
                Menampilkan {filteredList.length} dari {cvList.length} dokumen
              </span>
            </div>
          ) : null}

          {filteredList.length === 0 ? (
            <EmptyState
              kicker="Belum Ada Dokumen"
              title="Studio CV Anda Masih Kosong"
              description="Mulai susun CV standar ATS Anda dari awal, impor file CV lama, atau gunakan preset contoh ATS untuk melihat formatnya."
              action={
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    size="md"
                    loading={creating}
                    onClick={handleLoadSampleAtsTemplate}
                  >
                    ⭐ Buka Contoh CV ATS
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    loading={creating}
                    onClick={handleCreateFromScratch}
                  >
                    Mulai Buat CV Baru
                  </Button>
                  <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
                    Unggah &amp; Impor CV Lama
                  </Button>
                </div>
              }
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {filteredList.map((cv) => {
                const presetDef = getPresetDefinition(cv.template_version);
                return (
                  <div
                    key={cv.id}
                    className="surface-card-interactive"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: 8,
                          marginBottom: 8,
                        }}
                      >
                        <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                          <Link
                            href={`/cv/${cv.id}`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                          >
                            {cv.title}
                          </Link>
                        </h3>
                        <Badge variant={cv.template_version?.includes('custom') ? 'neutral' : 'open'}>
                          {presetDef.shortLabel}
                        </Badge>
                      </div>
                      <span
                        className="font-mono"
                        style={{ fontSize: '0.76rem', color: 'var(--ink-muted)' }}
                      >
                        Diperbarui: {formatDateTimeId(cv.updated_at)}
                      </span>
                    </div>

                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                      paddingTop: 12,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    {deleteConfirmId === cv.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Button
                          variant="danger"
                          size="sm"
                          loading={deleting}
                          onClick={() => handleDeleteCv(cv.id)}
                        >
                          Hapus Permanen
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(null)}>
                          Batal
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirmId(cv.id)}
                        style={{ color: 'var(--status-danger)' }}
                      >
                        Hapus
                      </Button>
                    )}

                    <Link href={`/cv/${cv.id}`} className="btn btn-secondary btn-sm">
                      Buka Editor &amp; Unduh &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {/* Modal Dialog Impor CV */}
      <CvImportDialog
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        currentProfile={currentProfile}
        onImportComplete={(newCvId) => {
          loadData();
        }}
      />
    </div>
  );
}

export default function CvPage() {
  const [useDemo, setUseDemo] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageBanner
        kicker="Studio &amp; Dokumen"
        title="Studio CV Standar ATS Profesional"
        subtitle="Rancang, kelola, dan ekspor CV 1-kolom berstandar internasional dengan terjemahan kontekstual ID/EN dan ekstraksi berkas 100% lokal di browser tanpa AI eksternal."
        tone="sand"
        imageSrc="/images/cv-3d-workspace.jpg"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/profile" prefetch={false} className="btn btn-outline btn-sm">
              &larr; Profil Akun
            </Link>
          </div>
        }
      />

      {useDemo ? (
        <CvDashboardInner
          session={{
            user: {
              id: 'demo-user-123',
              email: 'penguji@seventx.local',
              name: 'Budi Santoso',
              avatar_url: null,
            },
            auth_mode: 'cookie',
            has_profile: true,
          }}
          isDemo={true}
          onExitDemo={() => setUseDemo(false)}
        />
      ) : (
        <>
          <div
            style={{
              background: 'var(--p-surface, #f4f4f4)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
              borderRadius: 'var(--radius-md, 12px)',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: '0.86rem',
            }}
          >
            <span>
              💡 <strong>Belum login atau ingin uji coba cepat?</strong> Anda bisa mencoba format CV ATS
              dan auto-generate terjemahan tanpa login.
            </span>
            <Button variant="primary" size="sm" onClick={() => setUseDemo(true)}>
              Buka Mode Uji Coba Demo (Tanpa Login) &rarr;
            </Button>
          </div>

          <AuthGuard title="Masuk untuk Mengakses Studio CV">
            {(session) => <CvDashboardInner session={session} isDemo={false} />}
          </AuthGuard>
        </>
      )}
    </div>
  );
}
