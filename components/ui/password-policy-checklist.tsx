'use client';

import { PASSWORD_RULES, validatePassword } from '@/lib/password-policy';

export function PasswordPolicyChecklist({ password }: { password: string }) {
  const { ok } = validatePassword(password);
  const touched = password.length > 0;

  return (
    <ul
      aria-label="Syarat password"
      style={{
        margin: '8px 0 0',
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        const color = !touched
          ? 'var(--ink-secondary)'
          : passed
            ? 'var(--status-success-fg, #166534)'
            : 'var(--ink-secondary)';
        return (
          <li
            key={rule.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              color,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: passed && touched ? '1px solid var(--status-success-fg, #166534)' : '1px solid var(--border-subtle, #d1d5db)',
                background: passed && touched ? 'var(--status-success-bg, #dcfce7)' : 'transparent',
                fontSize: '0.65rem',
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {passed && touched ? '✓' : ''}
            </span>
            <span>{rule.label}</span>
            <span className="sr-only">{passed && touched ? '(terpenuhi)' : '(belum terpenuhi)'}</span>
          </li>
        );
      })}
      <li className="sr-only" aria-live="polite">
        {touched ? (ok ? 'Semua syarat password terpenuhi.' : 'Syarat password belum terpenuhi.') : ''}
      </li>
    </ul>
  );
}
