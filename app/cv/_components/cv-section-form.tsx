'use client';

import type { ReactNode } from 'react';
import { Button, FormField, TextArea, TextInput } from '@/components/ui/forms';
import { SkillComboboxInput } from '@/components/ui/skill-combobox';
import type { CvContent, CvSectionId } from '../_lib/types';

function SectionTabIcon({ secId }: { secId: CvSectionId }): ReactNode {
  const props = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (secId) {
    case 'profile':
      return (
        <svg {...props}>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'summary':
      return (
        <svg {...props}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'experience':
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case 'education':
      return (
        <svg {...props}>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </svg>
      );
    case 'organization':
      return (
        <svg {...props}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'projects':
      return (
        <svg {...props}>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case 'skills':
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'certifications':
    case 'achievements':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
  }
}

const SECTION_SHORT_LABELS: Record<CvSectionId, string> = {
  profile: 'Identitas',
  summary: 'Ringkasan',
  experience: 'Pengalaman',
  education: 'Pendidikan',
  organization: 'Organisasi',
  projects: 'Proyek',
  skills: 'Keahlian',
  certifications: 'Sertifikasi',
  achievements: 'Sertifikasi',
  custom: 'Lainnya',
};

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
    profile,
    summary,
    organizations,
    experiences,
    education,
    achievements,
    skills,
    projects,
  } = content;

  const activeIndex = Math.max(0, content.section_order.indexOf(activeSection));

  function getSectionStatus(secId: CvSectionId): { count?: number; filled?: boolean } {
    switch (secId) {
      case 'profile':
        return { filled: Boolean(profile.full_name.trim()) };
      case 'summary':
        return { filled: Boolean(summary.trim()) };
      case 'experience':
        return { count: experiences.length };
      case 'education':
        return { count: education.length };
      case 'organization':
        return { count: organizations.length };
      case 'projects':
        return { count: projects.length };
      case 'skills':
        return { count: skills.length };
      case 'certifications':
      case 'achievements':
        return { count: achievements.length };
      case 'custom':
        return { count: content.custom_sections?.length ?? 0 };
      default:
        return {};
    }
  }

  return (
    <div className="form-stack">
      {/* Navigasi Bagian CV (Grid 4x2 dengan Ikon & Penghitung) */}
      <div className="cv-section-nav">
        <div className="cv-section-nav__head">
          <span className="cv-section-nav__title">Bagian CV</span>
          <span className="cv-section-nav__step">
            Bagian {activeIndex + 1} dari {content.section_order.length}
          </span>
        </div>

        <div
          className="cv-section-tabs"
          role="tablist"
          aria-label="Pilih bagian CV untuk diedit"
        >
          {content.section_order.map((secId) => {
            const isActive = activeSection === secId;
            const label = SECTION_SHORT_LABELS[secId] || secId;
            const status = getSectionStatus(secId);

            return (
              <button
                key={secId}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`cv-section-tab${isActive ? ' cv-section-tab--active' : ''}`}
                onClick={() => onSelectSection(secId)}
              >
                <span className="cv-section-tab__main">
                  <span className="cv-section-tab__icon">
                    <SectionTabIcon secId={secId} />
                  </span>
                  <span className="cv-section-tab__label">{label}</span>
                </span>
                {typeof status.count === 'number' ? (
                  <span className="cv-section-tab__count">{status.count}</span>
                ) : status.filled ? (
                  <span className="cv-section-tab__dot" aria-label="Terisi" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. PROFIL & IDENTITAS */}
      {activeSection === 'profile' ? (
        <div className="ledger-card">
          <h3 className="cv-section-heading" style={{ marginBottom: 14 }}>
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
        <div className="ledger-card">
          <div className="cv-section-header" style={{ marginBottom: 10 }}>
            <h3 className="cv-section-heading">Ringkasan Profil (PROFILE)</h3>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            Tuliskan 2–4 kalimat mengenai latar belakang pendidikan, kontribusi organisasi, keahlian
            utama, dan minat Anda.
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
        <div className="ledger-card">
          <div className="cv-section-header">
            <h3 className="cv-section-heading">
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
                <div key={idx} className="cv-item-card">
                  <div className="cv-item-head">
                    <strong className="cv-item-index">ORGANISASI #{idx + 1}</strong>
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
                      hint="Tulis satu pencapaian per baris diawali simbol bullet (•) agar terbaca rapi oleh sistem ATS."
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
        <div className="ledger-card">
          <div className="cv-section-header">
            <h3 className="cv-section-heading">Pengalaman Kerja ({experiences.length})</h3>
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
                <div key={idx} className="cv-item-card">
                  <div className="cv-item-head">
                    <strong className="cv-item-index">PENGALAMAN #{idx + 1}</strong>
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
        <div className="ledger-card">
          <div className="cv-section-header">
            <h3 className="cv-section-heading">
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
                <div key={idx} className="cv-item-card">
                  <div className="cv-item-head">
                    <span className="cv-item-index">SERTIFIKASI #{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Hapus sertifikasi ${idx + 1}`}
                      onClick={() => {
                        const next = achievements.filter((_, i) => i !== idx);
                        onChange({ ...content, achievements: next });
                      }}
                    >
                      Hapus
                    </Button>
                  </div>

                  <div className="form-stack" style={{ gap: 12 }}>
                    <FormField id={`ach-title-${idx}`} label="Nama Sertifikat / Kursus" required>
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

                    <div className="cv-cert-row-2">
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
                      </FormField>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* 6. EDUCATION */}
      {activeSection === 'education' ? (
        <div className="ledger-card">
          <div className="cv-section-header">
            <h3 className="cv-section-heading">Riwayat Pendidikan ({education.length})</h3>
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
                <div key={idx} className="cv-item-card">
                  <div className="cv-item-head">
                    <strong className="cv-item-index">PENDIDIKAN #{idx + 1}</strong>
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
        <div className="ledger-card">
          <h3 className="cv-section-heading" style={{ marginBottom: 6 }}>
            Keahlian &amp; Tools (SKILLS &amp; TOOLS)
          </h3>
          <p style={{ margin: '0 0 14px 0', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
            Daftar ini akan otomatis diformat menjadi 3 kolom rapi dengan bullet points pada hasil
            cetak ATS. Pilih dari katalog keahlian atau ketik keahlian baru.
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
        <div className="ledger-card">
          <div className="cv-section-header">
            <div>
              <h3 className="cv-section-heading">
                Proyek &amp; Portofolio (PROJECTS &amp; PORTFOLIO)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                Tampilkan proyek unggulan, kontribusi open source, atau produk yang pernah Anda
                buat.
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
            <p className="form-hint">
              Belum ada data proyek. Klik &quot;+ Tambah Proyek&quot; untuk menambahkan.
            </p>
          ) : (
            <div className="form-stack">
              {projects.map((proj, idx) => (
                <div key={idx} className="cv-item-card">
                  <div className="cv-item-head">
                    <strong className="cv-item-index">
                      PROYEK #{idx + 1} — {proj.name || 'Tanpa Judul'}
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
                    <FormField
                      id={`proj-desc-${idx}`}
                      label="Deskripsi & Pencapaian Proyek (Gunakan poin •)"
                    >
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
                    </FormField>
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
