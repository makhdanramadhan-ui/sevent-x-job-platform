'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch, SITE_NAME } from '@/components/ui/api-client';
import { AuthGuard } from '@/components/ui/auth-guard';
import { ButtonText } from '@/components/ui/button-text';
import { LoadingState, NoticeBanner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/forms';
import type { SessionInfo } from '@/components/ui/navigation';
import type { CvDocument } from '@/lib/contracts';
import { CvPreview } from '../_components/cv-preview';
import { CvSectionForm } from '../_components/cv-section-form';
import { CvSectionReorder } from '../_components/cv-section-reorder';
import { generateContextualEnglishCv } from '../_lib/contextual-translator';
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

function updateDemoDocument(
  id: string,
  title: string,
  template_version: string,
  content: CvContent,
): boolean {
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

type CvEditorSnapshot = {
  title: string;
  templateVersion: string;
  content: CvContent;
};

type PendingLeaveAction =
  | { type: 'internal'; href: string }
  | { type: 'external'; href: string }
  | { type: 'back' }
  | { type: 'logout'; proceed: () => void };

function serializeCvSnapshot(snapshot: CvEditorSnapshot): string {
  return JSON.stringify({
    title: snapshot.title,
    templateVersion: snapshot.templateVersion,
    content: snapshot.content,
  });
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
  const [baseline, setBaseline] = useState<CvEditorSnapshot | null>(null);
  const [activeSection, setActiveSection] = useState<CvSectionId>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingLeaveAction | null>(null);

  const baselineSerialized = useMemo(
    () => (baseline ? serializeCvSnapshot(baseline) : null),
    [baseline],
  );
  const isDirty = useMemo(() => {
    if (!content || baselineSerialized === null) return false;
    return (
      serializeCvSnapshot({
        title,
        templateVersion,
        content,
      }) !== baselineSerialized
    );
  }, [title, templateVersion, content, baselineSerialized]);

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const bypassGuardRef = useRef(false);
  const hasSentinelRef = useRef(false);

  const executePendingAction = useCallback(
    (action: PendingLeaveAction) => {
      bypassGuardRef.current = true;
      setPendingAction(null);

      if (action.type === 'internal') {
        if (hasSentinelRef.current) {
          hasSentinelRef.current = false;
          router.replace(action.href);
        } else {
          router.push(action.href);
        }
        return;
      }
      if (action.type === 'external') {
        window.location.assign(action.href);
        return;
      }
      if (action.type === 'back') {
        hasSentinelRef.current = false;
        window.history.go(-2);
        return;
      }
      hasSentinelRef.current = false;
      action.proceed();
    },
    [router],
  );

  useEffect(() => {
    if (isDirty) {
      setSuccessNotice(null);
    }
  }, [isDirty]);

  useEffect(() => {
    if (isDirty && !hasSentinelRef.current && !bypassGuardRef.current) {
      window.history.pushState(
        { ...(window.history.state ?? {}), __rakitkarierCvGuard: true },
        '',
        window.location.href,
      );
      hasSentinelRef.current = true;
    }
  }, [isDirty]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function handlePopState() {
      if (bypassGuardRef.current) return;
      if (isDirtyRef.current) {
        window.history.pushState(
          { ...(window.history.state ?? {}), __rakitkarierCvGuard: true },
          '',
          window.location.href,
        );
        hasSentinelRef.current = true;
        setPendingAction({ type: 'back' });
        return;
      }
      if (hasSentinelRef.current) {
        hasSentinelRef.current = false;
        bypassGuardRef.current = true;
        window.history.back();
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (url.origin === window.location.origin) {
        setPendingAction({
          type: 'internal',
          href: `${url.pathname}${url.search}${url.hash}`,
        });
      } else {
        setPendingAction({ type: 'external', href: url.href });
      }
    }

    function handleBeforeLogout(event: Event) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      const customEvent = event as CustomEvent<{ proceed?: () => void }>;
      const proceed = customEvent.detail?.proceed;
      if (!proceed) return;
      event.preventDefault();
      setPendingAction({ type: 'logout', proceed });
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('seventx:before-logout', handleBeforeLogout);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('seventx:before-logout', handleBeforeLogout);
    };
  }, []);

  useEffect(() => {
    if (!pendingAction) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !savingRef.current) {
        setPendingAction(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction]);

  useEffect(() => {
    if (content && !content.section_order.includes(activeSection)) {
      setActiveSection(content.section_order[0] ?? 'profile');
    }
  }, [content, activeSection]);

  useEffect(() => {
    if (!doc && loading) return;
    const cleanTitle = title.trim();
    document.title = cleanTitle ? `${cleanTitle} - ${SITE_NAME}` : `Editor CV - ${SITE_NAME}`;
  }, [doc, loading, title]);

  const loadDocument = useCallback(async () => {
    bypassGuardRef.current = false;
    setLoading(true);
    setApiError(null);
    setBaseline(null);

    if (isDemo || cvId.startsWith('demo-')) {
      const demoDoc = getDemoDocument(cvId);
      if (demoDoc) {
        const loadedTitle = demoDoc.title;
        const loadedTemplate = demoDoc.template_version || 'v1-default';
        const loadedContent = normalizeCvContent(demoDoc.content, session.user.email ?? undefined);
        setDoc(demoDoc);
        setTitle(loadedTitle);
        setTemplateVersion(loadedTemplate);
        setContent(loadedContent);
        setBaseline({
          title: loadedTitle,
          templateVersion: loadedTemplate,
          content: loadedContent,
        });
      } else {
        setApiError('Dokumen uji coba demo tidak ditemukan di penyimpanan browser.');
      }
      setLoading(false);
      return;
    }

    const res = await apiFetch<CvDocument>(`/api/cv/${cvId}`);
    if (res.ok) {
      const loadedTitle = res.data.title;
      const loadedTemplate = res.data.template_version || 'v1-default';
      const loadedContent = normalizeCvContent(res.data.content, session.user.email ?? undefined);
      setDoc(res.data);
      setTitle(loadedTitle);
      setTemplateVersion(loadedTemplate);
      setContent(loadedContent);
      setBaseline({
        title: loadedTitle,
        templateVersion: loadedTemplate,
        content: loadedContent,
      });
    } else {
      setApiError(res.error.message);
    }
    setLoading(false);
  }, [cvId, isDemo, session.user.email]);

  useEffect(() => {
    loadDocument();
  }, [loadDocument]);

  async function handleSave(): Promise<boolean> {
    if (!content) return false;
    setApiError(null);
    setSuccessNotice(null);

    const validation = validateCvPayload({
      title: title.trim(),
      template_version: templateVersion,
      content,
    });

    if (!validation.valid) {
      setApiError(validation.error ?? 'Ukuran dokumen CV melebihi batas 160 KB.');
      return false;
    }

    setSaving(true);
    const normalizedTitle = title.trim() || 'Dokumen CV ATS';

    if (isDemo || cvId.startsWith('demo-')) {
      const ok = updateDemoDocument(cvId, normalizedTitle, templateVersion, content);
      setSaving(false);
      if (ok) {
        setTitle(normalizedTitle);
        setBaseline({
          title: normalizedTitle,
          templateVersion,
          content,
        });
        setSuccessNotice('Perubahan CV berhasil disimpan ke penyimpanan browser (Demo Mode).');
        return true;
      }
      setApiError('Gagal menyimpan ke penyimpanan lokal browser.');
      return false;
    }

    const res = await apiFetch<CvDocument>(`/api/cv/${cvId}`, {
      method: 'PUT',
      body: {
        title: normalizedTitle,
        template_version: templateVersion,
        content,
      },
    });
    setSaving(false);

    if (res.ok) {
      const savedTitle = res.data.title || normalizedTitle;
      const savedTemplate = res.data.template_version || templateVersion;
      const savedContent = normalizeCvContent(res.data.content, session.user.email ?? undefined);
      setDoc(res.data);
      setTitle(savedTitle);
      setTemplateVersion(savedTemplate);
      setContent(savedContent);
      setBaseline({
        title: savedTitle,
        templateVersion: savedTemplate,
        content: savedContent,
      });
      setSuccessNotice('Perubahan CV berhasil disimpan ke basis data.');
      return true;
    }
    setApiError(`Gagal menyimpan: ${res.error.message}`);
    return false;
  }

  async function handleSaveAndLeave() {
    if (!pendingAction) return;
    const action = pendingAction;
    const saved = await handleSave();
    if (saved) {
      executePendingAction(action);
    } else {
      setPendingAction(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleDiscardAndLeave() {
    if (!pendingAction) return;
    const action = pendingAction;
    if (baseline) {
      setTitle(baseline.title);
      setTemplateVersion(baseline.templateVersion);
      setContent(baseline.content);
    }
    setApiError(null);
    executePendingAction(action);
  }

  if (loading) {
    return (
      <LoadingState
        title="Memuat dokumen CV ATS..."
        description="Menyiapkan editor dan pratinjau..."
        lines={5}
        reserved
      />
    );
  }

  if (apiError && !doc) {
    return (
      <div className="state-panel state-panel-error state-panel--reserved" role="alert">
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 8px 0', fontWeight: 600 }}>
          Dokumen Tidak Dapat Dibuka
        </h2>
        <p style={{ margin: '0 0 16px 0', color: 'var(--ink-secondary)' }}>{apiError}</p>
        <Link href="/cv" className="btn btn-primary btn-sm">
          <ButtonText>Kembali ke Studio CV</ButtonText>
        </Link>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Action Bar */}
      <div className="cv-actions-bar">
        <div className="cv-actions-row">
          <div className="cv-actions-left">
            <Link
              href="/cv"
              className="btn btn-outline btn-sm cv-editor-back"
              aria-label="Kembali ke Studio CV"
              title="Kembali ke Studio CV"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <input
              type="text"
              className="cv-title-input"
              aria-label="Judul dokumen CV"
              value={title}
              maxLength={200}
              placeholder="Judul Dokumen CV..."
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="cv-actions-right">
            {isDirty ? (
              <span className="unsaved-dirty-pill cv-unsaved-pill" role="status">
                Ada perubahan belum disimpan
              </span>
            ) : null}
            <Button
              variant={content.language === 'en' ? 'secondary' : 'outline'}
              size="md"
              onClick={() => {
                if (content.language === 'en') {
                  setContent({ ...content, language: 'id' });
                  setSuccessNotice('Bahasa CV dialihkan ke Bahasa Indonesia.');
                } else {
                  const translated = generateContextualEnglishCv(content);
                  setContent(translated);
                  setSuccessNotice(
                    'CV berhasil diterjemahkan ke Bahasa Inggris profesional (English). Judul seksi ATS, tanggal, dan deskripsi kini berbahasa Inggris. Simpan perubahan jika sudah sesuai.',
                  );
                }
              }}
              title={
                content.language === 'en'
                  ? 'Bahasa CV: English (Klik untuk ubah ke Bahasa Indonesia)'
                  : 'Terjemahkan seluruh isi CV ke Bahasa Inggris profesional'
              }
            >
              🌐 {content.language === 'en' ? 'English (Aktif)' : 'Terjemahkan ke English'}
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={() => triggerCvPrint(content.profile.full_name)}
            >
              Unduh PDF (ATS)
            </Button>

            <Button variant="primary" size="md" loading={saving} onClick={() => void handleSave()}>
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

      {/* Mode Switcher untuk Layar Mobile: Editor Isi + Pratinjau Cetak A4 */}
      <div className="cv-mode-toggle" role="group" aria-label="Mode editor dan pratinjau cetak ATS">
        <button
          type="button"
          className="cv-mode-btn cv-mode-btn--active"
          aria-current="true"
        >
          Editor Isi
        </button>
        <button
          type="button"
          className="cv-mode-btn"
          title="Buka pratinjau cetak A4 (tidak otomatis mengunduh)"
          onClick={() => triggerCvPrint(content.profile.full_name)}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Pratinjau ATS
        </button>
      </div>

      {/* Editor & ATS Live Preview Grid Layout */}
      <div className="cv-workspace-grid">
        {/* Kolom Kiri: Editor Form & Pengaturan Urutan */}
        <div
          className="cv-editor-column"
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
            onSelectSection={setActiveSection}
          />
        </div>

        {/* Kolom Kanan: Pratinjau Standar ATS (Desktop live preview & sumber cetak A4) */}
        <div className="cv-preview-column cv-column-hidden-mobile">
          <div className="cv-preview-sticky">
            <CvPreview content={content} />
          </div>
        </div>
      </div>

      {pendingAction ? (
        <div
          className="auth-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!saving) setPendingAction(null);
          }}
        >
          <div
            className="unsaved-modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-cv-title"
            aria-describedby="unsaved-cv-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="unsaved-modal-head">
              <div className="unsaved-modal-title-wrap">
                <span className="unsaved-modal-icon" aria-hidden="true">
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
                  id="unsaved-cv-title"
                  style={{ fontFamily: 'var(--font-display)', fontSize: '1.18rem', margin: 0, fontWeight: 600 }}
                >
                  Perubahan CV Belum Disimpan
                </h2>
              </div>
              <button
                type="button"
                className="auth-modal-close"
                aria-label="Tutup peringatan dan tetap di editor"
                disabled={saving}
                onClick={() => setPendingAction(null)}
              >
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
              </button>
            </div>

            <p id="unsaved-cv-desc" className="unsaved-modal-desc">
              Kamu telah mengubah isi atau pengaturan dokumen CV yang belum disimpan. Simpan perubahan
              terlebih dahulu sebelum keluar atau berpindah halaman?
            </p>

            <div className="unsaved-modal-actions">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={saving}
                onClick={handleDiscardAndLeave}
              >
                Buang Perubahan
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={saving}
                onClick={() => void handleSaveAndLeave()}
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CvEditorPage() {
  const params = useParams();
  const cvId = typeof params?.id === 'string' ? params.id : '';

  return (
    <AuthGuard title="Masuk untuk Mengakses Editor CV ATS">
      {(session) => <CvEditorInner cvId={cvId} session={session} isDemo={false} />}
    </AuthGuard>
  );
}
