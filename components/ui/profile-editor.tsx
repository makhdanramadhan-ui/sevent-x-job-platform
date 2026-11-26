'use client';

import { useRouter } from 'next/navigation';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  type ProfileRecord,
  WORK_MODES,
} from '@/lib/contracts';
import type { ProfileInput } from '@/lib/profile';
import { findCountry } from '@/lib/countries';
import {
  type ApiCallError,
  apiFetch,
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  recordToProfileInput,
  sanitizeProfilePayload,
  WORK_MODE_LABELS,
} from './api-client';
import { ErrorState, NoticeBanner } from './feedback';
import {
  Button,
  FormField,
  TextArea,
  TextInput,
} from './forms';
import { SkillComboboxInput } from './skill-combobox';
import { CatalogComboboxInput } from './catalog-combobox';

const WORK_MODE_OPTIONS = WORK_MODES.filter((m) => m !== 'unknown').map((value) => ({
  value,
  label: WORK_MODE_LABELS[value],
}));

const EMPLOYMENT_TYPE_OPTIONS = EMPLOYMENT_TYPES.filter((t) => t !== 'unknown').map((value) => ({
  value,
  label: EMPLOYMENT_TYPE_LABELS[value],
}));

const EXPERIENCE_LEVEL_OPTIONS = EXPERIENCE_LEVELS.filter((l) => l !== 'unknown').map((value) => ({
  value,
  label: EXPERIENCE_LEVEL_LABELS[value],
}));

function PreferenceMultiDropdown<T extends string>({
  id,
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: Array<{ value: T; label: string }>;
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  function toggleOption(value: T) {
    const exists = selected.includes(value);
    const next = exists ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(next);
  }

  const allSelected = options.length > 0 && selected.length === options.length;
  const firstLabel =
    selected.length > 0
      ? (options.find((opt) => opt.value === selected[0])?.label ?? selected[0])
      : '';
  const summaryText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? firstLabel
        : `${firstLabel} +${selected.length - 1} lainnya`;

  return (
    <div className="form-field pref-dropdown-field" ref={wrapRef}>
      <label htmlFor={id} className="form-label">
        <span>{label}</span>
        {selected.length > 0 ? (
          <span className="pref-dropdown-count">{selected.length} dipilih</span>
        ) : null}
      </label>

      <button
        type="button"
        id={id}
        className={`pref-dropdown-trigger ${open ? 'pref-dropdown-trigger--open' : ''}`.trim()}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span
          className={`pref-dropdown-trigger-text ${selected.length === 0 ? 'pref-dropdown-trigger-text--placeholder' : ''}`.trim()}
        >
          {summaryText}
        </span>
        <svg
          className="rec-dropdown-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <>
          <div
            className="rec-dropdown-backdrop"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            className="pref-dropdown-menu"
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
          >
            <div className="pref-dropdown-menu-head">
              <span className="pref-dropdown-menu-title">{label}</span>
              <div className="pref-dropdown-menu-actions">
                <button
                  type="button"
                  className="pref-dropdown-quick-btn"
                  onClick={() => onChange(allSelected ? [] : options.map((opt) => opt.value))}
                >
                  {allSelected ? 'Hapus Pilihan' : 'Pilih Semua'}
                </button>
                <button
                  type="button"
                  className="rec-dropdown-close pref-dropdown-close"
                  aria-label={`Tutup ${label}`}
                  onClick={() => setOpen(false)}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="rec-dropdown-options">
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`pref-dropdown-option ${isSelected ? 'pref-dropdown-option--selected' : ''}`.trim()}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <span
                      className={`pref-dropdown-checkbox ${isSelected ? 'pref-dropdown-checkbox--checked' : ''}`.trim()}
                      aria-hidden="true"
                    >
                      {isSelected ? (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="pref-dropdown-option-label">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

type PendingLeaveAction =
  | { type: 'internal'; href: string }
  | { type: 'external'; href: string }
  | { type: 'back' }
  | { type: 'logout'; proceed: () => void };

function normalizeOpt(val: string | null | undefined): string | null {
  if (val === undefined || val === null) return null;
  return val.length > 0 ? val : null;
}

function serializeDraftForCompare(input: ProfileInput): string {
  return JSON.stringify({
    full_name: normalizeOpt(input.full_name),
    headline: normalizeOpt(input.headline),
    phone: normalizeOpt(input.phone),
    location: normalizeOpt(input.location),
    links: input.links.map((item) => ({
      label: item.label ?? '',
      url: item.url ?? '',
    })),
    skills: input.skills,
    education: input.education.map((item) => ({
      institution: item.institution ?? '',
      degree: normalizeOpt(item.degree),
      field: normalizeOpt(item.field),
      start_date: normalizeOpt(item.start_date),
      end_date: normalizeOpt(item.end_date),
      description: normalizeOpt(item.description),
    })),
    experiences: input.experiences.map((item) => ({
      company: item.company ?? '',
      title: item.title ?? '',
      location: normalizeOpt(item.location),
      start_date: normalizeOpt(item.start_date),
      end_date: normalizeOpt(item.end_date),
      current: Boolean(item.current),
      description: normalizeOpt(item.description),
    })),
    projects: input.projects.map((item) => ({
      name: item.name ?? '',
      url: normalizeOpt(item.url),
      start_date: normalizeOpt(item.start_date),
      end_date: normalizeOpt(item.end_date),
      description: normalizeOpt(item.description),
    })),
    organizations: input.organizations.map((item) => ({
      name: item.name ?? '',
      role: normalizeOpt(item.role),
      start_date: normalizeOpt(item.start_date),
      end_date: normalizeOpt(item.end_date),
      description: normalizeOpt(item.description),
    })),
    achievements: input.achievements.map((item) => ({
      title: item.title ?? '',
      issuer: normalizeOpt(item.issuer),
      date: normalizeOpt(item.date),
      description: normalizeOpt(item.description),
    })),
    preferences: {
      country: input.preferences.country ?? '',
      email_match_alerts: input.preferences.email_match_alerts !== false,
      positions: input.preferences.positions,
      locations: input.preferences.locations,
      levels: input.preferences.levels,
      work_modes: input.preferences.work_modes,
      employment_types: input.preferences.employment_types,
    },
  });
}

export function ProfileEditorForm({
  initialRecord,
  mode = 'full',
  submitLabel = 'Simpan Profil',
  warnOnUnsavedChanges = false,
  returnTo = null,
  onSaved,
}: {
  initialRecord: ProfileRecord | null;
  mode?: 'onboarding' | 'full';
  submitLabel?: string;
  warnOnUnsavedChanges?: boolean;
  returnTo?: string | null;
  onSaved?: (saved: ProfileRecord) => void;
}) {
  const router = useRouter();
  const [baseline, setBaseline] = useState<ProfileInput>(() => recordToProfileInput(initialRecord));
  const [draft, setDraft] = useState<ProfileInput>(() => recordToProfileInput(initialRecord));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<ApiCallError | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [countryNotice, setCountryNotice] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingLeaveAction | null>(null);
  const [cvExtraOpen, setCvExtraOpen] = useState(
    () =>
      draft.experiences.length > 0 ||
      draft.organizations.length > 0 ||
      draft.achievements.length > 0,
  );

  const formRef = useRef<HTMLFormElement | null>(null);
  const baselineSerialized = useMemo(() => serializeDraftForCompare(baseline), [baseline]);
  const isDirty = useMemo(
    () => serializeDraftForCompare(draft) !== baselineSerialized,
    [draft, baselineSerialized],
  );

  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const bypassGuardRef = useRef(false);
  const hasSentinelRef = useRef(false);

  const executePendingAction = useCallback(
    (action: PendingLeaveAction) => {
      bypassGuardRef.current = true;
      setPendingAction(null);

      if (action.type === 'internal') {
        if (hasSentinelRef.current) {
          hasSentinelRef.current = false;
          router.replace(action.href);
        } else {
          router.push(action.href);
        }
        return;
      }
      if (action.type === 'external') {
        window.location.assign(action.href);
        return;
      }
      if (action.type === 'back') {
        hasSentinelRef.current = false;
        window.history.go(-2);
        return;
      }
      hasSentinelRef.current = false;
      action.proceed();
    },
    [router],
  );

  useEffect(() => {
    if (!warnOnUnsavedChanges) return;
    if (isDirty && !hasSentinelRef.current && !bypassGuardRef.current) {
      window.history.pushState(
        { ...(window.history.state ?? {}), __rakitkarierProfileGuard: true },
        '',
        window.location.href,
      );
      hasSentinelRef.current = true;
    }
  }, [warnOnUnsavedChanges, isDirty]);

  useEffect(() => {
    if (!warnOnUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    }

    function handlePopState() {
      if (bypassGuardRef.current) return;
      if (isDirtyRef.current) {
        window.history.pushState(
          { ...(window.history.state ?? {}), __rakitkarierProfileGuard: true },
          '',
          window.location.href,
        );
        hasSentinelRef.current = true;
        setPendingAction({ type: 'back' });
        return;
      }
      if (hasSentinelRef.current) {
        hasSentinelRef.current = false;
        bypassGuardRef.current = true;
        window.history.back();
      }
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref || rawHref.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (url.origin === window.location.origin) {
        setPendingAction({
          type: 'internal',
          href: `${url.pathname}${url.search}${url.hash}`,
        });
      } else {
        setPendingAction({ type: 'external', href: url.href });
      }
    }

    function handleBeforeLogout(event: Event) {
      if (!isDirtyRef.current || bypassGuardRef.current) return;
      const customEvent = event as CustomEvent<{ proceed?: () => void }>;
      const proceed = customEvent.detail?.proceed;
      if (!proceed) return;
      event.preventDefault();
      setPendingAction({ type: 'logout', proceed });
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('seventx:before-logout', handleBeforeLogout);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('seventx:before-logout', handleBeforeLogout);
    };
  }, [warnOnUnsavedChanges]);

  useEffect(() => {
    if (!pendingAction) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !savingRef.current) {
        setPendingAction(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction]);

  async function submitProfile(): Promise<boolean> {
    setClientError(null);
    setApiError(null);
    setSuccessMsg(null);

    const payload = sanitizeProfilePayload(draft);
    if (!payload.preferences.country) {
      setClientError('Negara wajib dipilih.');
      return false;
    }
    if (payload.preferences.locations.length < 1) {
      setClientError('Pilih minimal satu lokasi kerja preferensi.');
      return false;
    }

    // Client-side validation for URLs and dates before sending to server
    for (let i = 0; i < payload.links.length; i += 1) {
      const link = payload.links[i];
      try {
        const parsed = new URL(link.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setClientError(`Tautan #${i + 1} (${link.label}) harus diawali http:// atau https://.`);
          return false;
        }
      } catch {
        setClientError(`URL pada Tautan #${i + 1} (${link.label}) tidak valid.`);
        return false;
      }
    }

    for (let i = 0; i < payload.projects.length; i += 1) {
      const proj = payload.projects[i];
      if (proj.url) {
        try {
          const parsed = new URL(proj.url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            setClientError(`URL Proyek #${i + 1} (${proj.name}) harus diawali http:// atau https://.`);
            return false;
          }
        } catch {
          setClientError(`URL Proyek #${i + 1} (${proj.name}) tidak valid.`);
          return false;
        }
      }
    }

    setSaving(true);
    const res = await apiFetch<ProfileRecord>('/api/profile', {
      method: 'PUT',
      body: payload,
    });
    setSaving(false);

    if (!res.ok) {
      setApiError(res.error);
      return false;
    }

    const savedInput = recordToProfileInput(res.data);
    setDraft(savedInput);
    setBaseline(savedInput);
    setSuccessMsg('Profil dan preferensi berhasil disimpan ke basis data.');
    if (onSaved) {
      onSaved(res.data);
    }
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const saved = await submitProfile();
    if (saved && returnTo) {
      router.push(returnTo);
    }
  }

  async function handleSaveAndLeave() {
    if (!pendingAction) return;
    const action = pendingAction;
    const saved = await submitProfile();
    if (saved) {
      executePendingAction(action);
    } else {
      setPendingAction(null);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleDiscardAndLeave() {
    if (!pendingAction) return;
    const action = pendingAction;
    setDraft(baseline);
    setClientError(null);
    setApiError(null);
    executePendingAction(action);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="form-stack" noValidate>
      {clientError ? (
        <NoticeBanner variant="error" title="Periksa Kembali Isian Formulir" onDismiss={() => setClientError(null)}>
          {clientError}
        </NoticeBanner>
      ) : null}

      {apiError ? (
        <ErrorState error={apiError} title="Gagal Menyimpan Profil" />
      ) : null}

      {successMsg ? (
        <NoticeBanner variant="success" title="Berhasil Disimpan" onDismiss={() => setSuccessMsg(null)}>
          {successMsg}
        </NoticeBanner>
      ) : null}

      {/* 1. Identitas Dasar */}
      <section className="ledger-card" aria-labelledby="section-identity">
        <h2 id="section-identity" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 16 }}>
          Informasi Diri &amp; Ringkasan Singkat
        </h2>
        <div className="form-grid-2">
          <FormField id="profile-full-name" label="Nama Lengkap" hint="Maksimal 120 karakter">
            <TextInput
              id="profile-full-name"
              maxLength={120}
              placeholder="Contoh: Nadia Pratama"
              value={draft.full_name ?? ''}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
            />
          </FormField>

          <FormField id="profile-location" label="Domisili Saat Ini" hint="Kota atau provinsi di Indonesia">
            <TextInput
              id="profile-location"
              maxLength={120}
              placeholder="Contoh: Jakarta Selatan / Bandung / Surabaya"
              value={draft.location ?? ''}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            />
          </FormField>

          <CatalogComboboxInput
            id="profile-country"
            label="Negara"
            type="countries"
            values={draft.preferences.country ? [draft.preferences.country] : []}
            onChange={(next) =>
              setDraft((current) => {
                const code = next[0] ?? '';
                if (code === current.preferences.country) return current;
                const kept = current.preferences.locations.filter((location) => location === 'Remote');
                const dropped = current.preferences.locations.length - kept.length;
                setCountryNotice(
                  dropped > 0
                    ? `${dropped} lokasi dihapus karena tidak sesuai negara baru. Remote tetap dipertahankan.`
                    : null,
                );
                return {
                  ...current,
                  preferences: { ...current.preferences, country: code, locations: kept },
                };
              })
            }
            labelForValue={(code) => findCountry(code)?.name ?? code}
            hint="Pilih negara dari daftar. Indonesia adalah saran pertama."
            multiple={false}
            maxLength={50}
          />

          <FormField id="profile-headline" label="Headline / Fokus Peran" hint="Maksimal 200 karakter">
            <TextInput
              id="profile-headline"
              maxLength={200}
              placeholder="Contoh: Backend Developer · Lulusan Teknik Informatika"
              value={draft.headline ?? ''}
              onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
            />
          </FormField>

          <FormField id="profile-phone" label="Nomor Telepon / Kontak" hint="Opsional, maks. 40 karakter">
            <TextInput
              id="profile-phone"
              maxLength={40}
              placeholder="Contoh: +62 812 3456 7890"
              value={draft.phone ?? ''}
              onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            />
          </FormField>
        </div>
      </section>

      {/* 2. Keahlian & Preferensi Kerja */}
      <section className="ledger-card" aria-labelledby="section-skills-prefs">
        <h2 id="section-skills-prefs" className="font-editorial" style={{ fontSize: '1.3rem', marginBottom: 6 }}>
          Keahlian &amp; Preferensi Pekerjaan
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
          Tambahkan keahlian dan kriteria pekerjaan yang kamu cari agar rekomendasi lowongan lebih
          sesuai dengan minatmu.
        </p>

        <div className="form-stack">
          <SkillComboboxInput
            id="profile-skills"
            label="Daftar Keahlian (Skills)"
            values={draft.skills}
            onChange={(skills) => setDraft({ ...draft, skills })}
            hint="Ketik untuk mencari keahlian, lalu pilih saran atau tekan Enter untuk menambah keahlian khusus."
            maxItems={50}
            maxLength={60}
          />

          <div className="form-grid-2">
            <CatalogComboboxInput
              id="pref-positions"
              label="Posisi yang Diminati"
              type="positions"
              values={draft.preferences.positions}
              onChange={(positions) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, positions },
                })
              }
              hint="Ketik untuk mencari posisi, lalu pilih saran atau tekan Enter untuk menambah posisi lain."
              allowCustom
              maxItems={10}
              maxLength={80}
            />

            <CatalogComboboxInput
              id="pref-locations"
              label="Lokasi Kerja Preferensi"
              type="locations"
              country={draft.preferences.country}
              values={draft.preferences.locations}
              onChange={(locations) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, locations },
                })
              }
              hint="Wajib minimal satu. Pilih kota, provinsi, atau Remote dari daftar negara terpilih."
              maxItems={10}
              maxLength={80}
            />
          </div>
          {countryNotice ? (
            <p role="status" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
              {countryNotice}
            </p>
          ) : null}

          <div className="pref-dropdown-grid">
            <PreferenceMultiDropdown
              id="pref-work-modes"
              label="Mode Kerja"
              placeholder="Pilih mode kerja..."
              options={WORK_MODE_OPTIONS}
              selected={draft.preferences.work_modes}
              onChange={(work_modes) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, work_modes },
                })
              }
            />

            <PreferenceMultiDropdown
              id="pref-employment-types"
              label="Jenis Pekerjaan"
              placeholder="Pilih jenis pekerjaan..."
              options={EMPLOYMENT_TYPE_OPTIONS}
              selected={draft.preferences.employment_types}
              onChange={(employment_types) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, employment_types },
                })
              }
            />

            <PreferenceMultiDropdown
              id="pref-levels"
              label="Tingkat Pengalaman"
              placeholder="Pilih tingkat pengalaman..."
              options={EXPERIENCE_LEVEL_OPTIONS}
              selected={draft.preferences.levels}
              onChange={(levels) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, levels },
                })
              }
            />
          </div>
          <label
            htmlFor="pref-email-match-alerts"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '12px 14px',
              border: '1px solid #dde4ee',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <input
              id="pref-email-match-alerts"
              type="checkbox"
              checked={draft.preferences.email_match_alerts !== false}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  preferences: {
                    ...current.preferences,
                    email_match_alerts: event.target.checked,
                  },
                }))
              }
              style={{ marginTop: 3 }}
            />
            <span>
              <strong style={{ display: 'block', fontSize: '0.92rem' }}>
                Kirim email saat ada lowongan dengan kecocokan ≥70%
              </strong>
              <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
                Kamu bisa berhenti berlangganan lewat tautan di bawah email.
              </span>
            </span>
          </label>
        </div>
      </section>

      {/* 3. Pendidikan */}
      <section className="ledger-card" aria-labelledby="section-education">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div>
            <h2 id="section-education" className="font-editorial" style={{ fontSize: '1.3rem', margin: 0 }}>
              Riwayat Pendidikan
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={draft.education.length >= 20}
            onClick={() =>
              setDraft({
                ...draft,
                education: [
                  ...draft.education,
                  {
                    institution: '',
                    degree: null,
                    field: null,
                    start_date: null,
                    end_date: null,
                    description: null,
                  },
                ],
              })
            }
          >
            + Tambah Pendidikan
          </Button>
        </div>

        {draft.education.length === 0 ? (
          <p className="form-hint">Belum ada riwayat pendidikan ditambahkan.</p>
        ) : (
          <div className="form-stack">
            {draft.education.map((edu, idx) => (
              <div key={idx} className="surface-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <strong className="font-mono" style={{ fontSize: '0.8rem' }}>
                    PENDIDIKAN #{idx + 1}
                  </strong>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        education: draft.education.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    Hapus
                  </Button>
                </div>
                <div className="form-grid-3">
                  <FormField id={`edu-inst-${idx}`} label="Institusi / Universitas" required>
                    <TextInput
                      id={`edu-inst-${idx}`}
                      maxLength={200}
                      placeholder="Contoh: Universitas Indonesia"
                      value={edu.institution}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, institution: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                    />
                  </FormField>
                  <FormField id={`edu-degree-${idx}`} label="Jenjang / Gelar">
                    <TextInput
                      id={`edu-degree-${idx}`}
                      maxLength={200}
                      placeholder="Contoh: S1 / D3 / SMK"
                      value={edu.degree ?? ''}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, degree: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                    />
                  </FormField>
                  <FormField id={`edu-field-${idx}`} label="Bidang Studi">
                    <TextInput
                      id={`edu-field-${idx}`}
                      maxLength={200}
                      placeholder="Contoh: Ilmu Komputer"
                      value={edu.field ?? ''}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, field: e.target.value };
                        setDraft({ ...draft, education: next });
                      }}
                    />
                  </FormField>
                </div>
                <div className="form-grid-2" style={{ marginTop: 12 }}>
                  <FormField id={`edu-start-${idx}`} label="Mulai (YYYY-MM)" hint="Format YYYY-MM">
                    <TextInput
                      id={`edu-start-${idx}`}
                      type="month"
                      value={edu.start_date?.slice(0, 7) ?? ''}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, start_date: e.target.value || null };
                        setDraft({ ...draft, education: next });
                      }}
                    />
                  </FormField>
                  <FormField id={`edu-end-${idx}`} label="Selesai (YYYY-MM)" hint="Format YYYY-MM">
                    <TextInput
                      id={`edu-end-${idx}`}
                      type="month"
                      value={edu.end_date?.slice(0, 7) ?? ''}
                      onChange={(e) => {
                        const next = [...draft.education];
                        next[idx] = { ...edu, end_date: e.target.value || null };
                        setDraft({ ...draft, education: next });
                      }}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {mode === 'full' ? (
        <>
          {/* 4. Tautan Portofolio & Proyek */}
          <section className="ledger-card" aria-labelledby="section-links-projects">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
              <div>
                <h2 id="section-links-projects" className="font-editorial" style={{ fontSize: '1.3rem', margin: 0 }}>
                  Tautan Portofolio &amp; Proyek
                </h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={draft.links.length >= 10}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      links: [...draft.links, { label: '', url: '' }],
                    })
                  }
                >
                  + Tambah Tautan
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={draft.projects.length >= 20}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      projects: [
                        ...draft.projects,
                        {
                          name: '',
                          url: null,
                          start_date: null,
                          end_date: null,
                          description: null,
                        },
                      ],
                    })
                  }
                >
                  + Tambah Proyek
                </Button>
              </div>
            </div>

            {draft.links.length > 0 ? (
              <div className="form-stack" style={{ marginBottom: 18 }}>
                {draft.links.map((link, idx) => (
                  <div key={idx} className="surface-card">
                    <div className="form-grid-2">
                      <FormField id={`link-label-${idx}`} label={`Label Tautan #${idx + 1}`} required>
                        <TextInput
                          id={`link-label-${idx}`}
                          maxLength={60}
                          placeholder="Contoh: GitHub / Portofolio"
                          value={link.label}
                          onChange={(e) => {
                            const next = [...draft.links];
                            next[idx] = { ...link, label: e.target.value };
                            setDraft({ ...draft, links: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`link-url-${idx}`} label="URL Lengkap (https://...)" required>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <TextInput
                            id={`link-url-${idx}`}
                            type="url"
                            placeholder="https://github.com/username"
                            value={link.url}
                            onChange={(e) => {
                              const next = [...draft.links];
                              next[idx] = { ...link, url: e.target.value };
                              setDraft({ ...draft, links: next });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                links: draft.links.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            Hapus
                          </Button>
                        </div>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {draft.projects.length > 0 ? (
              <div className="form-stack">
                {draft.projects.map((proj, idx) => (
                  <div key={idx} className="surface-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <strong className="font-mono" style={{ fontSize: '0.8rem' }}>
                        PROYEK #{idx + 1}
                      </strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            projects: draft.projects.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Hapus
                      </Button>
                    </div>
                    <div className="form-grid-2">
                      <FormField id={`proj-name-${idx}`} label="Nama Proyek" required>
                        <TextInput
                          id={`proj-name-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: Sistem Informasi Inventaris UMKM"
                          value={proj.name}
                          onChange={(e) => {
                            const next = [...draft.projects];
                            next[idx] = { ...proj, name: e.target.value };
                            setDraft({ ...draft, projects: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`proj-url-${idx}`} label="URL Proyek (Opsional)">
                        <TextInput
                          id={`proj-url-${idx}`}
                          type="url"
                          placeholder="https://..."
                          value={proj.url ?? ''}
                          onChange={(e) => {
                            const next = [...draft.projects];
                            next[idx] = { ...proj, url: e.target.value };
                            setDraft({ ...draft, projects: next });
                          }}
                        />
                      </FormField>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <FormField id={`proj-desc-${idx}`} label="Deskripsi Proyek">
                        <TextArea
                          id={`proj-desc-${idx}`}
                          maxLength={4000}
                          placeholder="Teknologi yang dipakai dan masalah yang diselesaikan..."
                          value={proj.description ?? ''}
                          onChange={(e) => {
                            const next = [...draft.projects];
                            next[idx] = { ...proj, description: e.target.value };
                            setDraft({ ...draft, projects: next });
                          }}
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-hint">Belum ada tautan atau proyek portofolio ditambahkan.</p>
            )}
          </section>

        </>
      ) : null}

      {/* 5. Tambahan untuk CV (opsional) */}
      <section className="ledger-card" aria-labelledby="section-cv-extra">
        <button
          type="button"
          className="cv-extra-toggle"
          aria-expanded={cvExtraOpen}
          aria-controls="cv-extra-content"
          onClick={() => setCvExtraOpen((open) => !open)}
        >
          <span className="cv-extra-toggle__copy">
            <span id="section-cv-extra" className="font-editorial cv-extra-toggle__title">
              Tambahan untuk CV (opsional)
            </span>
            <span className="cv-extra-toggle__hint">
              Pengalaman kerja, organisasi, dan pencapaian — tidak wajib diisi.
            </span>
          </span>
          <span className="cv-extra-toggle__icon" aria-hidden="true">
            {cvExtraOpen ? '−' : '+'}
          </span>
        </button>

        <div id="cv-extra-content" className="form-stack cv-extra-content" hidden={!cvExtraOpen}>
          <div className="cv-extra-group">
            <div className="cv-extra-group__header">
              <h3 className="cv-extra-group__title">Pengalaman Kerja &amp; Magang</h3>
              <Button
                variant="outline"
                size="sm"
                disabled={draft.experiences.length >= 20}
                onClick={() =>
                  setDraft({
                    ...draft,
                    experiences: [
                      ...draft.experiences,
                      {
                        company: '',
                        title: '',
                        location: null,
                        start_date: null,
                        end_date: null,
                        current: false,
                        description: null,
                      },
                    ],
                  })
                }
              >
                + Tambah Pengalaman
              </Button>
            </div>

            {draft.experiences.length === 0 ? (
              <p className="form-hint">Belum ada pengalaman kerja atau magang ditambahkan.</p>
            ) : (
              <div className="form-stack">
                {draft.experiences.map((exp, idx) => (
                  <div key={idx} className="surface-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <strong className="font-mono" style={{ fontSize: '0.8rem' }}>
                        PENGALAMAN #{idx + 1}
                      </strong>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            experiences: draft.experiences.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Hapus
                      </Button>
                    </div>
                    <div className="form-grid-3">
                      <FormField id={`exp-title-${idx}`} label="Posisi / Jabatan">
                        <TextInput
                          id={`exp-title-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: Backend Developer Intern"
                          value={exp.title}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, title: e.target.value };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`exp-company-${idx}`} label="Perusahaan / Instansi">
                        <TextInput
                          id={`exp-company-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: PT Nusantara Digital"
                          value={exp.company}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, company: e.target.value };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`exp-loc-${idx}`} label="Lokasi">
                        <TextInput
                          id={`exp-loc-${idx}`}
                          maxLength={120}
                          placeholder="Contoh: Jakarta"
                          value={exp.location ?? ''}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, location: e.target.value };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                    </div>
                    <div className="form-grid-2" style={{ marginTop: 12 }}>
                      <FormField id={`exp-start-${idx}`} label="Mulai (YYYY-MM)">
                        <TextInput
                          id={`exp-start-${idx}`}
                          type="month"
                          value={exp.start_date?.slice(0, 7) ?? ''}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, start_date: e.target.value || null };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`exp-end-${idx}`} label="Selesai (YYYY-MM)">
                        <TextInput
                          id={`exp-end-${idx}`}
                          type="month"
                          disabled={exp.current}
                          value={exp.current ? '' : exp.end_date?.slice(0, 7) ?? ''}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, end_date: e.target.value || null };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                    </div>
                    <label className="checkbox-pill" style={{ marginTop: 10 }}>
                      <input
                        type="checkbox"
                        checked={exp.current}
                        onChange={(e) => {
                          const next = [...draft.experiences];
                          next[idx] = {
                            ...exp,
                            current: e.target.checked,
                            end_date: e.target.checked ? null : exp.end_date,
                          };
                          setDraft({ ...draft, experiences: next });
                        }}
                      />
                      <span>Masih bekerja di sini saat ini</span>
                    </label>
                    <div style={{ marginTop: 12 }}>
                      <FormField id={`exp-desc-${idx}`} label="Deskripsi Tanggung Jawab &amp; Dampak">
                        <TextArea
                          id={`exp-desc-${idx}`}
                          maxLength={4000}
                          placeholder="Ringkasan kontribusi dan pencapaian selama bekerja..."
                          value={exp.description ?? ''}
                          onChange={(e) => {
                            const next = [...draft.experiences];
                            next[idx] = { ...exp, description: e.target.value };
                            setDraft({ ...draft, experiences: next });
                          }}
                        />
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cv-extra-group">
            <div className="cv-extra-group__header">
              <h3 className="cv-extra-group__title">Organisasi</h3>
              <Button
                variant="outline"
                size="sm"
                disabled={draft.organizations.length >= 20}
                onClick={() =>
                  setDraft({
                    ...draft,
                    organizations: [
                      ...draft.organizations,
                      {
                        name: '',
                        role: null,
                        start_date: null,
                        end_date: null,
                        description: null,
                      },
                    ],
                  })
                }
              >
                + Tambah Organisasi
              </Button>
            </div>

            {draft.organizations.length > 0 ? (
              <div className="form-stack">
                {draft.organizations.map((org, idx) => (
                  <div key={idx} className="surface-card">
                    <div className="form-grid-2">
                      <FormField id={`org-name-${idx}`} label="Nama Organisasi">
                        <TextInput
                          id={`org-name-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: Himpunan Mahasiswa Informatika"
                          value={org.name}
                          onChange={(e) => {
                            const next = [...draft.organizations];
                            next[idx] = { ...org, name: e.target.value };
                            setDraft({ ...draft, organizations: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`org-role-${idx}`} label="Peran / Jabatan">
                        <div style={{ display: 'flex', gap: 8 }}>
                          <TextInput
                            id={`org-role-${idx}`}
                            maxLength={200}
                            placeholder="Contoh: Kepala Divisi Riset"
                            value={org.role ?? ''}
                            onChange={(e) => {
                              const next = [...draft.organizations];
                              next[idx] = { ...org, role: e.target.value };
                              setDraft({ ...draft, organizations: next });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                organizations: draft.organizations.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            Hapus
                          </Button>
                        </div>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-hint">Belum ada organisasi ditambahkan.</p>
            )}
          </div>

          <div className="cv-extra-group">
            <div className="cv-extra-group__header">
              <h3 className="cv-extra-group__title">Pencapaian</h3>
              <Button
                variant="outline"
                size="sm"
                disabled={draft.achievements.length >= 20}
                onClick={() =>
                  setDraft({
                    ...draft,
                    achievements: [
                      ...draft.achievements,
                      {
                        title: '',
                        issuer: null,
                        date: null,
                        description: null,
                      },
                    ],
                  })
                }
              >
                + Tambah Pencapaian
              </Button>
            </div>

            {draft.achievements.length > 0 ? (
              <div className="form-stack">
                {draft.achievements.map((ach, idx) => (
                  <div key={idx} className="surface-card">
                    <div className="form-grid-3">
                      <FormField id={`ach-title-${idx}`} label="Judul Pencapaian / Sertifikasi">
                        <TextInput
                          id={`ach-title-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: Finalis Kompetisi Web Development"
                          value={ach.title}
                          onChange={(e) => {
                            const next = [...draft.achievements];
                            next[idx] = { ...ach, title: e.target.value };
                            setDraft({ ...draft, achievements: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`ach-issuer-${idx}`} label="Penyelenggara / Penerbit">
                        <TextInput
                          id={`ach-issuer-${idx}`}
                          maxLength={200}
                          placeholder="Contoh: SEVENT X"
                          value={ach.issuer ?? ''}
                          onChange={(e) => {
                            const next = [...draft.achievements];
                            next[idx] = { ...ach, issuer: e.target.value };
                            setDraft({ ...draft, achievements: next });
                          }}
                        />
                      </FormField>
                      <FormField id={`ach-date-${idx}`} label="Bulan / Tahun (YYYY-MM)">
                        <div style={{ display: 'flex', gap: 8 }}>
                          <TextInput
                            id={`ach-date-${idx}`}
                            type="month"
                            value={ach.date?.slice(0, 7) ?? ''}
                            onChange={(e) => {
                              const next = [...draft.achievements];
                              next[idx] = { ...ach, date: e.target.value || null };
                              setDraft({ ...draft, achievements: next });
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                achievements: draft.achievements.filter((_, i) => i !== idx),
                              })
                            }
                          >
                            Hapus
                          </Button>
                        </div>
                      </FormField>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="form-hint">Belum ada pencapaian ditambahkan.</p>
            )}
          </div>
        </div>
      </section>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {warnOnUnsavedChanges && isDirty ? (
          <span className="unsaved-dirty-pill" role="status">
            Ada perubahan belum disimpan
          </span>
        ) : null}
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          {submitLabel}
        </Button>
      </div>

      {pendingAction ? (
        <div
          className="auth-modal-overlay"
          role="presentation"
          onClick={() => {
            if (!saving) setPendingAction(null);
          }}
        >
          <div
            className="unsaved-modal-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-profile-title"
            aria-describedby="unsaved-profile-desc"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="unsaved-modal-head">
              <div className="unsaved-modal-title-wrap">
                <span className="unsaved-modal-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <h2
                  id="unsaved-profile-title"
                  className="font-editorial"
                  style={{ fontSize: '1.25rem', margin: 0 }}
                >
                  Perubahan Profil Belum Disimpan
                </h2>
              </div>
              <button
                type="button"
                className="auth-modal-close"
                aria-label="Tutup peringatan dan tetap di halaman"
                disabled={saving}
                onClick={() => setPendingAction(null)}
              >
                ✕
              </button>
            </div>

            <p id="unsaved-profile-desc" className="unsaved-modal-desc">
              Kamu telah mengubah atau menghapus data profil yang belum disimpan. Simpan perubahan
              terlebih dahulu sebelum keluar atau berpindah halaman?
            </p>

            <div className="unsaved-modal-actions">
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={saving}
                onClick={handleDiscardAndLeave}
              >
                Buang Perubahan
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={saving}
                onClick={handleSaveAndLeave}
              >
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
