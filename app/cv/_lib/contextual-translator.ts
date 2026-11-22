import type {
  ProfileAchievement,
  ProfileEducation,
  ProfileExperience,
  ProfileOrganization,
  ProfileProject,
} from '@/lib/contracts';
import type { CvContent, CvLanguage } from './types';

/**
 * Kamus frasa aksi kontekstual untuk resume/CV (Action Verbs & Professional Phrasing).
 * Menerjemahkan kalimat deskripsi pekerjaan dari Bahasa Indonesia ke Bahasa Inggris dengan kaidah resume profesional.
 */
const ACTION_VERB_PATTERNS: Array<[RegExp, string]> = [
  // Pengalaman & Tanggung Jawab Aktif
  [/^merancang dan mengelola\b/gi, 'Designed and managed'],
  [/^merancang\b/gi, 'Designed'],
  [/^mengelola\b/gi, 'Managed'],
  [/^mengembangkan\b/gi, 'Developed'],
  [/^membuat dan mengelola\b/gi, 'Created and managed'],
  [/^membuat\b/gi, 'Created'],
  [/^mendokumentasikan\b/gi, 'Documented'],
  [/^berkolaborasi dengan\b/gi, 'Collaborated with'],
  [/^berkolaborasi lintas divisi\b/gi, 'Collaborated across divisions'],
  [/^berkolaborasi\b/gi, 'Collaborated'],
  [/^menyusun dan merencanakan\b/gi, 'Planned and structured'],
  [/^menyusun timeline\b/gi, 'Developed comprehensive timelines for'],
  [/^menyusun\b/gi, 'Prepared'],
  [/^merencanakan, mengorganisir, dan melaksanakan\b/gi, 'Planned, organized, and executed'],
  [/^merencanakan dan melaksanakan\b/gi, 'Planned and executed'],
  [/^merencanakan\b/gi, 'Planned'],
  [/^melaksanakan\b/gi, 'Executed'],
  [/^mengkoordinasikan\b/gi, 'Coordinated'],
  [/^membantu koordinasi teknis\b/gi, 'Assisted in technical coordination'],
  [/^membantu\b/gi, 'Supported and assisted in'],
  [/^bertindak sebagai pengawas teknis\b/gi, 'Acted as technical supervisor'],
  [/^bertindak sebagai\b/gi, 'Served as'],
  [/^menjadi wakil ketua\b/gi, 'Served as deputy chairman of'],
  [/^menjadi ketua\b/gi, 'Served as president / chairman of'],
  [/^menjadi anggota\b/gi, 'Served as an active member of'],
  [/^melakukan evaluasi kegiatan\b/gi, 'Conducted activity evaluations to improve'],
  [/^melakukan evaluasi\b/gi, 'Conducted evaluations on'],
  [/^melakukan analisis\b/gi, 'Performed in-depth analysis on'],
  [/^melakukan riset\b/gi, 'Conducted research on'],
  [/^melakukan\b/gi, 'Conducted'],
  [/^meningkatkan efisiensi\b/gi, 'Optimized operational efficiency of'],
  [/^meningkatkan\b/gi, 'Enhanced'],
  [/^memimpin tim\b/gi, 'Led a cross-functional team in'],
  [/^memimpin\b/gi, 'Spearheaded'],
  [/^menerapkan\b/gi, 'Implemented'],
  [/^mengawasi\b/gi, 'Supervised'],
  [/^mengoptimalkan\b/gi, 'Optimized'],
  [/^menghasilkan\b/gi, 'Generated'],
  [/^menyelesaikan\b/gi, 'Successfully delivered'],
];

/**
 * Pemetaan istilah umum dalam organisasi, kampus, dan deskripsi resume.
 */
const CONTEXTUAL_TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bmahasiswa semester (\d+)\b/gi, '$1th semester student'],
  [/\bmahasiswa\b/gi, 'Student'],
  [/\badministrasi pemerintahan\b/gi, 'Government Administration'],
  [/\btata kelola publik\b/gi, 'public governance'],
  [/\bkepemimpinan\b/gi, 'leadership'],
  [/\bprogram studi\b/gi, 'Study Program'],
  [/\buniversitas\b/gi, 'University'],
  [/\bhimpunan mahasiswa\b/gi, 'Student Association of'],
  [/\bkeluarga mahasiswa\b/gi, 'Student Family of'],
  [/\bketua pelaksana\b/gi, 'Project Leader / Head of Committee'],
  [/\bwakil ketua\b/gi, 'Deputy Chairman'],
  [/\bketua umum\b/gi, 'President / Chairperson'],
  [/\bdivisi\b/gi, 'Division'],
  [/\bdepartemen\b/gi, 'Department'],
  [/\bstaf ahli\b/gi, 'Senior Staff'],
  [/\bstaf magang\b/gi, 'Intern Staff'],
  [/\bstaf\b/gi, 'Staff'],
  [/\bkepanitiaan\b/gi, 'Committee'],
  [/\banggota\b/gi, 'Member'],
  [/\bkoordinator\b/gi, 'Coordinator'],
  [/\bsekarang\b/gi, 'Present'],
  [/\bsaat ini\b/gi, 'Present'],
  [/\bmedia sosial resmi\b/gi, "organization's official social media"],
  [/\bmedia sosial\b/gi, 'social media'],
  [/\bkonten visual\b/gi, 'visual content'],
  [/\bkalender konten\b/gi, 'content calendar'],
  [/\bstrategi publikasi\b/gi, 'publication strategies'],
  [/\bmeningkatkan engagement\b/gi, 'increase engagement and branding'],
  [/\bpenyampaian informasi\b/gi, 'information dissemination'],
  [/\brangkaian acara\b/gi, 'the entire series of events'],
  [/\bpeserta\b/gi, 'participants'],
  [/\bsertifikat\b/gi, 'certificates'],
  [/\bpiagam penghargaan\b/gi, 'plaques and awards'],
  [/\bkegiatan\b/gi, 'activities'],
  [/\bprogram kerja\b/gi, 'work programs'],
  [/\bpengembangan kader\b/gi, 'cadre development'],
  [/\bkemampuan komunikasi yang baik\b/gi, 'strong communication skills'],
  [/\bkerjasama tim yang baik\b/gi, 'strong teamwork and collaboration skills'],
  [/\bpengambilan keputusan\b/gi, 'decision making process'],
  [/\btertarik pada bidang\b/gi, 'highly interested in'],
  [/\bminat tinggi\b/gi, 'high interest in'],
  [/\bsecara aktif berkontribusi\b/gi, 'actively contributing to'],
  [/\bberkontribusi dalam\b/gi, 'contributing to'],
  [/\bselama kompetisi\b/gi, 'during the competition'],
  [/\bmahasiswa baru\b/gi, 'new students'],
];

/**
 * Terjemahan nama keahlian teknis & soft skills.
 */
const SKILL_TRANSLATIONS: Record<string, string> = {
  'berbicara di depan umum': 'Public Speaking',
  'keuangan': 'Finance',
  'akuntansi': 'Accounting',
  'manajemen waktu': 'Time Management',
  'kerja tim': 'Teamwork',
  'kerjasama tim': 'Teamwork',
  'adaptabilitas': 'Adaptability',
  'kemampuan adaptasi': 'Adaptability',
  'komunikatif': 'Communicative',
  'komunikasi': 'Communication Skills',
  'penulisan konten': 'Content Writer',
  'penulis konten': 'Content Writer',
  'pengeditan dasar': 'Basic Editing',
  'desain grafis': 'Graphic Design',
  'bahasa indonesia': 'Indonesian (Native)',
  'bahasa inggris': 'English (Professional)',
  'pemecahan masalah': 'Problem Solving',
  'kepemimpinan': 'Leadership',
  'negosiasi': 'Negotiation',
  'analisis data': 'Data Analysis',
};

/**
 * Menerjemahkan kalimat atau bullet point resume dari Bahasa Indonesia ke Bahasa Inggris
 * secara kontekstual dengan kaidah penulisan CV ATS.
 */
export function translateResumeSentenceToEnglish(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';

  // 1. Cek kecocokan aksi di awal kalimat (Action Verbs)
  let translated = trimmed;

  for (const [pattern, replacement] of ACTION_VERB_PATTERNS) {
    if (pattern.test(translated)) {
      translated = translated.replace(pattern, replacement);
      break;
    }
  }

  // 2. Terapkan penggantian istilah kontekstual
  for (const [pattern, replacement] of CONTEXTUAL_TERM_REPLACEMENTS) {
    translated = translated.replace(pattern, replacement);
  }

  // 3. Pastikan huruf pertama kapital
  if (translated.length > 0) {
    translated = translated.charAt(0).toUpperCase() + translated.slice(1);
  }

  return translated;
}

/**
 * Menerjemahkan deskripsi multi-baris (bullet points)
 */
export function translateDescriptionBulletPoints(desc: string | null | undefined): string {
  if (!desc) return '';
  const lines = desc.split(/\r?\n/);
  const translatedLines = lines.map((line) => {
    const raw = line.trim();
    if (!raw) return '';
    // Jika baris diawali bullet point '•' atau '-' atau '*'
    const bulletMatch = raw.match(/^([•\-\*]\s*)(.*)$/);
    if (bulletMatch) {
      return `${bulletMatch[1]}${translateResumeSentenceToEnglish(bulletMatch[2])}`;
    }
    return translateResumeSentenceToEnglish(raw);
  });
  return translatedLines.filter(Boolean).join('\n');
}

/**
 * Menerjemahkan teks skill ke bahasa inggris
 */
export function translateSkill(skill: string): string {
  const lower = skill.trim().toLowerCase();
  return SKILL_TRANSLATIONS[lower] || skill.trim();
}

/**
 * Fungsi Utama: Menghasilkan versi Bahasa Inggris Profesional dari CV Bahasa Indonesia
 * dengan konteks resume/ATS penuh.
 */
export function generateContextualEnglishCv(cv: CvContent): CvContent {
  // 1. Terjemahkan Profil / Summary & Headline
  const translatedSummary = translateResumeSentenceToEnglish(cv.summary);
  const translatedHeadline = cv.profile.headline
    ? translateResumeSentenceToEnglish(cv.profile.headline)
    : cv.profile.headline;

  // 2. Terjemahkan Organisasi
  const translatedOrgs: ProfileOrganization[] = cv.organizations.map((org) => {
    let roleEn = org.role || '';
    for (const [pattern, rep] of CONTEXTUAL_TERM_REPLACEMENTS) {
      roleEn = roleEn.replace(pattern, rep);
    }
    return {
      ...org,
      role: roleEn || null,
      description: org.description ? translateDescriptionBulletPoints(org.description) : null,
    };
  });

  // 3. Terjemahkan Pengalaman Kerja
  const translatedExps: ProfileExperience[] = cv.experiences.map((exp) => {
    let titleEn = exp.title || '';
    for (const [pattern, rep] of CONTEXTUAL_TERM_REPLACEMENTS) {
      titleEn = titleEn.replace(pattern, rep);
    }
    return {
      ...exp,
      title: titleEn,
      description: exp.description ? translateDescriptionBulletPoints(exp.description) : null,
    };
  });

  // 4. Terjemahkan Pendidikan
  const translatedEdu: ProfileEducation[] = cv.education.map((edu) => {
    let fieldEn = edu.field || '';
    if (fieldEn.toLowerCase().includes('administrasi pemerintahan')) {
      fieldEn = 'Government Administration';
    } else if (fieldEn.toLowerCase().includes('teknik informatika')) {
      fieldEn = 'Informatics Engineering / Computer Science';
    } else if (fieldEn.toLowerCase().includes('ilmu komputer')) {
      fieldEn = 'Computer Science';
    } else if (fieldEn.toLowerCase().includes('sains') || fieldEn.toLowerCase().includes('ipa')) {
      fieldEn = 'Natural Sciences';
    }

    let degreeEn = edu.degree || '';
    if (/s1|sarjana|bachelor/i.test(degreeEn)) degreeEn = 'Bachelor Degree (S1)';
    else if (/s2|magister|master/i.test(degreeEn)) degreeEn = 'Master Degree (S2)';
    else if (/d3|diploma/i.test(degreeEn)) degreeEn = 'Associate Degree (D3)';
    else if (/d4/i.test(degreeEn)) degreeEn = 'Applied Bachelor (D4)';
    else if (/sma|smk|ma|madrasah/i.test(degreeEn)) degreeEn = 'High School Diploma (Madrasah Aliyah)';

    return {
      ...edu,
      degree: degreeEn || null,
      field: fieldEn || null,
      description: edu.description ? translateDescriptionBulletPoints(edu.description) : null,
    };
  });

  // 5. Terjemahkan Sertifikasi & Course
  const translatedAchievements: ProfileAchievement[] = cv.achievements.map((ach) => ({
    ...ach,
    title: translateResumeSentenceToEnglish(ach.title),
    description: ach.description ? translateDescriptionBulletPoints(ach.description) : null,
  }));

  // 6. Terjemahkan Skills
  const translatedSkills = cv.skills.map(translateSkill);

  // 7. Terjemahkan Proyek
  const translatedProjects: ProfileProject[] = cv.projects.map((proj) => ({
    ...proj,
    description: proj.description ? translateDescriptionBulletPoints(proj.description) : null,
  }));

  // 8. Terjemahkan Custom Sections
  const translatedCustom = cv.custom_sections?.map((cs) => ({
    ...cs,
    title: translateResumeSentenceToEnglish(cs.title),
    content: translateDescriptionBulletPoints(cs.content),
  }));

  return {
    ...cv,
    language: 'en',
    profile: {
      ...cv.profile,
      headline: translatedHeadline,
    },
    summary: translatedSummary,
    organizations: translatedOrgs,
    experiences: translatedExps,
    education: translatedEdu,
    achievements: translatedAchievements,
    skills: translatedSkills,
    projects: translatedProjects,
    custom_sections: translatedCustom,
    section_titles: {},
  };
}
