'use client';

import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { FormField } from './forms';

export type CatalogType = 'positions' | 'locations' | 'countries';

type CatalogSuggestion = {
  id: string;
  name: string;
  category: string;
};

type CatalogResponse = {
  data?: CatalogSuggestion[];
};

export type CatalogComboboxInputProps = {
  id: string;
  label: string;
  type: CatalogType;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  country?: string;
  multiple?: boolean;
  maxItems?: number;
  maxLength?: number;
  labelForValue?: (value: string) => string;
};

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(trimmed.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="skill-combobox-mark">{text.slice(idx, idx + trimmed.length)}</mark>
      {text.slice(idx + trimmed.length)}
    </>
  );
}

export function CatalogComboboxInput({
  id,
  label,
  type,
  values,
  onChange,
  hint,
  country,
  multiple = true,
  maxItems = 10,
  maxLength = 80,
  labelForValue,
}: CatalogComboboxInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<CatalogSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [localError, setLocalError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const listboxId = useId();
  const statusId = useId();

  const disabled = type === 'locations' && !country;

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const query = inputValue.trim();
    if (disabled || (multiple && values.length >= maxItems)) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setLoading(false);
      setHasFetched(false);
      setActiveIndex(-1);
      return;
    }
    if (type !== 'countries' && (query.length < 1 || query.length > 50)) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setLoading(false);
      setHasFetched(false);
      setActiveIndex(-1);
      return;
    }

    const currentRequest = requestIdRef.current + 1;
    requestIdRef.current = currentRequest;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type, limit: '8' });
        if (query) params.set('q', query);
        if (type === 'locations' && country) params.set('country', country);
        const res = await fetch(`/api/catalog?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (requestIdRef.current !== currentRequest) return;
        if (!res.ok) {
          setSuggestions([]);
          setHasFetched(true);
          return;
        }
        const json = (await res.json()) as CatalogResponse;
        if (requestIdRef.current !== currentRequest) return;
        setSuggestions(Array.isArray(json.data) ? json.data.slice(0, 8) : []);
        setHasFetched(true);
      } catch {
        if (requestIdRef.current !== currentRequest) return;
        setSuggestions([]);
        setHasFetched(true);
      } finally {
        if (requestIdRef.current === currentRequest) setLoading(false);
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [inputValue, type, country, disabled, multiple, values.length, maxItems]);

  function selectSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    const value = type === 'countries' ? suggestion.id : suggestion.name;
    setLocalError(null);
    if (multiple) {
      if (values.length >= maxItems) {
        setLocalError(`Maksimal ${maxItems} pilihan diperbolehkan.`);
        return;
      }
      if (!values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
        onChange([...values, value]);
      }
    } else {
      onChange([value]);
    }
    setInputValue('');
    setSuggestions([]);
    setHasFetched(false);
    requestIdRef.current += 1;
    closeList();
    inputRef.current?.focus();
  }

  function removeValue(index: number) {
    setLocalError(null);
    onChange(values.filter((_, idx) => idx !== index));
    inputRef.current?.focus();
  }

  const query = inputValue.trim();
  const showList = !disabled && open && (loading || hasFetched || query.length >= 1);
  const activeOptionId =
    activeIndex >= 0 && suggestions[activeIndex]
      ? `${listboxId}-option-${suggestions[activeIndex].id}`
      : undefined;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(
          suggestions.length > 0
            ? e.key === 'ArrowDown'
              ? 0
              : suggestions.length - 1
            : -1,
        );
        return;
      }
      if (suggestions.length > 0) {
        setActiveIndex((prev) =>
          e.key === 'ArrowDown'
            ? (prev + 1) % suggestions.length
            : prev <= 0
              ? suggestions.length - 1
              : prev - 1,
        );
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(activeIndex);
        return;
      }
      if (loading || !hasFetched || query.length === 0) return;
      if (suggestions.length === 0) setLocalError('Tidak ditemukan — pilih dari daftar.');
      return;
    }
    if (e.key === 'Tab') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        selectSuggestion(activeIndex);
      }
      return;
    }
    if (e.key === 'Backspace' && inputValue === '' && multiple && values.length > 0) {
      e.preventDefault();
      removeValue(values.length - 1);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeList();
    }
  }

  return (
    <FormField
      id={id}
      label={multiple ? `${label} (${values.length}/${maxItems})` : label}
      hint={disabled ? 'Pilih negara terlebih dahulu.' : hint}
      error={localError}
    >
      <div className="tag-editor skill-combobox">
        <div className="skill-combobox-control">
          <input
            ref={inputRef}
            id={id}
            type="text"
            className="input-control"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listboxId}
            aria-activedescendant={showList ? activeOptionId : undefined}
            aria-autocomplete="list"
            aria-describedby={
              showList && (loading || suggestions.length === 0)
                ? statusId
                : hint
                  ? `${id}-hint`
                  : undefined
            }
            autoComplete="off"
            disabled={disabled}
            value={inputValue}
            placeholder={
              disabled
                ? 'Pilih negara terlebih dahulu'
                : type === 'countries'
                  ? values.length > 0
                    ? 'Ganti negara'
                    : 'Cari negara, misalnya Indonesia'
                  : values.length === 0
                    ? type === 'locations'
                      ? 'Cari kota atau provinsi'
                      : 'Cari posisi, misalnya Software Engineer'
                    : 'Tambah pilihan lain'
            }
            maxLength={maxLength}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
              setLocalError(null);
            }}
            onFocus={() => {
              if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
              if (!disabled) setOpen(true);
            }}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => {
                if (!inputValue.trim()) setLocalError(null);
                closeList();
              }, 120);
            }}
            onKeyDown={handleKeyDown}
          />
          {showList ? (
            <div className="skill-combobox-popover">
              <ul
                id={listboxId}
                className="skill-combobox-listbox"
                role="listbox"
                aria-label={`Saran ${label}`}
              >
                {loading ? (
                  <li id={statusId} className="skill-combobox-status" role="status" aria-live="polite">
                    Memuat saran...
                  </li>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`${listboxId}-option-${suggestion.id}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      className={`skill-combobox-option${index === activeIndex ? ' is-active' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(index);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="skill-combobox-option-name">
                        {highlightMatch(suggestion.name, query)}
                      </span>
                      <span className="skill-combobox-option-category">{suggestion.category}</span>
                    </li>
                  ))
                ) : query.length > 0 && hasFetched ? (
                  <li id={statusId} className="skill-combobox-status" role="status" aria-live="polite">
                    Tidak ditemukan — pilih dari daftar
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
        </div>

        {values.length > 0 ? (
          <div className="tag-chips" role="list" aria-label={`Daftar ${label}`}>
            {values.map((item, idx) => (
              <span key={`${item}-${idx}`} className="tag-chip" role="listitem">
                <span>{labelForValue ? labelForValue(item) : item}</span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => removeValue(idx)}
                  aria-label={`Hapus ${labelForValue ? labelForValue(item) : item}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </FormField>
  );
}
