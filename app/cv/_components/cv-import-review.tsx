'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  apiFetch,
  Button,
  NoticeBanner,
  sanitizeProfilePayload,
} from '@/components/ui';
import type { CvDocument, ProfileRecord } from '@/lib/contracts';
import type { ProfileInput } from '@/lib/profile';
import type { MappedCvResult } from '../_lib/cv-mapper';
import { validateCvPayload } from '../_lib/payload-validator';
import { detectActivePreset } from '../_lib/presets';
import type { CvContent } from '../_lib/types';

export function CvImportReview({
  mappedResult,
  currentProfile,
  fileName,
  onCancel,
  onSuccess,
}: {
  mappedResult: MappedCvResult;
  currentProfile: ProfileRecord | null;
  fileName: string;
  onCancel: () => void;
  onSuccess: (cvId: string) => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState<CvContent>(mappedResult.content);
  const [cvTitle, setCvTitle] = useState(`CV Hasil Impor (${fileName})`);
  const [syncToProfile, setSyncToProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { unmappedLines, confidence } = mappedResult;

  async function handleConfirmImport() {
    setErrorMsg(null);

    const activePreset = detectActivePreset(null, content.section_order);
    const payloadValidation = validateCvPayload({
      title: cvTitle,
      template_version: activePreset,
      content,
    });
    if (!payloadValidation.valid) {
      setErrorMsg(payloadValidation.error ?? 'Ukuran dokumen melebihi batas.');
      return;
    }

    setSubmitting(true);

    try {
      if (syncToProfile) {
        const profilePayload: ProfileInput = sanitizeProfilePayload({
          full_name: content.profile.full_name || currentProfile?.full_name || null,
          headline: content.profile.headline || currentProfile?.headline || null,
          phone: content.profile.phone || currentProfile?.phone || null,
          location: content.profile.location || currentProfile?.location || null,
          links: content.profile.links.length > 0 ? content.profile.links : currentProfile?.links || [],
          skills: content.skills.length > 0 ? content.skills : currentProfile?.skills || [],
          education:
            content.education.length > 0 ? content.education : currentProfile?.education || [],
          experiences:
            content.experiences.length > 0 ? content.experiences : currentProfile?.experiences || [],
          projects: content.projects.length > 0 ? content.projects : currentProfile?.projects || [],
          organizations:
            content.organizations.length > 0
              ? content.organizations
              : currentProfile?.organizations || [],
          achievements:
            content.achievements.length > 0
              ? content.achievements
              : currentProfile?.achievements || [],
          preferences: currentProfile?.preferences || {
            positions: [],
            locations: [],
            levels: [],
            work_modes: [],
            employment_types: [],
          },
        });

        await apiFetch<ProfileRecord>('/api/profile', {
          method: 'PUT',
          body: profilePayload,
        });
      }

      const cvRes = await apiFetch<CvDocument>('/api/cv', {
        method: 'POST',
        body: {
          title: cvTitle.trim() || 'Dokumen CV Baru (ATS)',
          template_version: activePreset,
          content,
        },
      });

      setSubmitting(false);

      if (!cvRes.ok) {
        // Fallback demo mode jika server/auth belum siap
        const demoId = `demo-${Date.now()}`;
        const now = new Date().toISOString();
        const demoDoc: CvDocument = {
          id: demoId,
          title: cvTitle.trim() || 'Dokumen CV Baru (Hasil Impor)',
          template_version: activePreset,
          content,
          created_at: now,
          updated_at: now,
        };
        try {
          const raw = localStorage.getItem('seventx_demo_cv_documents');
          const list = raw ? JSON.parse(raw) : [];
          localStorage.setItem('seventx_demo_cv_documents', JSON.stringify([demoDoc, ...list]));
          onSuccess(demoId);
          router.push(`/cv/${demoId}`);
          return;
        } catch {}

        setErrorMsg(`Gagal membuat CV: ${cvRes.error.message}`);
        return;
      }

      onSuccess(cvRes.data.id);
      router.push(`/cv/${cvRes.data.id}`);
    } catch (err) {
      setSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    }
  }

  return (
    <div className="surface-card" style={{ maxWidth: 840, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <span className="page-kicker">Konfirmasi &amp; Verifikasi Impor</span>
          <h2 style={{ fontSize: '1.4rem', margin: '4px 0', fontWeight: 700 }}>
            Tinjau Hasil Ekstraksi CV
          </h2>
          <p className="page-subtitle" style={{ fontSize: '0.86rem' }}>
            Periksa data yang berhasil diekstraksi dari <strong className="font-mono">{fileName}</strong>.
            Data ini <em>tidak akan menimpa profil lama Anda</em> tanpa persetujuan eksplisit.
          </p>
        </div>
      </div>

      {mappedResult.warnings && mappedResult.warnings.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <NoticeBanner
            variant="warning"
            title="Peringatan Ekstraksi Dokumen"
          >
            {mappedResult.warnings.join(' ')}
          </NoticeBanner>
        </div>
      ) : null}

      {errorMsg ? (
        <NoticeBanner variant="error" title="Gagal Menyimpan" onDismiss={() => setErrorMsg(null)}>
          {errorMsg}
        </NoticeBanner>
      ) : null}

      {/* Ringkasan Keberhasilan Ekstraksi */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 18,
        }}
      >
        <div className="surface-card" style={{ padding: 12 }}>
          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            KONTAK
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>
            {confidence.contactFound ? '✓ Ditemukan' : '⚠️ Belum Lengkap'}
          </div>
        </div>
        <div className="surface-card" style={{ padding: 12 }}>
          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            ORGANISASI
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>
            {content.organizations.length} Entri
          </div>
        </div>
        <div className="surface-card" style={{ padding: 12 }}>
          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            PENDIDIKAN
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>
            {content.education.length} Entri
          </div>
        </div>
        <div className="surface-card" style={{ padding: 12 }}>
          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
            KEAHLIAN
          </span>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: 4 }}>
            {content.skills.length} Keahlian
          </div>
        </div>
      </div>

      {/* Form Judul CV Baru */}
      <div style={{ marginBottom: 18 }}>
        <label className="form-label" htmlFor="import-cv-title">
          <span>Judul Dokumen CV Baru</span>
          <span className="form-required">Wajib</span>
        </label>
        <input
          id="import-cv-title"
          className="input-control"
          value={cvTitle}
          maxLength={200}
          onChange={(e) => setCvTitle(e.target.value)}
          placeholder="Contoh: Dokumen CV ATS Standar"
        />
      </div>

      {/* Ringkasan Data yang Dikenali */}
      <div
        style={{
          background: 'var(--p-surface, #f4f4f4)',
          padding: 16,
          borderRadius: 'var(--radius-sm, 8px)',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
          marginBottom: 18,
          fontSize: '0.88rem',
        }}
      >
        <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', fontWeight: 700 }}>
          Data Utama yang Berhasil Dikenali:
        </h4>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>
            <strong>Nama:</strong> {content.profile.full_name || '—'}
          </li>
          <li>
            <strong>Email:</strong> {content.profile.email || '—'}
          </li>
          <li>
            <strong>Telepon:</strong> {content.profile.phone || '—'}
          </li>
          <li>
            <strong>Domisili:</strong> {content.profile.location || '—'}
          </li>
          <li>
            <strong>Organisasi:</strong>{' '}
            {content.organizations.map((o) => `${o.role || 'Staff'} @ ${o.name}`).join(' | ') ||
              '—'}
          </li>
          <li>
            <strong>Pendidikan:</strong>{' '}
            {content.education.map((e) => e.institution).join(', ') || '—'}
          </li>
          <li>
            <strong>Keahlian:</strong> {content.skills.join(', ') || '—'}
          </li>
        </ul>
      </div>

      {/* Penampung Teks yang Belum Terpetakan */}
      {unmappedLines.length > 0 ? (
        <div
          style={{
            background: 'var(--status-warning-bg)',
            border: '1px solid var(--status-warning-border)',
            borderRadius: 'var(--radius-sm, 8px)',
            padding: 14,
            marginBottom: 18,
          }}
        >
          <strong style={{ fontSize: '0.88rem', color: 'var(--status-warning)' }}>
            Bagian / Teks yang Belum Terpetakan Secara Otomatis ({unmappedLines.length} baris):
          </strong>
          <pre
            style={{
              maxHeight: 120,
              overflowY: 'auto',
              background: '#fff',
              padding: 10,
              borderRadius: 4,
              fontSize: '0.78rem',
              whiteSpace: 'pre-wrap',
              margin: '6px 0 0 0',
            }}
          >
            {unmappedLines.join('\n')}
          </pre>
        </div>
      ) : null}

      {/* Pilihan Sinkronisasi ke Profil Kandidat */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
          paddingTop: 16,
          marginBottom: 20,
        }}
      >
        <label className="checkbox-pill" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={syncToProfile}
            onChange={(e) => setSyncToProfile(e.target.checked)}
          />
          <span style={{ fontSize: '0.88rem' }}>
            <strong>Perbarui juga profil kandidat utama saya</strong> dengan data hasil ekstraksi ini.
          </span>
        </label>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Button variant="outline" onClick={onCancel} disabled={submitting}>
          Batal
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirmImport}
          loading={submitting}
          disabled={!cvTitle.trim()}
        >
          Konfirmasi &amp; Buka Editor CV (ATS) &rarr;
        </Button>
      </div>
    </div>
  );
}
