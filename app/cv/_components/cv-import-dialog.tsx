'use client';

import { useState } from 'react';
import { Button, NoticeBanner } from '@/components/ui';
import type { ProfileRecord } from '@/lib/contracts';
import { type MappedCvResult, mapRawTextToCv } from '../_lib/cv-mapper';
import { parseDocxFile } from '../_lib/docx-parser';
import { validateImportFile } from '../_lib/file-validator';
import { parsePdfFile } from '../_lib/pdf-parser';
import { CvImportReview } from './cv-import-review';

export function CvImportDialog({
  isOpen,
  onClose,
  currentProfile,
  onImportComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: ProfileRecord | null;
  onImportComplete: (cvId: string) => void;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [stepLabel, setStepLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<{ title: string; desc: string } | null>(null);
  const [mappedResult, setMappedResult] = useState<MappedCvResult | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  if (!isOpen) return null;

  async function processFile(file: File) {
    setErrorMsg(null);
    setProcessing(true);
    setStepLabel('1/3 Memeriksa format dan tanda tangan file...');

    const validation = await validateImportFile(file);
    if (!validation.ok) {
      setProcessing(false);
      setStepLabel(null);
      setErrorMsg({
        title: validation.error,
        desc: validation.details ?? 'Pilih file PDF atau DOCX yang valid.',
      });
      return;
    }

    setUploadedFileName(file.name);
    setStepLabel(`2/3 Mengekstrak teks dari dokumen ${validation.format.toUpperCase()} (100% lokal)...`);

    let extractedText = '';
    let warnings: string[] = [];

    if (validation.format === 'docx') {
      const docxResult = await parseDocxFile(file);
      if (!docxResult.ok) {
        setProcessing(false);
        setStepLabel(null);
        setErrorMsg({
          title: docxResult.error,
          desc: docxResult.details ?? 'Gagal membaca isi dokumen Word.',
        });
        return;
      }
      extractedText = docxResult.text;
    } else {
      const pdfResult = await parsePdfFile(file);
      if (!pdfResult.ok) {
        setProcessing(false);
        setStepLabel(null);
        setErrorMsg({
          title: pdfResult.error,
          desc: pdfResult.details ?? 'Gagal memproses dokumen PDF.',
        });
        return;
      }
      extractedText = pdfResult.text;
      warnings = pdfResult.warnings ?? [];
    }

    setStepLabel('3/3 Menganalisis bagian organisasi, pengalaman, dan keahlian...');

    const mapped = mapRawTextToCv(extractedText, warnings);

    setProcessing(false);
    setStepLabel(null);
    setMappedResult(mapped);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  }

  return (
    <div
      className="auth-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div
        className="auth-modal-dialog"
        style={{ maxWidth: mappedResult ? 880 : 540, width: '100%' }}
      >
        {mappedResult ? (
          <CvImportReview
            mappedResult={mappedResult}
            currentProfile={currentProfile}
            fileName={uploadedFileName}
            onCancel={() => {
              setMappedResult(null);
              setErrorMsg(null);
            }}
            onSuccess={(cvId) => {
              onImportComplete(cvId);
              onClose();
            }}
          />
        ) : (
          <div>
            <div className="auth-modal-header">
              <h2 id="import-dialog-title" style={{ fontSize: '1.3rem', margin: 0, fontWeight: 700 }}>
                Impor Dokumen CV Lama
              </h2>
              <button
                type="button"
                className="auth-modal-close"
                onClick={onClose}
                aria-label="Tutup dialog impor"
                disabled={processing}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px 0', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
              Unggah CV Anda dalam format <strong>PDF (berbasis teks)</strong> atau{' '}
              <strong>DOCX (Word)</strong>. Seluruh proses pembacaan berjalan{' '}
              <strong style={{ color: 'var(--status-open)' }}>100% lokal di browser Anda</strong> tanpa
              mengirim file atau teks pribadi ke server maupun pihak ketiga.
            </p>

            {errorMsg ? (
              <NoticeBanner
                variant="error"
                title={errorMsg.title}
                onDismiss={() => setErrorMsg(null)}
              >
                {errorMsg.desc}
              </NoticeBanner>
            ) : null}

            {processing ? (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  background: 'var(--p-surface, #f4f4f4)',
                  borderRadius: 'var(--radius-md, 12px)',
                  border: '1.5px dashed var(--border-strong, rgba(0,0,0,0.2))',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: 12 }}>⏳</div>
                <strong style={{ display: 'block', fontSize: '0.95rem', marginBottom: 6 }}>
                  Sedang Memproses Dokumen...
                </strong>
                <p className="font-mono" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  {stepLabel}
                </p>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                style={{
                  border: dragActive
                    ? '2px solid var(--p-accent, #1a4be0)'
                    : '2px dashed var(--border-strong, rgba(0,0,0,0.2))',
                  borderRadius: 'var(--radius-md, 12px)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  background: dragActive ? 'var(--p-accent-soft, #eef2ff)' : 'var(--p-surface, #f4f4f4)',
                  transition: 'background-color 0.15s ease, border-color 0.15s ease',
                  cursor: 'pointer',
                }}
                onClick={() => document.getElementById('cv-file-picker')?.click()}
              >
                <input
                  id="cv-file-picker"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div style={{ fontSize: '2rem', marginBottom: 8 }} aria-hidden="true">
                  📄
                </div>
                <strong style={{ display: 'block', fontSize: '0.98rem', marginBottom: 4 }}>
                  Tarik &amp; Lepaskan Berkas di Sini
                </strong>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                  atau klik untuk memilih berkas dari komputer (Maksimal 10 MB)
                </p>
                <Button variant="outline" size="sm">
                  Pilih Berkas PDF / DOCX
                </Button>
              </div>
            )}

            <div
              style={{
                marginTop: 20,
                padding: '12px 14px',
                background: 'var(--p-surface, #f4f4f4)',
                borderRadius: 'var(--radius-sm, 8px)',
                fontSize: '0.78rem',
                color: 'var(--ink-secondary)',
              }}
            >
              <strong>Keterbatasan &amp; Catatan Penting:</strong>
              <ul style={{ margin: '4px 0 0 0', paddingLeft: 16 }}>
                <li>PDF hasil scan/foto belum didukung karena tidak ada lapisan teks digital.</li>
                <li>Dokumen terlindungi sandi tidak dapat diurai. Buka proteksi terlebih dahulu.</li>
                <li>Format .doc lawas harus disimpan ulang ke .docx sebelum diimpor.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
