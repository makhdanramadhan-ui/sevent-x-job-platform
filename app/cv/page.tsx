'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, formatDateTimeId } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ButtonText } from '@/components/ui/button-text';
import { EmptyState, LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Badge, Button } from '@/components/ui/forms';
import { type SessionInfo, useAuthSession } from '@/components/ui/navigation';
import { PageBanner } from '@/components/ui/page-banner';
import type { CvDocument, CvDocumentSummary, ProfileRecord } from '@/lib/contracts';
import { CvImportDialog } from './_components/cv-import-dialog';
import { createDefaultCvContent, getSampleAtsCvContent } from './_lib/cv-defaults';
import { getPresetDefinition } from './_lib/presets';
import './cv-styles.css';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {isDemo ? (
        <NoticeBanner
          variant="warning"
          title="Mode Uji Coba Demo Aktif (Penyimpanan Lokal Browser)"
          onDismiss={onExitDemo}
        >
          Anda sedang menggunakan Studio CV dalam mode pengujian lokal. Data disimpan ke peramban
          (localStorage) sehingga Anda dapat mencoba membuat, mengimpor, dan mengunduh PDF standar
          ATS tanpa login.{' '}
          {onExitDemo ? (
            <button
              type="button"
              onClick={onExitDemo}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                textDecoration: 'underline',
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Kembali ke Mode Akun
            </button>
          ) : null}
        </NoticeBanner>
      ) : null}

      {/* Toolbar Aksi & Pencarian */}
      <div className="cv-dashboard-toolbar">
        {cvList.length > 0 ? (
          <div className="cv-dashboard-search-group">
            <div className="cv-search-wrap">
              <span className="cv-search-icon" aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <input
                type="search"
                className="input-control cv-search-input"
                aria-label="Cari judul dokumen CV"
                placeholder="Cari judul CV..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="cv-doc-count">
              Menampilkan <strong style={{ color: 'var(--p-ink)' }}>{filteredList.length}</strong> dari{' '}
              <strong style={{ color: 'var(--p-ink)' }}>{cvList.length}</strong> dokumen
            </span>
          </div>
        ) : (
          <div style={{ fontSize: '0.9rem', color: 'var(--p-muted)' }}>
            Susun CV 1 kolom rapi, impor berkas lama, atau muat contoh format ATS.
          </div>
        )}

        <div className="cv-dashboard-actions">
          <Button variant="outline" size="md" onClick={handleLoadSampleAtsTemplate} loading={creating}>
            Contoh CV ATS
          </Button>
          <Button variant="outline" size="md" onClick={() => setImportOpen(true)}>
            Impor PDF / DOCX
          </Button>
          <Button variant="primary" size="md" loading={creating} onClick={handleCreateFromScratch}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Buat CV Baru
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
        <LoadingState
          title="Memuat dokumen CV..."
          description="Mohon tunggu sebentar."
          lines={4}
          reserved
        />
      ) : (
        <>
          {filteredList.length === 0 ? (
            <EmptyState
              kicker="Belum Ada Dokumen"
              title={searchQuery.trim() ? 'Dokumen Tidak Ditemukan' : 'Studio CV Anda Masih Kosong'}
              description={
                searchQuery.trim()
                  ? `Tidak ada dokumen CV yang cocok dengan "${searchQuery.trim()}".`
                  : 'Mulai susun CV standar ATS dari data profil, impor berkas CV lama, atau gunakan contoh template ATS.'
              }
              action={
                <div className="cv-empty-actions">
                  <Button
                    variant="primary"
                    size="md"
                    loading={creating}
                    onClick={handleLoadSampleAtsTemplate}
                  >
                    Buka Contoh CV ATS
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
                    Impor CV Lama
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="cv-doc-grid">
              {filteredList.map((cv) => {
                const presetDef = getPresetDefinition(cv.template_version);
                return (
                  <article key={cv.id} className="cv-doc-card">
                    <div>
                      <div className="cv-doc-card__head">
                        <h3 className="cv-doc-card__title">
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
                      <span className="cv-doc-card__meta">
                        Diperbarui: {formatDateTimeId(cv.updated_at)}
                      </span>
                    </div>

                    <div className="cv-doc-card__foot">
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
                        <ButtonText>Buka Editor</ButtonText>
                      </Link>
                    </div>
                  </article>
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
        onImportComplete={() => {
          loadData();
        }}
      />
    </div>
  );
}

export default function CvPage() {
  const { session, loading: authLoading } = useAuthSession();
  const [useDemo, setUseDemo] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageBanner
        kicker="Studio &amp; Dokumen"
        title="Studio CV Standar ATS"
        subtitle="Rancang, kelola, dan ekspor CV 1 kolom rapi yang ramah sistem ATS serta impor berkas lama langsung di browser tanpa AI eksternal."
        tone="sand"
        imageSrc="/images/banner-cv-vector.svg"
        actions={
          <>
            <Link href="/profile" prefetch={false} className="btn btn-outline btn-sm">
              <ButtonText>Profil Akun</ButtonText>
            </Link>
            <Link href="/jobs" prefetch={false} className="btn btn-secondary btn-sm">
              <ButtonText>Cari Lowongan</ButtonText>
            </Link>
          </>
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
          {!authLoading && !session ? (
            <div className="cv-demo-strip">
              <span className="cv-demo-strip__copy">
                <svg
                  className="cv-demo-strip__icon"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  <strong>Belum masuk atau ingin uji coba cepat?</strong> Coba susun dan unduh CV ATS
                  secara lokal tanpa perlu login.
                </span>
              </span>
              <Button variant="primary" size="sm" onClick={() => setUseDemo(true)}>
                Coba Mode Demo
              </Button>
            </div>
          ) : null}

          <AuthGuard title="Masuk untuk Mengakses Studio CV">
            {(activeSession) => <CvDashboardInner session={activeSession} isDemo={false} />}
          </AuthGuard>
        </>
      )}
    </div>
  );
}
