'use client';

import { useState } from 'react';
import { proxiedLogoSrc } from '@/lib/logo-proxy';

const MONOGRAM_TONES = [
  { color: 'var(--p-action)', background: 'var(--p-accent-soft)', border: 'rgba(26, 75, 224, 0.24)' },
  { color: 'var(--status-open)', background: 'var(--status-open-bg)', border: 'var(--status-open-border)' },
  { color: 'var(--status-warning)', background: 'var(--status-warning-bg)', border: 'var(--status-warning-border)' },
  { color: 'var(--p-ink)', background: 'var(--p-surface)', border: 'var(--border-subtle)' },
] as const;

function companyHash(company: string): number {
  let hash = 0;
  for (let index = 0; index < company.length; index += 1) {
    hash = (hash * 31 + company.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function companyInitials(company: string): string {
  const words = company
    .replace(/\b(PT|CV|Tbk|Indonesia|Persero|Inc|Ltd|LLC|Corp|GmbH)\b\.?/gi, ' ')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return company.replace(/[^\p{L}\p{N}]+/gu, '').slice(0, 2).toUpperCase() || 'RK';
  }
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function isHttpsLogoUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function CompanyLogo({
  company,
  logoUrl,
  className = '',
  size = 40,
  rounded = 10,
}: {
  company: string;
  logoUrl?: string | null;
  className?: string;
  size?: number;
  rounded?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canRenderLogo = isHttpsLogoUrl(logoUrl) && failedUrl !== logoUrl;
  const tone = MONOGRAM_TONES[companyHash(company) % MONOGRAM_TONES.length];

  return (
    <span
      className={`tk-company-logo ${className}`.trim()}
      title={company}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        fontSize: Math.max(11, Math.round(size * 0.32)),
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      {canRenderLogo ? (
        <img
          src={proxiedLogoSrc(logoUrl)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl)}
          onLoad={(event) => {
            if (event.currentTarget.naturalWidth === 0) setFailedUrl(logoUrl);
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            padding: Math.max(3, Math.round(size * 0.12)),
            backgroundColor: '#ffffff',
          }}
        />
      ) : (
        companyInitials(company)
      )}
    </span>
  );
}
