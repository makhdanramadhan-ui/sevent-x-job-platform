'use client';

import { type KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { FormField } from './forms';

type SkillSuggestion = {
  id: number;
  name: string;
  category: string;
};

type SkillsResponse = {
  data?: SkillSuggestion[];
};

export type SkillComboboxInputProps = {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  hint?: string;
  maxItems?: number;
  maxLength?: number;
};

function highlightMatch(text: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(trimmed.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + trimmed.length);
  const after = text.slice(idx + trimmed.length);
  return (
    <>
      {before}
      <mark className="skill-combobox-mark">{match}</mark>
      {after}
    </>
  );
}

export function SkillComboboxInput({
  id,
  label,
  values,
  onChange,
  hint,
  maxItems = 50,
  maxLength = 60,
}: SkillComboboxInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
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
    const q = inputValue.trim();
    if (q.length < 1 || q.length > 50) {
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
        const res = await fetch(`/api/skills?q=${encodeURIComponent(q)}&limit=8`, {
          headers: { Accept: 'application/json' },
        });
        if (requestIdRef.current !== currentRequest) return;
        if (!res.ok) {
          setSuggestions([]);
          setHasFetched(true);
          return;
        }
        const json = (await res.json()) as SkillsResponse;
        if (requestIdRef.current !== currentRequest) return;
        const data = Array.isArray(json.data) ? json.data.slice(0, 8) : [];
        setSuggestions(data);
        setHasFetched(true);
      } catch {
        if (requestIdRef.current !== currentRequest) return;
        setSuggestions([]);
        setHasFetched(true);
      } finally {
        if (requestIdRef.current === currentRequest) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [inputValue]);

  function addValue(raw: string) {
    const value = raw.trim();
    if (!value) return false;
    setLocalError(null);
    if (value.length > maxLength) {
      setLocalError(`Setiap keahlian maksimal ${maxLength} karakter.`);
      return false;
    }
    if (values.length >= maxItems) {
      setLocalError(`Maksimal ${maxItems} keahlian diperbolehkan.`);
      return false;
    }
    if (values.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      setInputValue('');
      closeList();
      setHasFetched(false);
      return true;
    }
    onChange([...values, value]);
    setInputValue('');
    setSuggestions([]);
    setHasFetched(false);
    closeList();
    return true;
  }

  function selectSuggestion(index: number) {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    addValue(suggestion.name);
    requestIdRef.current += 1;
  }

  function removeValue(index: number) {
    setLocalError(null);
    onChange(values.filter((_, idx) => idx !== index));
    inputRef.current?.focus();
  }

  const query = inputValue.trim();
  const showList =
    open &&
    (loading || (hasFetched && query.length >= 1) || (query.length >= 1 && suggestions.length > 0));
  const activeOptionId =
    activeIndex >= 0 && suggestions[activeIndex] ? `${listboxId}-option-${suggestions[activeIndex].id}` : undefined;

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        if (suggestions.length > 0) setActiveIndex(0);
        return;
      }
      if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % suggestions.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        if (suggestions.length > 0) setActiveIndex(suggestions.length - 1);
        return;
      }
      if (suggestions.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        selectSuggestion(activeIndex);
        return;
      }
      addValue(inputValue);
      return;
    }
    if (e.key === 'Tab') {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        selectSuggestion(activeIndex);
      }
      return;
    }
    if (e.key === 'Backspace' && inputValue === '' && values.length > 0) {
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
      label={`${label} (${values.length}/${maxItems})`}
      hint={hint}
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
            value={inputValue}
            placeholder={values.length === 0 ? 'Ketik untuk mencari keahlian' : 'Tambah keahlian lain'}
            maxLength={maxLength}
            onChange={(e) => {
              setInputValue(e.target.value);
              setOpen(true);
              setActiveIndex(-1);
              setLocalError(null);
            }}
            onFocus={() => {
              if (blurTimeoutRef.current) window.clearTimeout(blurTimeoutRef.current);
              if (inputValue.trim().length >= 1) setOpen(true);
            }}
            onBlur={() => {
              blurTimeoutRef.current = window.setTimeout(() => {
                closeList();
              }, 120);
            }}
            onKeyDown={handleKeyDown}
          />
          {showList ? (
            <div className="skill-combobox-popover">
              <ul id={listboxId} className="skill-combobox-listbox" role="listbox" aria-label="Saran keahlian">
                {loading ? (
                  <li id={statusId} className="skill-combobox-status" role="status" aria-live="polite">
                    Memuat saran...
                  </li>
                ) : suggestions.length > 0 ? (
                  suggestions.map((suggestion, index) => {
                    const active = index === activeIndex;
                    return (
                      <li
                        key={suggestion.id}
                        id={`${listboxId}-option-${suggestion.id}`}
                        role="option"
                        aria-selected={active}
                        className={`skill-combobox-option${active ? ' is-active' : ''}`}
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
                    );
                  })
                ) : (
                  <li id={statusId} className="skill-combobox-status" role="status" aria-live="polite">
                    Tidak ada saran — tekan Enter untuk menambahkan
                  </li>
                )}
              </ul>
            </div>
          ) : null}
        </div>

        {values.length > 0 ? (
          <div className="tag-chips" role="list" aria-label={`Daftar ${label}`}>
            {values.map((item, idx) => (
              <span key={`${item}-${idx}`} className="tag-chip" role="listitem">
                <span>{item}</span>
                <button
                  type="button"
                  className="tag-chip-remove"
                  onClick={() => removeValue(idx)}
                  aria-label={`Hapus ${item}`}
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
