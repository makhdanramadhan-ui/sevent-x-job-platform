'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  apiFetch,
  AuthGuard,
  Badge,
  Button,
  LoadingState,
  NoticeBanner,
  type SessionInfo,
} from '@/components/ui';
import type { CvDocument } from '@/lib/contracts';
import { CvPreview } from '../_components/cv-preview';
import { CvSectionForm } from '../_components/cv-section-form';
import { CvSectionReorder } from '../_components/cv-section-reorder';
import { normalizeCvContent } from '../_lib/cv-defaults';
import { triggerCvPrint } from '../_lib/export-helpers';
import { validateCvPayload } from '../_lib/payload-validator';
import type { CvContent, CvSectionId } from '../_lib/types';
import '../cv-styles.css';

const LOCAL_STORAGE_KEY = 'seventx_demo_cv_documents';

function getDemoDocument(id: string): CvDocument | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const list: CvDocument[] = JSON.parse(raw);
    return list.find((item) => item.id === id) ?? null;
  } catch {
    return null;
  }
}

function updateDemoDocument(id: string, title: string, template_version: string, content: CvContent): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: CvDocument[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((item) => item.id === id);
    const now = new Date().toISOString();
    if (index >= 0) {
      list[index] = {
        ...list[index],
        title,
        template_version,
        content,
        updated_at: now,
      };
    } else {
      list.push({
        id,
        title,
        template_version,
        content,
        created_at: now,
        updated_at: now,
      });
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function CvEditorInner({
  cvId,
  session,
  isDemo = false,
}: {
  cvId: string;
  session: SessionInfo;
  isDemo?: boolean;
}) {
  const router = useRouter();
  const [doc, setDoc] = useState<CvDocument | null>(null);
  const [title, setTitle] = useState('');
  const [templateVersion, setTemplateVersion] = useState<string>('v1-default');
  const [content, setContent] = useState<CvContent | null>(null);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [activeSection, setActiveSection] = useState<CvSectionId>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setApiError(null);

    if (isDemo || cvId.startsWith('demo-')) {
      const demoDoc = getDemoDocument(cvId);
      if (demoDoc) {
        setDoc(demoDoc);
        setTitle(demoDoc.title);
        setTemplateVersion(demoDoc.template_version || 'v1-default');
        setContent(normalizeCvContent(demoDoc.content, session.user.email ?? undefined));
      } else {
        setApiError('Dokumen uji coba demo tidak ditemukan di penyimpanan browser.');
      }
      setLoading(false);
      return;
    }

    const res = await apiFetch<CvDocument>(`/api/cv/${cvId}`);
    if (res.ok) {
      setDoc(res.data);
      setTitle(res.data.title);
      setTemplateVersion(res.data.template_version || 'v1-default');
      setContent(normalizeCvContent(res.data.content, session.user.email ?? undefined));
    } else {
      setApiError(res.error.message);
    }
    setLoading(false);
  }, [cvId, isDemo, session.user.email]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  async function handleSave() {
    if (!content) return;
    setApiError(null);
    setSuccessNotice(null);

    const validation = validateCvPayload({
      title: title.trim(),
      template_version: templateVersion,
      content,
    });

    if (!validation.valid) {
      setApiError(validation.error ?? 'Ukuran dokumen CV melebihi batas 160 KB.');
      return;
    }

    setSaving(true);

    if (isDemo || cvId.startsWith('demo-')) {
      const ok = updateDemoDocument(cvId, title.trim() || 'Dokumen CV ATS', templateVersion, content);
      setSaving(false);
      if (ok) {
        setSuccessNotice('Perubahan CV berhasil disimpan ke penyimpanan browser (Demo Mode).');
      } else {
        setApiError('Gagal menyimpan ke penyimpanan lokal browser.');
      }
      return;
    }

    const res = await apiFetch<CvDocument>(`/api/cv/${cvId}`, {
      method: 'PUT',
      body: {
        title: title.trim() || 'Dokumen CV ATS',
        template_version: templateVersion,
        content,
      },
    });
    setSaving(false);

    if (res.ok) {
      setDoc(res.data);
      setSuccessNotice('Perubahan CV berhasil disimpan ke basis data Supabase.');
    } else {
      setApiError(`Gagal menyimpan: ${res.error.message}`);
    }
  }

  const payloadStats = content
    ? validateCvPayload({
        title,
        template_version: templateVersion,
        content,
      })
    : null;

  if (loading) {
    return (
      <LoadingState
        title="Memuat dokumen CV ATS..."
        description="Menyiapkan editor dan pratinjau..."
        lines={5}
      />
    );
  }

  if (apiError && !doc) {
    return (
      <div className="state-panel state-panel-error" role="alert">
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 8px 0', fontWeight: 700 }}>
          Dokumen Tidak Dapat Dibuka
        </h2>
        <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)' }}>{apiError}</p>
        <Link href="/cv" className="btn btn-primary btn-sm">
          &larr; Kembali ke Studio CV
        </Link>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Action Bar */}
      <div className="cv-actions-bar">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/cv" className="btn btn-ghost btn-sm">
              &larr; Kembali
            </Link>
            <input
              type="text"
              className="input-control"
              value={title}
              maxLength={200}
              placeholder="Judul Dokumen CV..."
              style={{
                fontWeight: 700,
                fontSize: '1.05rem',
                border: 'none',
                background: 'transparent',
                padding: '4px 8px',
                borderBottom: '1.5px solid var(--border-subtle, rgba(0,0,0,0.15))',
                borderRadius: 0,
                width: '100%',
                maxWidth: 380,
              }}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button
              variant="outline"
              size="md"
              onClick={() => triggerCvPrint(content.profile.full_name)}
            >
              Unduh PDF (ATS)
            </Button>

            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
              Simpan Perubahan
            </Button>
          </div>
        </div>
      </div>

      {successNotice ? (
        <NoticeBanner
          variant="success"
          title="Berhasil Disimpan"
          onDismiss={() => setSuccessNotice(null)}
        >
          {successNotice}
        </NoticeBanner>
      ) : null}

      {apiError ? (
        <NoticeBanner variant="error" title="Perhatian" onDismiss={() => setApiError(null)}>
          {apiError}
        </NoticeBanner>
      ) : null}

      {/* Mode View Switcher untuk Layar Mobile */}
      <div
        className="cv-mode-toggle"
        style={{
          display: 'none',
          gap: 8,
          background: 'var(--p-surface, #f4f4f4)',
          padding: 4,
          borderRadius: 'var(--radius-sm, 8px)',
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'editor' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab('editor')}
        >
          Editor Isi
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'preview' ? 'btn-secondary' : 'btn-ghost'}`}
          style={{ flex: 1 }}
          onClick={() => setActiveTab('preview')}
        >
          Pratinjau ATS
        </button>
      </div>

      {/* Editor & ATS Live Preview Grid Layout */}
      <div className="cv-workspace-grid">
        {/* Kolom Kiri: Editor Form & Pengaturan Urutan */}
        <div
          className={`cv-editor-column ${activeTab === 'preview' ? 'cv-column-hidden-mobile' : ''}`}
          style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          <CvSectionForm
            content={content}
            onChange={setContent}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          <CvSectionReorder
            content={content}
            onChange={setContent}
            templateVersion={templateVersion}
            onPresetChange={setTemplateVersion}
          />
        </div>

        {/* Kolom Kanan: Pratinjau Standar ATS */}
        <div
          className={`cv-preview-column ${activeTab === 'editor' ? 'cv-column-hidden-mobile' : ''}`}
        >
          <div className="cv-preview-sticky">
            <CvPreview content={content} />
          </div>
        </div>
      </div>


    </div>
  );
}

export default function CvEditorPage() {
  const params = useParams();
  const cvId = typeof params?.id === 'string' ? params.id : '';
  const isDemoDoc = cvId.startsWith('demo-');

  if (isDemoDoc) {
    const demoSession: SessionInfo = {
      user: {
        id: 'demo-user-123',
        email: 'penguji@seventx.local',
        name: 'Budi Santoso',
        avatar_url: null,
      },
      auth_mode: 'cookie',
      has_profile: true,
    };
    return <CvEditorInner cvId={cvId} session={demoSession} isDemo={true} />;
  }

  return (
    <AuthGuard title="Masuk untuk Mengakses Editor CV ATS">
      {(session) => <CvEditorInner cvId={cvId} session={session} isDemo={false} />}
    </AuthGuard>
  );
}
