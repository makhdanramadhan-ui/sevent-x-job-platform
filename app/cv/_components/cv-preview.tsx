'use client';

import type { CvContent, CvSectionId } from '../_lib/types';
import { SECTION_LABELS } from '../_lib/types';
import { formatCvPeriod } from '../_lib/export-helpers';
import '../cv-styles.css';

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

  const labels = SECTION_LABELS[language] || SECTION_LABELS.en;
  const isVisible = (secId: CvSectionId) => !hidden_sections.includes(secId);

  // Helper untuk memecah skills menjadi 3 kolom rapi seperti di contoh PDF
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
        {/* HEADER DOKUMEN ATS (CENTERED) */}
        {isVisible('profile') ? (
          <header className="cv-ats-header">
            <h1 className="cv-ats-name">{profile.full_name || 'Nama Lengkap Kandidat'}</h1>
            <div className="cv-ats-contacts">
              {[
                profile.location,
                profile.phone,
                profile.email ? (
                  <a key="email" href={`mailto:${profile.email}`} className="cv-ats-link">
                    {profile.email}
                  </a>
                ) : null,
                ...profile.links.map((link, idx) => (
                  <a
                    key={`link-${idx}`}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cv-ats-link"
                  >
                    {link.label || link.url.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )),
              ]
                .filter(Boolean)
                .map((item, idx, arr) => (
                  <span key={idx} className="cv-ats-contact-item">
                    {item}
                    {idx < arr.length - 1 ? <span className="cv-ats-sep"> | </span> : null}
                  </span>
                ))}
            </div>
          </header>
        ) : null}

        {/* SECTIONS SESUAI SECTION_ORDER */}
        <div className="cv-ats-body">
          {section_order.map((secId) => {
            if (!isVisible(secId)) return null;

            switch (secId) {
              // 1. PROFILE / SUMMARY
              case 'summary':
                if (!summary) return null;
                return (
                  <section key="summary" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels.summary}</h2>
                    <div className="cv-ats-divider" />
                    <p className="cv-ats-text">{summary}</p>
                  </section>
                );

              // 2. ORGANIZATION EXPERIENCE
              case 'organization':
                if (organizations.length === 0) return null;
                return (
                  <section key="organization" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels.organization}</h2>
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
                              <span className="cv-ats-role">{org.role || 'Staff / Pengurus'}</span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            <div className="cv-ats-institution">{org.name}</div>
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

              // 3. WORK EXPERIENCE
              case 'experience':
                if (experiences.length === 0) return null;
                return (
                  <section key="experience" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels.experience}</h2>
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
                              <span className="cv-ats-role">{exp.title}</span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            <div className="cv-ats-institution">
                              {exp.company}
                              {exp.location ? ` – ${exp.location}` : ''}
                            </div>
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

              // 4. COURSE & CERTIFICATION / AWARDS & ACHIEVEMENTS
              case 'certifications':
              case 'achievements':
                if (achievements.length === 0) return null;
                return (
                  <section key={secId} className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels[secId] || labels.certifications}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {achievements.map((ach, idx) => (
                        <div key={idx} className="cv-ats-cert-row">
                          <span className="cv-ats-cert-title">
                            • {ach.title}
                            {ach.issuer ? ` by ${ach.issuer}` : ''}
                          </span>
                          {ach.date ? <span className="cv-ats-date">{ach.date}</span> : null}
                        </div>
                      ))}
                    </div>
                  </section>
                );

              // 5. EDUCATION
              case 'education':
                if (education.length === 0) return null;
                return (
                  <section key="education" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels.education}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {education.map((edu, idx) => {
                        const dateStr = formatCvPeriod(
                          edu.start_date,
                          edu.end_date,
                          false,
                          language,
                        );
                        return (
                          <div key={idx} className="cv-ats-entry">
                            <div className="cv-ats-entry-row">
                              <span className="cv-ats-role">{edu.institution}</span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            <div className="cv-ats-institution">
                              {[edu.field, edu.degree ? `(${edu.degree})` : '']
                                .filter(Boolean)
                                .join(' ')}
                            </div>
                            {edu.description ? (
                              <p className="cv-ats-text" style={{ marginTop: 2 }}>
                                {edu.description}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );

              // 6. SKILLS & TOOLS (3 KOLOM DENGAN BULLET POINTS PERSIS CONTOH PDF)
              case 'skills':
                if (skills.length === 0) return null;
                return (
                  <section key="skills" className="cv-ats-section">
                    <h2 className="cv-ats-section-title">{labels.skills}</h2>
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
                    <h2 className="cv-ats-section-title">{labels.projects}</h2>
                    <div className="cv-ats-divider" />
                    <div className="cv-ats-entries">
                      {projects.map((proj, idx) => {
                        const dateStr = formatCvPeriod(
                          proj.start_date,
                          proj.end_date,
                          false,
                          language,
                        );
                        return (
                          <div key={idx} className="cv-ats-entry">
                            <div className="cv-ats-entry-row">
                              <span className="cv-ats-role">
                                {proj.name}
                                {proj.url ? (
                                  <a
                                    href={proj.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cv-ats-link"
                                    style={{ marginLeft: 8, fontSize: '0.85rem' }}
                                  >
                                    [Demo / Link]
                                  </a>
                                ) : null}
                              </span>
                              {dateStr ? <span className="cv-ats-date">{dateStr}</span> : null}
                            </div>
                            {proj.description ? (
                              <ul className="cv-ats-bullets">
                                {proj.description
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

              // 8. CUSTOM
              case 'custom':
                if (!custom_sections || custom_sections.length === 0) return null;
                return (
                  <div key="custom-sections">
                    {custom_sections.map((c) => (
                      <section key={c.id} className="cv-ats-section">
                        <h2 className="cv-ats-section-title">{c.title.toUpperCase()}</h2>
                        <div className="cv-ats-divider" />
                        <p className="cv-ats-text">{c.content}</p>
                      </section>
                    ))}
                  </div>
                );

              default:
                return null;
            }
          })}
        </div>
      </article>


    </div>
  );
}
