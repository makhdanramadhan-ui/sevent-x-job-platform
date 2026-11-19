'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  type ProfileRecord,
  WORK_MODES,
} from '@/lib/contracts';
import type { ProfileInput } from '@/lib/profile';
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
  CheckboxGroup,
  FormField,
  TagListInput,
  TextArea,
  TextInput,
} from './forms';
import { SkillComboboxInput } from './skill-combobox';

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

export function ProfileEditorForm({
  initialRecord,
  mode = 'full',
  submitLabel = 'Simpan Profil',
  onSaved,
}: {
  initialRecord: ProfileRecord | null;
  mode?: 'onboarding' | 'full';
  submitLabel?: string;
  onSaved?: (saved: ProfileRecord) => void;
}) {
  const [draft, setDraft] = useState<ProfileInput>(() => recordToProfileInput(initialRecord));
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<ApiCallError | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cvExtraOpen, setCvExtraOpen] = useState(
    () =>
      draft.experiences.length > 0 ||
      draft.organizations.length > 0 ||
      draft.achievements.length > 0,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setClientError(null);
    setApiError(null);
    setSuccessMsg(null);

    const payload = sanitizeProfilePayload(draft);

    // Client-side validation for URLs and dates before sending to server
    for (let i = 0; i < payload.links.length; i += 1) {
      const link = payload.links[i];
      try {
        const parsed = new URL(link.url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setClientError(`Tautan #${i + 1} (${link.label}) harus diawali http:// atau https://.`);
          return;
        }
      } catch {
        setClientError(`URL pada Tautan #${i + 1} (${link.label}) tidak valid.`);
        return;
      }
    }

    for (let i = 0; i < payload.projects.length; i += 1) {
      const proj = payload.projects[i];
      if (proj.url) {
        try {
          const parsed = new URL(proj.url);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            setClientError(`URL Proyek #${i + 1} (${proj.name}) harus diawali http:// atau https://.`);
            return;
          }
        } catch {
          setClientError(`URL Proyek #${i + 1} (${proj.name}) tidak valid.`);
          return;
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
      return;
    }

    setDraft(recordToProfileInput(res.data));
    setSuccessMsg('Profil dan preferensi berhasil disimpan ke basis data.');
    if (onSaved) {
      onSaved(res.data);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack" noValidate>
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

          <FormField id="profile-headline" label="Headline / Fokus Peran" hint="Maksimal 200 karakter">
            <TextInput
              id="profile-headline"
              maxLength={200}
              placeholder="Contoh: Frontend Engineer · Lulusan Teknik Informatika"
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
            <TagListInput
              id="pref-positions"
              label="Posisi yang Diminati"
              values={draft.preferences.positions}
              onChange={(positions) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, positions },
                })
              }
              placeholder="Contoh: Software Engineer, Data Analyst"
              maxItems={10}
              maxLength={60}
            />

            <TagListInput
              id="pref-locations"
              label="Lokasi Kerja Preferensi"
              values={draft.preferences.locations}
              onChange={(locations) =>
                setDraft({
                  ...draft,
                  preferences: { ...draft.preferences, locations },
                })
              }
              placeholder="Contoh: Jakarta, Yogyakarta, Remote"
              maxItems={10}
              maxLength={60}
            />
          </div>

          <CheckboxGroup
            legend="Preferensi Mode Kerja (Work Mode)"
            options={WORK_MODE_OPTIONS}
            selected={draft.preferences.work_modes}
            onChange={(work_modes) =>
              setDraft({
                ...draft,
                preferences: { ...draft.preferences, work_modes },
              })
            }
          />

          <CheckboxGroup
            legend="Preferensi Jenis Pekerjaan (Employment Type)"
            options={EMPLOYMENT_TYPE_OPTIONS}
            selected={draft.preferences.employment_types}
            onChange={(employment_types) =>
              setDraft({
                ...draft,
                preferences: { ...draft.preferences, employment_types },
              })
            }
          />

          <CheckboxGroup
            legend="Preferensi Tingkat Pengalaman (Experience Level)"
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
