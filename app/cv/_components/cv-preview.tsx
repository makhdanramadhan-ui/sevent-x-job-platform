'use client';

import type { CvContent, CvSectionId } from '../_lib/types';
import {
  findCustomSection,
  getSectionAtsHeading,
  isCustomSectionId,
} from '../_lib/types';
import { formatCvPeriod } from '../_lib/export-helpers';
import { sanitizeSafeUrl } from '../_lib/nist-security';
import '../cv-styles.css';

function renderStructuredBody(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: Array<{ type: 'bullets'; items: string[] } | { type: 'text'; text: string }> = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    if (/^[•\-\*]/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[•\-\*]\s*/, '');
      if (!bulletText) continue;
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'bullets') {
        last.items.push(bulletText);
      } else {
        blocks.push({ type: 'bullets', items: [bulletText] });
      }
    } else {
      blocks.push({ type: 'text', text: trimmed });
    }
  }

  return blocks.map((block, idx) =>
    block.type === 'bullets' ? (
      <ul key={idx} className="cv-ats-bullets">
        {block.items.map((item, bIdx) => (
          <li key={bIdx}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={idx} className="cv-ats-text" style={{ marginTop: idx > 0 ? 4 : 0 }}>
        {block.text}
      </p>
    ),
  );
}

export function CvPreview({
  content,
  id = 'cv-ats-print-area',
}: {
  content: CvContent;
  id?: string;
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
    custom_sections,
    section_order,
    hidden_sections,
  } = content;

  const isVisible = (secId: CvSectionId) => !hidden_sections.includes(secId);

  const summaryIndex = section_order.indexOf('summary');
  const profileIndex = section_order.indexOf('profile');
  const hasCustomSummaryTitle = Boolean(content.section_titles?.summary?.trim());
  const renderSummaryInHeader =
    isVisible('profile') &&
    isVisible('summary') &&
    Boolean(summary.trim()) &&
    summaryIndex !== -1 &&
    !hasCustomSummaryTitle &&
    (profileIndex === -1 ? summaryIndex === 0 : summaryIndex === profileIndex + 1 || summaryIndex === 0);

  // Helper untuk memecah skills menjadi 3 kolom rapi
  const splitIntoColumns = (items: string[], cols = 3): string[][] => {
    const result: string[][] = Array.from({ length: cols }, () => []);
    items.forEach((item, index) => {
      result[index % cols].push(item);
    });
    return result;
  };

  const skillColumns = splitIntoColumns(skills, 3);

  return (
    <div className="cv-ats-preview-wrapper">
      <article id={id} className="cv-ats-sheet" aria-label="Pratinjau CV Format Standar ATS">
        {/* HEADER DOKUMEN (KIRI: PAS FOTO OPSIONAL, KANAN: NAMA, KONTAK, LOKASI, RINGKASAN) */}
        {isVisible('profile') ? (
          <header className="cv-ats-header">
            {profile.photo_url ? (
              <div className="cv-ats-photo-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.photo_url}
                  alt={`Pas foto ${profile.full_name || 'kandidat'}`}
                  className="cv-ats-photo"
                />
              </div>
            ) : null}

            <div className="cv-ats-header-main">
              <h1 className="cv-ats-name">{profile.full_name || 'Nama Lengkap Kandidat'}</h1>

              <div className="cv-ats-contacts">
                {[
                  profile.phone || null,
                  profile.email ? (
                    <a key="email" href={`mailto:${profile.email}`} className="cv-ats-link">
                      {profile.email}
                    </a>
                  ) : null,
                  ...profile.links.map((link, idx) => {
                    const safeUrl = sanitizeSafeUrl(link.url);
                    if (!safeUrl) {
                      return <span key={`link-${idx}`}>{link.label || link.url}</span>;
                    }
                    return (
                      <a
                        key={`link-${idx}`}
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cv-ats-link"
                      >
                        {link.label || link.url}
                      </a>
                    );
                  }),
                ]
                  .filter(Boolean)
                  .map((item, idx, arr) => (
                    <span key={idx} className="cv-ats-contact-item">
                      {item}
                      {idx < arr.length - 1 ? <span className="cv-ats-sep"> | </span> : null}
                    </span>
                  ))}
              </div>

              {profile.location ? <div className="cv-ats-location">{profile.location}</div> : null}

              {renderSummaryInHeader ? (
                <p className="cv-ats-summary-inline">{summary}</p>
              ) : null}
            </div>
          </header>
        ) : null}

        {/* SECTIONS SESUAI SECTION_ORDER */}
        <div className="cv-ats-body">
          {section_order.map((secId) => {
            if (!isVisible(secId)) return null;

            if (isCustomSectionId(secId)) {
              const customItem = findCustomSection(content, secId);
              if (!customItem || !customItem.content.trim()) return null;
              return (
                <section key={secId} className="cv-ats-section">
                  <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                  <div className="cv-ats-divider" />
                  {renderStructuredBody(customItem.content)}
                </section>
              );
            }

            switch (secId) {
              // 1. PROFILE / SUMMARY (tampil terpisah bila dipindah urutan atau diubah namanya)
              case 'summary':
                if (!summary.trim() || renderSummaryInHeader) return null;
                return (
                  <section key="summary" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <p className="cv-ats-text">{summary}</p>
                  </section>
                );

              // 2. WORK EXPERIENCE
              case 'experience':
                if (experiences.length === 0) return null;
                return (
                  <section key="experience" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {experiences.map((exp, idx) => {
                        const dateStr = formatCvPeriod(
                          exp.start_date,
                          exp.end_date,
                          exp.current,
                          language,
                        );
                        return (
                          <div key={idx} className="cv-ats-entry">
                            <div className="cv-ats-entry-row">
                              <span className="cv-ats-entry-heading">
                                <span className="cv-ats-company">{exp.company}</span>
                                {exp.location ? (
                                  <span className="cv-ats-entry-loc"> - {exp.location}</span>
                                ) : null}
                              </span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            {exp.title ? <div className="cv-ats-role-italic">{exp.title}</div> : null}
                            {exp.description ? (
                              <ul className="cv-ats-bullets">
                                {exp.description
                                  .split(/\r?\n/)
                                  .map((b) => b.trim().replace(/^[•\-\*]\s*/, ''))
                                  .filter(Boolean)
                                  .map((bullet, bIdx) => (
                                    <li key={bIdx}>{bullet}</li>
                                  ))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );

              // 3. EDUCATION
              case 'education':
                if (education.length === 0) return null;
                return (
                  <section key="education" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {education.map((edu, idx) => {
                        const dateStr = formatCvPeriod(
                          edu.start_date,
                          edu.end_date,
                          false,
                          language,
                        );
                        const subtitle = [edu.degree, edu.field].filter(Boolean).join(' ');
                        return (
                          <div key={idx} className="cv-ats-entry">
                            <div className="cv-ats-entry-row">
                              <span className="cv-ats-entry-heading">
                                <span className="cv-ats-company">{edu.institution}</span>
                              </span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            {subtitle ? <div className="cv-ats-role-italic">{subtitle}</div> : null}
                            {edu.description ? renderStructuredBody(edu.description) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );

              // 4. ORGANIZATION EXPERIENCE
              case 'organization':
                if (organizations.length === 0) return null;
                return (
                  <section key="organization" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {organizations.map((org, idx) => {
                        const dateStr = formatCvPeriod(
                          org.start_date,
                          org.end_date,
                          false,
                          language,
                        );
                        return (
                          <div key={idx} className="cv-ats-entry">
                            <div className="cv-ats-entry-row">
                              <span className="cv-ats-entry-heading">
                                <span className="cv-ats-company">{org.name}</span>
                              </span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            {org.role ? <div className="cv-ats-role-italic">{org.role}</div> : null}
                            {org.description ? (
                              <ul className="cv-ats-bullets">
                                {org.description
                                  .split(/\r?\n/)
                                  .map((b) => b.trim().replace(/^[•\-\*]\s*/, ''))
                                  .filter(Boolean)
                                  .map((bullet, bIdx) => (
                                    <li key={bIdx}>{bullet}</li>
                                  ))}
                              </ul>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );

              // 5. COURSE & CERTIFICATION / AWARDS & ACHIEVEMENTS
              case 'certifications':
              case 'achievements':
                if (achievements.length === 0) return null;
                return (
                  <section key={secId} className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {achievements.map((ach, idx) => (
                        <div key={idx} className="cv-ats-cert-row">
                          <span className="cv-ats-cert-title">
                            • {ach.title}
                            {ach.issuer ? ` — ${ach.issuer}` : ''}
                          </span>
                          {ach.date ? <span className="cv-ats-date">{ach.date}</span> : null}
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // 6. SKILLS & TOOLS (3 KOLOM)
              case 'skills':
                if (skills.length === 0) return null;
                return (
                  <section key="skills" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-skills-3col">
                      {skillColumns.map((col, colIdx) => (
                        <ul key={colIdx} className="cv-ats-bullets cv-ats-skill-col">
                          {col.map((skill, sIdx) => (
                            <li key={sIdx}>{skill}</li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  </section>
                );

              // 7. PROJECTS
              case 'projects':
                if (projects.length === 0) return null;
                return (
                  <section key="projects" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{getSectionAtsHeading(content, secId)}</h2>
                    <div className="cv-ats-divider" />
                    <ul className="cv-ats-bullets cv-ats-project-list">
                      {projects.map((proj, idx) => {
                        const dateStr = formatCvPeriod(
                          proj.start_date,
                          proj.end_date,
                          false,
                          language,
                        );
                        const lines = (proj.description ?? '')
                          .split(/\r?\n/)
                          .map((line) => line.trim().replace(/^[•\-\*]\s*/, ''))
                          .filter(Boolean);
                        const [firstLine, ...extraLines] = lines;

                        return (
                          <li key={idx}>
                            <span>
                              <strong className="cv-ats-project-title">{proj.name}</strong>
                              {dateStr ? ` (${dateStr})` : ''}
                              {firstLine ? `: ${firstLine}` : ''}
                              {proj.url && sanitizeSafeUrl(proj.url) ? (
                                <a
                                  href={sanitizeSafeUrl(proj.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cv-ats-project-link"
                                >
                                  [Link]
                                </a>
                              ) : null}
                            </span>
                            {extraLines.map((line, lineIdx) => (
                              <div key={lineIdx} className="cv-ats-project-subline">
                                {line}
                              </div>
                            ))}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );

              // 8. CUSTOM (legacy fallback for custom items not individually ordered in section_order)
              case 'custom': {
                const legacyCustom = (custom_sections ?? []).filter(
                  (c) =>
                    !section_order.includes(`custom:${c.id}` as CvSectionId) &&
                    c.content.trim().length > 0,
                );
                if (legacyCustom.length === 0) return null;
                return (
                  <div key="custom-sections">
                    {legacyCustom.map((c) => (
                      <section key={c.id} className="cv-ats-section">
                        <h2 className="cv-ats-section-title">
                          {c.title.trim() || 'Bagian Tambahan'}
                        </h2>
                        <div className="cv-ats-divider" />
                        {renderStructuredBody(c.content)}
                      </section>
                    ))}
                  </div>
                );
              }

              default:
                return null;
            }
          })}
        </div>
      </article>
    </div>
  );
}
