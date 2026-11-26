'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/components/ui/api-client';
import { ButtonText } from '@/components/ui/button-text';
import type { MatchTierTone, SingleJobMatchResult } from '@/lib/job-match';

type CardState =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'incomplete' }
  | { kind: 'ready'; match: Extract<SingleJobMatchResult, { ready: true }> }
  | { kind: 'error' };

const TONE_COLORS: Record<MatchTierTone, { bar: string; badgeBg: string; badgeText: string }> = {
  high: {
    bar: '#15803d',
    badgeBg: 'rgba(21, 128, 61, 0.12)',
    badgeText: '#166534',
  },
  medium: {
    bar: '#b45309',
    badgeBg: 'rgba(217, 119, 6, 0.14)',
    badgeText: '#92400e',
  },
  low: {
    bar: '#64748b',
    badgeBg: 'rgba(100, 116, 139, 0.14)',
    badgeText: '#475569',
  },
};

export function JobMatchCard({ jobId }: { jobId: string }) {
  const [state, setState] = useState<CardState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });

    apiFetch<SingleJobMatchResult>(`/api/jobs/${jobId}/match`, { method: 'GET' })
      .then((res) => {
        if (!active) return;
        if (!res.ok) {
          if (res.error.status === 401) {
            setState({ kind: 'guest' });
            return;
          }
          setState({ kind: 'error' });
          return;
        }
        if (!res.data.ready) {
          setState({ kind: 'incomplete' });
          return;
        }
        setState({ kind: 'ready', match: res.data });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });

    return () => {
      active = false;
    };
  }, [jobId]);

  if (state.kind === 'error') {
    return null;
  }

  return (
    <section className="ledger-card" aria-labelledby="heading-job-match">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <h2
          id="heading-job-match"
          className="font-editorial"
          style={{ fontSize: '1.15rem', margin: 0 }}
        >
          Kecocokan dengan Profilmu
        </h2>
        {state.kind === 'ready' ? (
          <span
            style={{
              fontSize: '0.76rem',
              fontWeight: 600,
              padding: '3px 9px',
              borderRadius: 999,
              background: TONE_COLORS[state.match.tier_tone].badgeBg,
              color: TONE_COLORS[state.match.tier_tone].badgeText,
              whiteSpace: 'nowrap',
            }}
          >
            {state.match.tier_label}
          </span>
        ) : null}
      </div>

      {state.kind === 'loading' ? (
        <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--p-muted)' }}>
          Menghitung skor kecocokan profilmu...
        </p>
      ) : null}

      {state.kind === 'guest' ? (
        <div>
          <p
            style={{
              margin: '0 0 14px',
              fontSize: '0.86rem',
              color: 'var(--ink-secondary)',
              lineHeight: 1.55,
            }}
          >
            Masuk dan lengkapi profilmu untuk melihat persentase kecocokan serta skill yang perlu
            disiapkan untuk posisi ini.
          </p>
          <Link
            href="/login"
            prefetch={false}
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
          >
            <ButtonText>Masuk untuk Cek Kecocokan</ButtonText>
          </Link>
        </div>
      ) : null}

      {state.kind === 'incomplete' ? (
        <div>
          <p
            style={{
              margin: '0 0 14px',
              fontSize: '0.86rem',
              color: 'var(--ink-secondary)',
              lineHeight: 1.55,
            }}
          >
            Tambahkan minimal skill, pendidikan, atau preferensi posisi di profilmu agar sistem bisa
            menghitung kecocokan lowongan ini.
          </p>
          <Link
            href={`/profile?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
            prefetch={false}
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
          >
            <ButtonText>Lengkapi Profil Sekarang</ButtonText>
          </Link>
        </div>
      ) : null}

      {state.kind === 'ready' ? (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: '2rem',
                fontWeight: 700,
                lineHeight: 1,
                color: TONE_COLORS[state.match.tier_tone].bar,
              }}
            >
              {state.match.score}%
            </span>
            <span style={{ fontSize: '0.84rem', color: 'var(--p-muted)' }}>
              skor kecocokan profil
            </span>
          </div>

          <div
            aria-hidden="true"
            style={{
              height: 8,
              width: '100%',
              borderRadius: 999,
              background: 'rgba(15, 23, 42, 0.08)',
              overflow: 'hidden',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${state.match.score}%`,
                borderRadius: 999,
                background: TONE_COLORS[state.match.tier_tone].bar,
                transition: 'width 300ms ease',
              }}
            />
          </div>

          {state.match.matched.length > 0 ? (
            <div style={{ marginBottom: 12 }}>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#166534',
                }}
              >
                Cocok dengan profilmu ({state.match.matched.length})
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: '0.83rem',
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {state.match.matched.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.match.missing.length > 0 ? (
            <div style={{ marginBottom: 14 }}>
              <p
                style={{
                  margin: '0 0 6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: '#92400e',
                }}
              >
                Perlu dilengkapi ({state.match.missing.length})
              </p>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 18,
                  fontSize: '0.83rem',
                  color: 'var(--ink-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {state.match.missing.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.match.unknown.length > 0 &&
          state.match.matched.length === 0 &&
          state.match.missing.length === 0 ? (
            <p
              style={{
                margin: '0 0 14px',
                fontSize: '0.82rem',
                color: 'var(--p-muted)',
              }}
            >
              {state.match.unknown[0]}
            </p>
          ) : null}

          <Link
            href={`/profile?next=${encodeURIComponent(`/jobs/${jobId}`)}`}
            prefetch={false}
            className="btn btn-outline btn-sm"
            style={{ width: '100%' }}
          >
            <ButtonText>Perbarui Profil &amp; Skill</ButtonText>
          </Link>
        </div>
      ) : null}
    </section>
  );
}
