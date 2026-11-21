'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import { proxiedLogoSrc } from '@/lib/logo-proxy';

function getCompanyInitials(company: string): string {
  const words = company
    .replace(/\b(PT|CV|Tbk|Indonesia|Persero|Inc|Ltd|LLC|Corp|GmbH)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    const fallback = company.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 2).toUpperCase();
    return fallback || 'RK';
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isUsableLogoUrl(url?: string | null): url is string {
  if (!url) return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return !/static\.licdn\.com|google\.com\/s2\/favicons|ghost|spacer/i.test(trimmed);
}

export function DetailCompanyLogo({
  company,
  logoUrl,
}: {
  company: string;
  logoUrl?: string | null;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canRenderLogo = isUsableLogoUrl(logoUrl) && failedUrl !== logoUrl;
  const isLoaded = canRenderLogo && loadedUrl === logoUrl;

  return (
    <div
      className="job-feed-card__logo"
      aria-hidden="true"
      title={company}
      style={{
        position: 'relative',
        width: 'clamp(52px, 8vw, 68px)',
        height: 'clamp(52px, 8vw, 68px)',
        borderRadius: 14,
        fontSize: '1.15rem',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <span>{getCompanyInitials(company)}</span>
      {canRenderLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedLogoSrc(logoUrl)}
          alt=""
          width={68}
          height={68}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl ?? null)}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth === 0 || (naturalWidth <= 16 && naturalHeight <= 16)) {
              setFailedUrl(logoUrl ?? null);
              return;
            }
            setLoadedUrl(logoUrl ?? null);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: 6,
            backgroundColor: '#ffffff',
            opacity: isLoaded ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  );
}

export function SourceSiteLogo({ host }: { host: string | null }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = host
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
    : null;

  return (
    <span className="job-source-card__icon" aria-hidden="true">
      {faviconUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedLogoSrc(faviconUrl)}
          alt=""
          width={20}
          height={20}
          loading="lazy"
          decoding="async"
          className="job-source-card__logo-img"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth === 0) {
              setFailed(true);
            }
          }}
        />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      )}
    </span>
  );
}

export function JobDetailTopActions({
  jobId,
  initialBookmarked,
}: {
  jobId: string;
  initialBookmarked: boolean;
}) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [toggling, setToggling] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleToggleBookmark() {
    setToggling(true);
    setNotice(null);

    if (isBookmarked) {
      const res = await apiFetch<{ job_id: string; deleted: boolean }>(
        `/api/bookmarks/${jobId}`,
        { method: 'DELETE' },
      );
      setToggling(false);
      if (!res.ok) {
        setNotice({ type: 'error', text: res.error.message });
        return;
      }
      setIsBookmarked(false);
      setNotice({ type: 'success', text: 'Lowongan dihapus dari daftar tersimpan.' });
    } else {
      const res = await apiFetch<{ job_id: string; saved: boolean }>('/api/bookmarks', {
        method: 'POST',
        body: { job_id: jobId },
      });
      setToggling(false);
      if (!res.ok) {
        setNotice({ type: 'error', text: res.error.message });
        return;
      }
      setIsBookmarked(true);
      setNotice({ type: 'success', text: 'Lowongan berhasil disimpan ke Bookmark.' });
    }
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Link
          href="/jobs"
          prefetch={false}
          className="btn btn-outline btn-sm"
          aria-label="Kembali ke Feed Lowongan"
          title="Kembali ke Feed Lowongan"
          style={{
            width: 38,
            height: 38,
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
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
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </Link>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={toggling}
            aria-busy={toggling || undefined}
            aria-pressed={isBookmarked}
            onClick={handleToggleBookmark}
            className={`btn ${isBookmarked ? 'btn-secondary' : 'btn-outline'} btn-sm`}
          >
            {toggling ? <span aria-hidden="true">⟳</span> : null}
            <ButtonText>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill={isBookmarked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>{isBookmarked ? 'Tersimpan di Bookmark' : 'Simpan Lowongan'}</span>
              </span>
            </ButtonText>
          </button>
        </div>
      </div>

      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className={`state-panel ${notice.type === 'error' ? 'state-panel-error' : ''}`}
          style={{ padding: '12px 16px', margin: 0, fontSize: '0.9rem' }}
        >
          {notice.text}
        </div>
      ) : null}
    </>
  );
}

export function CopySourceUrlButton({ sourceUrl }: { sourceUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sourceUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = sourceUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <button
      type="button"
      className={`job-source-card__url ${copied ? 'job-source-card__url--copied' : ''}`}
      title="Klik untuk menyalin tautan"
      aria-label={copied ? 'Tautan berhasil disalin' : `Salin tautan ${sourceUrl}`}
      onClick={handleCopy}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span className="job-source-card__url-text">{sourceUrl}</span>
      <span className="job-source-card__copy-tag">
        {copied ? (
          <>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Tersalin
          </>
        ) : (
          <>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Salin
          </>
        )}
      </span>
    </button>
  );
}
