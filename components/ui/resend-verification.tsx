'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './api-client';
import { Button } from './forms';

const COOLDOWN_SECONDS = 60;

export function ResendVerificationButton({
  email,
  disabled,
}: {
  email: string;
  disabled?: boolean;
}) {
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  async function handleResend() {
    const trimmed = email.trim();
    if (!trimmed || sending || cooldown > 0 || disabled) return;

    setSending(true);
    setRateLimited(false);
    setSent(false);

    const res = await apiFetch<{ status: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: { email: trimmed },
    });

    setSending(false);

    if (!res.ok) {
      if (res.error.status === 429 || res.error.code === 'rate_limited') {
        setRateLimited(true);
      }
      return;
    }

    setSent(true);
    setCooldown(COOLDOWN_SECONDS);
  }

  const trimmedEmail = email.trim();
  const canSend = Boolean(trimmedEmail) && !sending && cooldown === 0 && !disabled;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={sending}
          disabled={!canSend}
          onClick={handleResend}
        >
          Kirim ulang email verifikasi
        </Button>
        {cooldown > 0 ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }} aria-live="polite">
            Kirim ulang tersedia dalam {cooldown} detik
          </span>
        ) : null}
      </div>
      {rateLimited ? (
        <p className="form-error-text" role="alert" style={{ margin: 0 }}>
          Terlalu sering, coba lagi nanti.
        </p>
      ) : null}
      {sent && cooldown > 0 && !rateLimited ? (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--status-success-fg, #166534)' }} aria-live="polite">
          Jika email terdaftar dan belum diverifikasi, tautan baru telah dikirim.
        </p>
      ) : null}
    </div>
  );
}
