'use client';

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useState } from 'react';
import type { JobStatus } from '@/lib/contracts';
import { JOB_STATUS_LABELS } from './api-client';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      {...rest}
    >
      {loading ? <span aria-hidden="true">⟳</span> : null}
      <span>{children}</span>
    </button>
  );
}

export type BadgeVariant =
  | 'neutral'
  | 'open'
  | 'closed'
  | 'warning'
  | 'danger'
  | 'matched'
  | 'missing'
  | 'accent';

export function Badge({
  variant = 'neutral',
  children,
  className = '',
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}) {
  const variantClass = variant === 'neutral' ? '' : `badge-${variant}`;
  return <span className={`badge ${variantClass} ${className}`.trim()}>{children}</span>;
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const variant: BadgeVariant =
    status === 'open' ? 'open' : status === 'closed' ? 'closed' : 'neutral';
  return <Badge variant={variant}>{JOB_STATUS_LABELS[status] ?? status}</Badge>;
}

export type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
};

export function FormField({ id, label, required, hint, error, children }: FormFieldProps) {
  return (
    <div className="form-field">
      <label htmlFor={id} className="form-label">
        <span>{label}</span>
        {required ? <span className="form-required">Wajib</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="form-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="form-error-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export function TextInput({ hasError, className = '', ...rest }: TextInputProps) {
  return (
    <input
      className={`input-control ${hasError ? 'input-control-error' : ''} ${className}`.trim()}
      aria-invalid={hasError || undefined}
      {...rest}
    />
  );
}

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export function TextArea({ hasError, className = '', ...rest }: TextAreaProps) {
  return (
    <textarea
      className={`textarea-control ${hasError ? 'input-control-error' : ''} ${className}`.trim()}
      aria-invalid={hasError || undefined}
      {...rest}
    />
  );
}

export type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export function SelectInput({ hasError, className = '', children, ...rest }: SelectInputProps) {
  return (
    <select
      className={`select-control ${hasError ? 'input-control-error' : ''} ${className}`.trim()}
      aria-invalid={hasError || undefined}
      {...rest}
    >
      {children}
    </select>
  );
}

export type TagListInputProps = {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
  maxItems?: number;
  maxLength?: number;
};

export function TagListInput({
  id,
  label,
  values,
  onChange,
  placeholder = 'Ketik item lalu tekan Tambah atau Enter',
  hint,
  maxItems = 50,
  maxLength = 60,
}: TagListInputProps) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function addItem() {
    setLocalError(null);
    const parts = draft
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;

    const next = [...values];
    for (const part of parts) {
      if (part.length > maxLength) {
        setLocalError(`Setiap item maksimal ${maxLength} karakter.`);
        return;
      }
      if (next.length >= maxItems) {
        setLocalError(`Maksimal ${maxItems} item diperbolehkan.`);
        return;
      }
      const exists = next.some((existing) => existing.toLowerCase() === part.toLowerCase());
      if (!exists) {
        next.push(part);
      }
    }
    onChange(next);
    setDraft('');
  }

  function removeItem(index: number) {
    setLocalError(null);
    onChange(values.filter((_, idx) => idx !== index));
  }

  return (
    <FormField
      id={id}
      label={`${label} (${values.length}/${maxItems})`}
      hint={hint}
      error={localError}
    >
      <div className="tag-editor">
        <div className="tag-input-row">
          <TextInput
            id={id}
            value={draft}
            placeholder={placeholder}
            maxLength={maxLength * 2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button variant="outline" onClick={addItem} disabled={draft.trim().length === 0}>
            Tambah
          </Button>
        </div>
        {values.length > 0 ? (
          <div className="tag-chips" role="list" aria-label={`Daftar ${label}`}>
            {values.map((item, idx) => (
              <span key={`${item}-${idx}`} className="tag-chip" role="listitem">
                <span>{item}</span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => removeItem(idx)}
                  aria-label={`Hapus ${item}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="form-hint">Belum ada item ditambahkan.</p>
        )}
      </div>
    </FormField>
  );
}

export type CheckboxGroupOption<T extends string> = {
  value: T;
  label: string;
};

export function CheckboxGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
  hint,
}: {
  legend: string;
  options: readonly CheckboxGroupOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
  hint?: string;
}) {
  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <fieldset
      style={{
        border: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <legend className="form-label" style={{ marginBottom: 4 }}>
        {legend}
      </legend>
      {hint ? <p className="form-hint">{hint}</p> : null}
      <div className="checkbox-pill-grid">
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label key={opt.value} className="checkbox-pill">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
