'use client';

import { useState } from 'react';
import { NoticeBanner } from '@/components/ui/feedback';
import { Button } from '@/components/ui/forms';
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

  function triggerPicker() {
    document.getElementById('cv-file-picker')?.click();
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
              <h2
                id="import-dialog-title"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', margin: 0, fontWeight: 600 }}
              >
                Impor Dokumen CV Lama
              </h2>
              <button
                type="button"
                className="auth-modal-close"
                onClick={onClose}
                aria-label="Tutup dialog impor"
                disabled={processing}
              >
                <svg
                  width="18"
                  height="18"
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

            <p style={{ margin: '0 0 16px 0', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
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
              <div className="cv-import-processing">
                <div
                  style={{ display: 'inline-flex', color: 'var(--p-action)', marginBottom: 10 }}
                  aria-hidden="true"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <strong style={{ display: 'block', fontSize: '0.96rem', marginBottom: 6 }}>
                  Sedang Memproses Dokumen...
                </strong>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.84rem',
                    color: 'var(--p-muted)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {stepLabel}
                </p>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className={`cv-import-dropzone${dragActive ? ' cv-import-dropzone--active' : ''}`}
                onClick={triggerPicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerPicker();
                  }
                }}
              >
                <input
                  id="cv-file-picker"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div
                  style={{ display: 'inline-flex', color: 'var(--p-action)', marginBottom: 10 }}
                  aria-hidden="true"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 12 15 15" />
                  </svg>
                </div>
                <strong style={{ display: 'block', fontSize: '0.98rem', marginBottom: 4 }}>
                  Tarik &amp; Lepaskan Berkas di Sini
                </strong>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  atau klik untuk memilih berkas dari komputer (Maksimal 10 MB)
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerPicker();
                  }}
                >
                  Pilih Berkas PDF / DOCX
                </Button>
              </div>
            )}

            <div className="cv-import-note">
              <strong>Keterbatasan &amp; Catatan Penting:</strong>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
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
