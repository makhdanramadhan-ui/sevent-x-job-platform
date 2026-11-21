'use client';

import { useState } from 'react';
import {
  Button,
  FormField,
  SkillComboboxInput,
  TagListInput,
  TextArea,
  TextInput,
} from '@/components/ui';
import type { CvContent, CvSectionId } from '../_lib/types';
import { SECTION_LABELS } from '../_lib/types';

export function CvSectionForm({
  content,
  onChange,
  activeSection,
  onSelectSection,
}: {
  content: CvContent;
  onChange: (updated: CvContent) => void;
  activeSection: CvSectionId;
  onSelectSection: (section: CvSectionId) => void;
}) {
  const {
    language = 'en',
    profile,
    summary,
    organizations,
    experiences,
    education,
    achievements,
    skills,
    projects,
  } = content;

  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;

  return (
    <div className="form-stack">
      {/* Tabs Pilihan Bagian */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          background: 'var(--p-surface, #f4f4f4)',
          padding: 6,
          borderRadius: 'var(--radius-md, 12px)',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
        }}
        role="tablist"
        aria-label="Pilih bagian CV untuk diedit"
      >
        {content.section_order.map((secId) => {
          const isActive = activeSection === secId;
          const label = labels[secId] || secId;
          return (
            <button
              key={secId}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => onSelectSection(secId)}
              style={{ fontSize: '0.78rem', padding: '5px 10px' }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 1. PROFIL & IDENTITAS */}
      {activeSection === 'profile' ? (
        <div className="surface-card">
          <h3 style={{ fontSize: '1.15rem', marginBottom: 14, fontWeight: 700 }}>
            Identitas &amp; Kontak (Header CV)
          </h3>
          <div className="form-grid-2">
            <FormField id="cv-full-name" label="Nama Lengkap" required>
              <TextInput
                id="cv-full-name"
                maxLength={120}
                placeholder="Contoh: Budi Santoso"
                value={profile.full_name}
                onChange={(e) =>
                  onChange({
                    ...content,
                    profile: { ...profile, full_name: e.target.value },
                  })
                }
              />
            </FormField>

            <FormField id="cv-location" label="Domisili / Lokasi (Kota, Provinsi)">
              <TextInput
                id="cv-location"
                placeholder="Contoh: Jakarta, Indonesia"
                value={profile.location}
                onChange={(e) =>
                  onChange({
                    ...content,
                    profile: { ...profile, location: e.target.value },
                  })
                }
              />
            </FormField>

            <FormField id="cv-phone" label="Nomor Telepon / Kontak">
              <TextInput
                id="cv-phone"
                placeholder="Contoh: 081234567890"
                value={profile.phone}
                onChange={(e) =>
                  onChange({
                    ...content,
                    profile: { ...profile, phone: e.target.value },
                  })
                }
              />
            </FormField>

            <FormField id="cv-email" label="Alamat Email Kontak">
              <TextInput
                id="cv-email"
                type="email"
                placeholder="nama@email.com"
                value={profile.email}
                onChange={(e) =>
                  onChange({
                    ...content,
                    profile: { ...profile, email: e.target.value },
                  })
                }
              />
            </FormField>
          </div>
        </div>
      ) : null}

      {/* 2. SUMMARY / PROFILE */}
      {activeSection === 'summary' ? (
        <div className="surface-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              gap: 12,
            }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Ringkasan Profil (PROFILE)
            </h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
            Tuliskan 2-4 kalimat mengenai latar belakang pendidikan, kontribusi organisasi, keahlian utama,
            dan minat Anda.
          </p>
          <FormField id="cv-summary" label="Teks Profil">
            <TextArea
              id="cv-summary"
              rows={5}
              maxLength={2000}
              placeholder="Contoh: Mahasiswa tingkat akhir Teknik Informatika dengan minat pada pengembangan web dan teknologi cloud. Aktif berkontribusi dalam organisasi..."
              value={summary}
              onChange={(e) => onChange({ ...content, summary: e.target.value })}
            />
          </FormField>
        </div>
      ) : null}

      {/* 3. ORGANIZATION EXPERIENCE */}
      {activeSection === 'organization' ? (
        <div className="surface-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Pengalaman Organisasi ({organizations.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...content,
                  organizations: [
                    ...organizations,
                    {
                      name: '',
                      role: '',
                      start_date: null,
                      end_date: null,
                      description: '• ',
                    },
                  ],
                })
              }
            >
              + Tambah Organisasi
            </Button>
          </div>

          {organizations.length === 0 ? (
            <p className="form-hint">Belum ada pengalaman organisasi ditambahkan.</p>
          ) : (
            <div className="form-stack">
              {organizations.map((org, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 16,
                    background: 'var(--p-surface, #f4f4f4)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <strong className="font-mono" style={{ fontSize: '0.82rem' }}>
                      ORGANISASI #{idx + 1}
                    </strong>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const next = organizations.filter((_, i) => i !== idx);
                          onChange({ ...content, organizations: next });
                        }}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <FormField id={`org-role-${idx}`} label="Jabatan / Peran" required>
                      <TextInput
                        id={`org-role-${idx}`}
                        placeholder="Contoh: Staff of Media and Publication Unit"
                        value={org.role ?? ''}
                        onChange={(e) => {
                          const next = [...organizations];
                          next[idx] = { ...org, role: e.target.value };
                          onChange({ ...content, organizations: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`org-name-${idx}`} label="Nama Organisasi / Kepanitiaan" required>
                      <TextInput
                        id={`org-name-${idx}`}
                        placeholder="Contoh: Himpunan Mahasiswa Informatika"
                        value={org.name}
                        onChange={(e) => {
                          const next = [...organizations];
                          next[idx] = { ...org, name: e.target.value };
                          onChange({ ...content, organizations: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`org-start-${idx}`} label="Mulai (YYYY-MM)">
                      <TextInput
                        id={`org-start-${idx}`}
                        type="month"
                        value={org.start_date?.slice(0, 7) ?? ''}
                        onChange={(e) => {
                          const next = [...organizations];
                          next[idx] = { ...org, start_date: e.target.value || null };
                          onChange({ ...content, organizations: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`org-end-${idx}`} label="Selesai (YYYY-MM)">
                      <TextInput
                        id={`org-end-${idx}`}
                        type="month"
                        value={org.end_date?.slice(0, 7) ?? ''}
                        placeholder="Kosongkan jika masih aktif (Present)"
                        onChange={(e) => {
                          const next = [...organizations];
                          next[idx] = { ...org, end_date: e.target.value || null };
                          onChange({ ...content, organizations: next });
                        }}
                      />
                    </FormField>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <FormField
                      id={`org-desc-${idx}`}
                      label="Poin Kontribusi / Tanggung Jawab (Gunakan bullet • per baris)"
                      hint="Ketik tiap poin dengan diawali bullet (•). Tombol ✨ Terjemahkan akan otomatis mengubahnya menjadi Action Verbs bahasa Inggris!"
                    >
                      <TextArea
                        id={`org-desc-${idx}`}
                        rows={4}
                        placeholder="• Designing and managing visual content for the organization's official social media&#10;• Managing the content calendar..."
                        value={org.description ?? ''}
                        onChange={(e) => {
                          const next = [...organizations];
                          next[idx] = { ...org, description: e.target.value };
                          onChange({ ...content, organizations: next });
                        }}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 4. WORK EXPERIENCE */}
      {activeSection === 'experience' ? (
        <div className="surface-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Pengalaman Kerja ({experiences.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...content,
                  experiences: [
                    ...experiences,
                    {
                      company: '',
                      title: '',
                      location: null,
                      start_date: null,
                      end_date: null,
                      current: false,
                      description: '• ',
                    },
                  ],
                })
              }
            >
              + Tambah Pengalaman Kerja
            </Button>
          </div>

          {experiences.length === 0 ? (
            <p className="form-hint">Belum ada pengalaman kerja ditambahkan.</p>
          ) : (
            <div className="form-stack">
              {experiences.map((exp, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 16,
                    background: 'var(--p-surface, #f4f4f4)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <strong className="font-mono" style={{ fontSize: '0.82rem' }}>
                      PENGALAMAN #{idx + 1}
                    </strong>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = experiences.filter((_, i) => i !== idx);
                        onChange({ ...content, experiences: next });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>

                  <div className="form-grid-2">
                    <FormField id={`exp-title-${idx}`} label="Posisi / Jabatan" required>
                      <TextInput
                        id={`exp-title-${idx}`}
                        placeholder="Contoh: Frontend Developer"
                        value={exp.title}
                        onChange={(e) => {
                          const next = [...experiences];
                          next[idx] = { ...exp, title: e.target.value };
                          onChange({ ...content, experiences: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`exp-company-${idx}`} label="Perusahaan / Instansi" required>
                      <TextInput
                        id={`exp-company-${idx}`}
                        placeholder="Contoh: PT Teknologi Digital"
                        value={exp.company}
                        onChange={(e) => {
                          const next = [...experiences];
                          next[idx] = { ...exp, company: e.target.value };
                          onChange({ ...content, experiences: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`exp-start-${idx}`} label="Mulai (YYYY-MM)">
                      <TextInput
                        id={`exp-start-${idx}`}
                        type="month"
                        value={exp.start_date?.slice(0, 7) ?? ''}
                        onChange={(e) => {
                          const next = [...experiences];
                          next[idx] = { ...exp, start_date: e.target.value || null };
                          onChange({ ...content, experiences: next });
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
                          const next = [...experiences];
                          next[idx] = { ...exp, end_date: e.target.value || null };
                          onChange({ ...content, experiences: next });
                        }}
                      />
                    </FormField>
                  </div>

                  <label className="checkbox-pill" style={{ marginTop: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={exp.current}
                      onChange={(e) => {
                        const next = [...experiences];
                        next[idx] = {
                          ...exp,
                          current: e.target.checked,
                          end_date: e.target.checked ? null : exp.end_date,
                        };
                        onChange({ ...content, experiences: next });
                      }}
                    />
                    <span>Masih aktif bekerja di sini (Present)</span>
                  </label>

                  <FormField
                    id={`exp-desc-${idx}`}
                    label="Poin Kontribusi / Pencapaian (Gunakan bullet •)"
                  >
                    <TextArea
                      id={`exp-desc-${idx}`}
                      rows={3}
                      placeholder="• Spearheaded the development of..."
                      value={exp.description ?? ''}
                      onChange={(e) => {
                        const next = [...experiences];
                        next[idx] = { ...exp, description: e.target.value };
                        onChange({ ...content, experiences: next });
                      }}
                    />
                  </FormField>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 5. COURSE & CERTIFICATION / AWARDS */}
      {activeSection === 'certifications' || activeSection === 'achievements' ? (
        <div className="surface-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Kursus, Sertifikasi &amp; Penghargaan ({achievements.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...content,
                  achievements: [
                    ...achievements,
                    {
                      title: '',
                      issuer: null,
                      date: new Date().getFullYear().toString(),
                      description: null,
                    },
                  ],
                })
              }
            >
              + Tambah Sertifikasi
            </Button>
          </div>

          {achievements.length === 0 ? (
            <p className="form-hint">Belum ada kursus atau sertifikasi ditambahkan.</p>
          ) : (
            <div className="form-stack">
              {achievements.map((ach, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    background: 'var(--p-surface, #f4f4f4)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                  }}
                >
                  <div className="form-grid-3">
                    <FormField id={`ach-title-${idx}`} label="Nama Sertifikat / Course" required>
                      <TextInput
                        id={`ach-title-${idx}`}
                        placeholder="Contoh: Cloud Essentials Knowledge Badge Assessment"
                        value={ach.title}
                        onChange={(e) => {
                          const next = [...achievements];
                          next[idx] = { ...ach, title: e.target.value };
                          onChange({ ...content, achievements: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`ach-issuer-${idx}`} label="Penerbit / Penyelenggara">
                      <TextInput
                        id={`ach-issuer-${idx}`}
                        placeholder="Contoh: AWS Training and Certification"
                        value={ach.issuer ?? ''}
                        onChange={(e) => {
                          const next = [...achievements];
                          next[idx] = { ...ach, issuer: e.target.value || null };
                          onChange({ ...content, achievements: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`ach-date-${idx}`} label="Tahun">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <TextInput
                          id={`ach-date-${idx}`}
                          placeholder="Contoh: 2024"
                          value={ach.date ?? ''}
                          onChange={(e) => {
                            const next = [...achievements];
                            next[idx] = { ...ach, date: e.target.value || null };
                            onChange({ ...content, achievements: next });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const next = achievements.filter((_, i) => i !== idx);
                            onChange({ ...content, achievements: next });
                          }}
                        >
                          ✕
                        </Button>
                      </div>
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 6. EDUCATION */}
      {activeSection === 'education' ? (
        <div className="surface-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
              Riwayat Pendidikan ({education.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...content,
                  education: [
                    ...education,
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

          {education.length === 0 ? (
            <p className="form-hint">Belum ada riwayat pendidikan ditambahkan.</p>
          ) : (
            <div className="form-stack">
              {education.map((edu, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 16,
                    background: 'var(--p-surface, #f4f4f4)',
                    borderRadius: 'var(--radius-sm, 8px)',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <strong className="font-mono" style={{ fontSize: '0.82rem' }}>
                      PENDIDIKAN #{idx + 1}
                    </strong>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = education.filter((_, i) => i !== idx);
                        onChange({ ...content, education: next });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>

                  <div className="form-grid-2">
                    <FormField id={`edu-inst-${idx}`} label="Nama Universitas / Sekolah" required>
                      <TextInput
                        id={`edu-inst-${idx}`}
                        placeholder="Contoh: Universitas Indonesia"
                        value={edu.institution}
                        onChange={(e) => {
                          const next = [...education];
                          next[idx] = { ...edu, institution: e.target.value };
                          onChange({ ...content, education: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`edu-field-${idx}`} label="Program Studi / Deskripsi Jurusan">
                      <TextInput
                        id={`edu-field-${idx}`}
                        placeholder="Contoh: S1 Teknik Informatika"
                        value={edu.field ?? ''}
                        onChange={(e) => {
                          const next = [...education];
                          next[idx] = { ...edu, field: e.target.value };
                          onChange({ ...content, education: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`edu-start-${idx}`} label="Mulai (YYYY)">
                      <TextInput
                        id={`edu-start-${idx}`}
                        placeholder="Contoh: 2024"
                        value={edu.start_date?.slice(0, 4) ?? ''}
                        onChange={(e) => {
                          const next = [...education];
                          next[idx] = { ...edu, start_date: e.target.value || null };
                          onChange({ ...content, education: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`edu-end-${idx}`} label="Selesai (YYYY)">
                      <TextInput
                        id={`edu-end-${idx}`}
                        placeholder="Kosongkan jika masih studi (Present)"
                        value={edu.end_date?.slice(0, 4) ?? ''}
                        onChange={(e) => {
                          const next = [...education];
                          next[idx] = { ...edu, end_date: e.target.value || null };
                          onChange({ ...content, education: next });
                        }}
                      />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 7. SKILLS & TOOLS */}
      {activeSection === 'skills' ? (
        <div className="surface-card">
          <h3 style={{ fontSize: '1.15rem', marginBottom: 6, fontWeight: 700 }}>
            Keahlian &amp; Tools (SKILLS &amp; TOOLS)
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
            Daftar ini akan otomatis diformat menjadi 3 kolom rapi dengan bullet points pada hasil cetak
            ATS persis seperti contoh PDF. Pilih dari katalog keahlian atau ketik keahlian baru.
          </p>
          <SkillComboboxInput
            id="cv-skills-editor"
            label="Keahlian & Perangkat"
            values={skills}
            onChange={(nextSkills) => onChange({ ...content, skills: nextSkills })}
            hint="Ketik untuk mencari saran keahlian dari katalog atau tekan Enter untuk menambahkan keahlian baru."
          />
        </div>
      ) : null}

      {/* 8. PROJECTS & PORTFOLIO */}
      {activeSection === 'projects' ? (
        <div className="surface-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700 }}>
                Proyek &amp; Portofolio (PROJECTS &amp; PORTFOLIO)
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                Tampilkan proyek unggulan, kontribusi open source, atau produk yang pernah Anda buat.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = [
                  ...projects,
                  {
                    name: '',
                    url: null,
                    start_date: null,
                    end_date: null,
                    description: '',
                  },
                ];
                onChange({ ...content, projects: next });
              }}
            >
              + Tambah Proyek
            </Button>
          </div>

          {projects.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
              Belum ada data proyek. Klik &quot;+ Tambah Proyek&quot; untuk menambahkan.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {projects.map((proj, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                    borderRadius: 'var(--radius-sm, 8px)',
                    background: 'var(--p-surface-card, #ffffff)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <strong style={{ fontSize: '0.92rem' }}>
                      #{idx + 1} {proj.name || 'Proyek Tanpa Judul'}
                    </strong>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = projects.filter((_, i) => i !== idx);
                        onChange({ ...content, projects: next });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>

                  <div className="form-grid-2">
                    <FormField id={`proj-name-${idx}`} label="Nama Proyek" required>
                      <TextInput
                        id={`proj-name-${idx}`}
                        placeholder="Contoh: Aplikasi Job Tracker & CV ATS"
                        value={proj.name}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, name: e.target.value };
                          onChange({ ...content, projects: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`proj-url-${idx}`} label="Tautan / Demo URL">
                      <TextInput
                        id={`proj-url-${idx}`}
                        placeholder="Contoh: https://github.com/username/project"
                        value={proj.url ?? ''}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, url: e.target.value || null };
                          onChange({ ...content, projects: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`proj-start-${idx}`} label="Mulai (YYYY-MM)">
                      <TextInput
                        id={`proj-start-${idx}`}
                        placeholder="Contoh: 2024-03"
                        value={proj.start_date ?? ''}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, start_date: e.target.value || null };
                          onChange({ ...content, projects: next });
                        }}
                      />
                    </FormField>

                    <FormField id={`proj-end-${idx}`} label="Selesai (YYYY-MM)">
                      <TextInput
                        id={`proj-end-${idx}`}
                        placeholder="Contoh: 2024-06"
                        value={proj.end_date ?? ''}
                        onChange={(e) => {
                          const next = [...projects];
                          next[idx] = { ...proj, end_date: e.target.value || null };
                          onChange({ ...content, projects: next });
                        }}
                      />
                    </FormField>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label htmlFor={`proj-desc-${idx}`} style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Deskripsi &amp; Pencapaian Proyek (Gunakan poin •)
                      </label>
                    </div>
                    <TextArea
                      id={`proj-desc-${idx}`}
                      rows={4}
                      placeholder="• Mengembangkan platform pencarian kerja menggunakan Next.js dan TypeScript&#10;• Mengoptimalkan kinerja query basis data hingga 40%"
                      value={proj.description ?? ''}
                      onChange={(e) => {
                        const next = [...projects];
                        next[idx] = { ...proj, description: e.target.value || null };
                        onChange({ ...content, projects: next });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
