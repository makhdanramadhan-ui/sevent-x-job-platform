import type {
  ProfileAchievement,
  ProfileEducation,
  ProfileExperience,
  ProfileLink,
  ProfileOrganization,
  ProfileProject,
} from '@/lib/contracts';
import type { CvContent } from './types';
import { createDefaultCvContent } from './cv-defaults';
import { cleanExtractedPdfText } from './pdf-parser';

export type MappedCvResult = {
  content: CvContent;
  unmappedLines: string[];
  warnings?: string[];
  confidence: {
    contactFound: boolean;
    organizationFound: boolean;
    experienceFound: boolean;
    educationFound: boolean;
    skillsFound: boolean;
  };
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+62|62|08)[0-9\s-]{7,15}/;
const URL_REGEX = /https?:\/\/[^\s)]+/g;

const INDONESIAN_CITIES = [
  'sumedang',
  'jakarta',
  'bandung',
  'surabaya',
  'yogyakarta',
  'semarang',
  'malang',
  'medan',
  'makassar',
  'denpasar',
  'tangerang',
  'bekasi',
  'depok',
  'bogor',
  'solo',
  'surakarta',
];

const MONTH_NAMES: Record<string, string> = {
  januari: '01',
  jan: '01',
  january: '01',
  februari: '02',
  feb: '02',
  february: '02',
  maret: '03',
  mar: '03',
  march: '03',
  april: '04',
  apr: '04',
  mei: '05',
  may: '05',
  juni: '06',
  jun: '06',
  june: '06',
  juli: '07',
  jul: '07',
  july: '07',
  agustus: '08',
  agu: '08',
  aug: '08',
  august: '08',
  september: '09',
  sep: '09',
  oktober: '10',
  okt: '10',
  oct: '10',
  october: '10',
  november: '11',
  nov: '11',
  desember: '12',
  des: '12',
  dec: '12',
  december: '12',
};

function normalizeDateMatch(dateStr: string): string | null {
  const trimmed = dateStr.trim().toLowerCase();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmed)) return trimmed;
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-01`;

  const monthYearMatch = trimmed.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_NAMES[monthYearMatch[1]];
    const year = monthYearMatch[2];
    if (month && year) return `${year}-${month}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    return `${slashMatch[2]}-${month}`;
  }

  return null;
}

type SectionKey =
  | 'summary'
  | 'organization'
  | 'experience'
  | 'certifications'
  | 'education'
  | 'skills'
  | 'projects'
  | 'unknown';

const SECTION_HEADERS: Record<SectionKey, RegExp> = {
  summary:
    /^[\s•\-\*\d.:\t\(\)]*(?:profile|profil|ringkasan|tentang saya|about me|summary|professional summary|ikhtisar)(?:[:\s-]*$)/i,
  organization:
    /^[\s•\-\*\d.:\t\(\)]*(?:organization experience|pengalaman organisasi|organisasi|organization|aktivitas kepanitiaan|volunteer)(?:[:\s-]*$)/i,
  experience:
    /^[\s•\-\*\d.:\t\(\)]*(?:work experience|professional experience|pengalaman kerja|pengalaman profesional|riwayat pekerjaan|employment history|pengalaman)(?:[:\s-]*$)/i,
  certifications:
    /^[\s•\-\*\d.:\t\(\)]*(?:course & certification|course & certifications|sertifikasi|kursus & sertifikasi|certifications|awards|honors|prestasi & sertifikasi|prestasi)(?:[:\s-]*$)/i,
  education:
    /^[\s•\-\*\d.:\t\(\)]*(?:education|pendidikan|riwayat pendidikan|academic background|latar belakang pendidikan)(?:[:\s-]*$)/i,
  skills:
    /^[\s•\-\*\d.:\t\(\)]*(?:skills & tools|skills and tools|keahlian & tools|keahlian|kemampuan|skills|technical skills|hard skills & soft skills)(?:[:\s-]*$)/i,
  projects:
    /^[\s•\-\*\d.:\t\(\)]*(?:projects|proyek|portofolio|portfolio|personal projects|pengalaman proyek)(?:[:\s-]*$)/i,
  unknown:
    /^[\s•\-\*\d.:\t\(\)]*(?:informasi tambahan|informasi tambahan lainnya|additional information|lain-lain|hobi|hobby|interests|other|keterangan lainnya)(?:[:\s-]*$)/i,
};

export function parseEducationLines(lines: string[]): ProfileEducation[] {
  const educations: ProfileEducation[] = [];

  let current: {
    institution?: string;
    degree?: string;
    field?: string;
    start_date?: string | null;
    end_date?: string | null;
    description?: string;
  } | null = null;

  function commit() {
    if (!current) return;
    let inst = (current.institution || '').trim();
    let field = (current.field || '').trim();
    let degree = (current.degree || '').trim();
    let desc = (current.description || '').trim();

    if (!inst && field) {
      if (/universitas|institut|institute|sekolah|madrasah|college|university|academy|padjadjaran/i.test(field)) {
        inst = field;
        field = '';
      }
    }

    if (/padjadjaran/i.test(inst) && !/universitas/i.test(inst)) {
      inst = 'Universitas Padjadjaran';
    }

    // Pisahkan grade / ipk dari field atau inst jika ada
    const gradeMatch = `${field} ${inst}`.match(
      /(?:average grade|grade|nilai rata-rata|ipk|gpa)\s*[:–—-]?\s*([0-9.,]+(?:\s*(?:out of|\/)\s*[0-9.,]+)?)/i,
    );
    if (gradeMatch) {
      const gradeText = `Average Grade / IPK: ${gradeMatch[1]}`;
      if (!desc.includes(gradeText)) {
        desc = (desc ? `${desc}\n` : '') + `• ${gradeText}`;
      }
      field = field.replace(gradeMatch[0], '').replace(/[–—-]\s*$/, '').trim();
      inst = inst.replace(gradeMatch[0], '').replace(/[–—-]\s*$/, '').trim();
    }

    // Deteksi jenjang & jurusan kontekstual
    if (
      /student of government administration/i.test(field) ||
      /student of government administration/i.test(inst)
    ) {
      if (!degree) degree = 'S1 (Sarjana)';
      field = 'Administrasi Pemerintahan';
    } else if (/science student/i.test(field) || /science student/i.test(inst)) {
      if (!degree) degree = 'Madrasah Aliyah (MA)';
      field = 'Ilmu Pengetahuan Alam (IPA / Science)';
    }

    if (!degree) {
      if (/s1|sarjana|bachelor/i.test(field)) degree = 'S1 (Sarjana)';
      else if (/s2|magister|master/i.test(field)) degree = 'S2 (Magister)';
      else if (/d3|diploma/i.test(field)) degree = 'D3 (Diploma)';
      else if (/d4/i.test(field)) degree = 'D4 (Sarjana Terapan)';
      else if (/ma\b|ma'?had|madrasah/i.test(inst)) degree = 'Madrasah Aliyah (MA)';
      else if (/sma\b|smk\b/i.test(inst)) degree = 'SMA / SMK';
    }

    inst = inst.replace(/[-–—\s]+$/, '').trim();

    if (inst || field) {
      educations.push({
        institution: inst || 'Institusi Pendidikan',
        degree: degree || null,
        field: field || null,
        start_date: current.start_date ?? null,
        end_date: current.end_date ?? null,
        description: desc || null,
      });
    }
    current = null;
  }

  for (const rawLine of lines) {
    const line = cleanExtractedPdfText(rawLine);
    if (!line) continue;

    const dateRangeMatch = line.match(
      /([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4})\s*(?:-|–|—|s\/d|to)\s*([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4}|present|sekarang|saat ini)/i,
    );

    const isInstLine =
      /universitas|institut|institute|sekolah|politeknik|polytechnic|academy|college|university|madrasah|ma'?had|ma\b|sma\b|smk\b|padjadjaran/i.test(
        line,
      );

    const isGrade = /average grade|nilai|ipk|gpa/i.test(line);

    if (isInstLine && !isGrade) {
      if (current && current.institution) {
        commit();
      }
      if (!current) current = {};
      let instText = line;
      if (dateRangeMatch) {
        instText = line.replace(dateRangeMatch[0], '').trim();
        current.start_date = normalizeDateMatch(dateRangeMatch[1]);
        current.end_date = /present|sekarang|saat ini/i.test(dateRangeMatch[2])
          ? null
          : normalizeDateMatch(dateRangeMatch[2]);
      }
      current.institution = instText;
      continue;
    }

    if (dateRangeMatch) {
      if (current && current.start_date) {
        commit();
      }
      if (!current) current = {};
      current.start_date = normalizeDateMatch(dateRangeMatch[1]);
      current.end_date = /present|sekarang|saat ini/i.test(dateRangeMatch[2])
        ? null
        : normalizeDateMatch(dateRangeMatch[2]);
      const rem = line.replace(dateRangeMatch[0], '').trim();
      if (rem.length > 2) {
        if (!current.field) current.field = rem;
        else current.description = (current.description ? `${current.description}\n` : '') + `• ${rem}`;
      }
      continue;
    }

    if (isGrade) {
      if (!current) current = {};
      const parts = line.split(/[–—-]/);
      if (parts.length >= 2 && /science student|student of|major/i.test(parts[0])) {
        if (!current.field) current.field = parts[0].trim();
        const gradePart = parts.slice(1).join('–').trim();
        const bullet = `• ${gradePart.replace(/^[•\-\*]\s*/, '')}`;
        current.description = current.description ? `${current.description}\n${bullet}` : bullet;
      } else {
        const bullet = `• ${line.replace(/^[•\-\*]\s*/, '')}`;
        current.description = current.description ? `${current.description}\n${bullet}` : bullet;
      }
      continue;
    }

    if (current) {
      if (!current.field) {
        current.field = line;
      } else {
        const bullet = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
        current.description = current.description ? `${current.description}\n${bullet}` : bullet;
      }
    } else {
      current = { field: line };
    }
  }

  commit();
  return educations;
}

export function detectSectionHeader(line: string): SectionKey | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 70) return null;

  // 1. Cek regex standar
  for (const [key, regex] of Object.entries(SECTION_HEADERS)) {
    if (regex.test(trimmed)) {
      return key as SectionKey;
    }
  }

  // 2. Cek variasi letter-spaced dari Canva/desain (misal "E D U C A T I O N", "P E N D I D I K A N")
  const compact = trimmed.replace(/[^a-zA-Z]/g, '').toLowerCase();

  if (
    /^(?:education|pendidikan|riwayatpendidikan|academicbackground|academic|educations|formaleducation|educationalbackground|pendidikanformal|latarbelakangpendidikan)$/i.test(
      compact,
    )
  ) {
    return 'education';
  }
  if (
    /^(?:organization|organisasi|pengalamanorganisasi|organizationexperience|organizationalexperience|organizational|aktivitaskepanitiaan|kepanitiaan|volunteer|volunteering|extracurricular)$/i.test(
      compact,
    )
  ) {
    return 'organization';
  }
  if (
    /^(?:workexperience|professionalexperience|pengalamankerja|pengalaman|riwayatpekerjaan|employmenthistory|pengalamanprofesional|experience|careerhistory|workhistory)$/i.test(
      compact,
    )
  ) {
    return 'experience';
  }
  if (
    /^(?:skills|keahlian|kemampuan|technicalskills|skillsandtools|skillsandabilities|kompetensi|hardsoftskills|skillstools)$/i.test(
      compact,
    )
  ) {
    return 'skills';
  }
  if (
    /^(?:certifications|courses|sertifikasi|kursussertifikasi|coursecertifications|awards|honors|prestasi|pelatihan|licenses)$/i.test(
      compact,
    )
  ) {
    return 'certifications';
  }
  if (
    /^(?:projects|proyek|portofolio|portfolio|personalprojects|academicprojects)$/i.test(compact)
  ) {
    return 'projects';
  }
  if (
    /^(?:summary|profile|profil|ringkasan|tentangsaya|aboutme|professionalsummary|ikhtisar)$/i.test(
      compact,
    )
  ) {
    return 'summary';
  }

  return null;
}

export function mapRawTextToCv(rawText: string, warnings?: string[]): MappedCvResult {
  const result = createDefaultCvContent();
  const unmappedLines: string[] = [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentSection: SectionKey = 'unknown';
  const sectionBuckets: Record<SectionKey, string[]> = {
    summary: [],
    organization: [],
    experience: [],
    certifications: [],
    education: [],
    skills: [],
    projects: [],
    unknown: [],
  };

  const foundUrls: string[] = [];
  let nameFound = false;

  for (let i = 0; i < Math.min(lines.length, 15); i += 1) {
    const line = lines[i];

    if (!result.profile.email) {
      const emailMatch = line.match(EMAIL_REGEX);
      if (emailMatch) {
        result.profile.email = emailMatch[0];
      }
    }

    if (!result.profile.phone) {
      const phoneMatch = line.match(PHONE_REGEX);
      if (phoneMatch) {
        result.profile.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
      }
    }

    if (!result.profile.location) {
      const lower = line.toLowerCase();
      for (const city of INDONESIAN_CITIES) {
        if (lower.includes(city)) {
          result.profile.location = city.charAt(0).toUpperCase() + city.slice(1);
          break;
        }
      }
    }

    const urlMatches = line.match(URL_REGEX);
    if (urlMatches) {
      for (const url of urlMatches) {
        if (!foundUrls.includes(url)) {
          foundUrls.push(url);
          let label = 'Tautan';
          if (url.includes('linkedin.com')) label = 'LinkedIn';
          else if (url.includes('github.com')) label = 'GitHub';
          result.profile.links.push({ label, url });
        }
      }
    }

    const isDocTitle = /^(curriculum vitae|resume|cv|biodata)$/i.test(line.trim());
    const isSectionHeader = Object.values(SECTION_HEADERS).some((r) => r.test(line));

    if (
      !nameFound &&
      !isDocTitle &&
      !isSectionHeader &&
      !line.match(EMAIL_REGEX) &&
      !line.match(PHONE_REGEX) &&
      !line.match(URL_REGEX) &&
      line.length >= 3 &&
      line.length <= 60 &&
      !line.includes(':')
    ) {
      result.profile.full_name = cleanExtractedPdfText(line);
      nameFound = true;
      continue;
    }

    const isHeaderLine = detectSectionHeader(line) !== null;
    if (
      nameFound &&
      !result.profile.headline &&
      line.length < 80 &&
      !line.includes('@') &&
      !isHeaderLine
    ) {
      result.profile.headline = line;
    }
  }

  for (const line of lines) {
    const matchedKey = detectSectionHeader(line);
    if (matchedKey) {
      currentSection = matchedKey;
      continue;
    }

    if (currentSection !== 'unknown') {
      sectionBuckets[currentSection].push(line);
    } else {
      sectionBuckets.unknown.push(line);
    }
  }

  // Summary
  if (sectionBuckets.summary.length > 0) {
    result.summary = sectionBuckets.summary.join(' ');
  }

  // Skills
  if (sectionBuckets.skills.length > 0) {
    const rawSkillsText = sectionBuckets.skills.join(', ');
    const tokens = rawSkillsText
      .split(/[,•|/\n]/)
      .map((s) => s.trim().replace(/^[-*•]\s*/, ''))
      .filter((s) => s.length >= 2 && s.length <= 50);

    result.skills = Array.from(new Set(tokens)).slice(0, 50);
  }

  // Experience (Pengalaman Kerja)
  const expLines = sectionBuckets.experience;
  const experiences: ProfileExperience[] = [];
  let currentExp: Partial<ProfileExperience> | null = null;

  for (const line of expLines) {
    const dateRangeMatch = line.match(
      /([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4})\s*(?:-|–|—|s\/d|to)\s*([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4}|present|sekarang|saat ini)/i,
    );

    if (dateRangeMatch) {
      if (currentExp && currentExp.company) {
        experiences.push({
          company: currentExp.company,
          title: currentExp.title ?? 'Posisi Pekerjaan',
          location: currentExp.location ?? null,
          start_date: currentExp.start_date ?? null,
          end_date: currentExp.end_date ?? null,
          current: !currentExp.end_date,
          description: currentExp.description || null,
        });
      }

      currentExp = {
        company: line.replace(dateRangeMatch[0], '').trim() || 'Perusahaan',
        title: '',
        location: null,
        start_date: normalizeDateMatch(dateRangeMatch[1]),
        end_date: /present|sekarang|saat ini/i.test(dateRangeMatch[2])
          ? null
          : normalizeDateMatch(dateRangeMatch[2]),
        current: /present|sekarang|saat ini/i.test(dateRangeMatch[2]),
        description: '',
      };
      continue;
    }

    if (currentExp) {
      if (!currentExp.title) {
        currentExp.title = line;
      } else {
        const bullet = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
        currentExp.description = currentExp.description
          ? `${currentExp.description}\n${bullet}`
          : bullet;
      }
    } else {
      currentExp = {
        company: line,
        title: '',
        location: null,
        start_date: null,
        end_date: null,
        current: false,
        description: '',
      };
    }
  }

  if (currentExp && currentExp.company) {
    experiences.push({
      company: currentExp.company,
      title: currentExp.title || 'Posisi Pekerjaan',
      location: currentExp.location ?? null,
      start_date: currentExp.start_date ?? null,
      end_date: currentExp.end_date ?? null,
      current: !currentExp.end_date,
      description: currentExp.description || null,
    });
  }
  result.experiences = experiences.slice(0, 20);

  // Organization
  const orgLines = sectionBuckets.organization;
  const organizations: ProfileOrganization[] = [];
  let currentOrg: Partial<ProfileOrganization> | null = null;

  for (const line of orgLines) {
    const dateRangeMatch = line.match(
      /([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4})\s*(?:-|–|s\/d|to)\s*([A-Za-z]+\s+\d{2,4}|\d{4}(?:-\d{2})?|\d{1,2}\/\d{4}|present|sekarang|saat ini)/i,
    );

    if (dateRangeMatch) {
      if (currentOrg && currentOrg.name) {
        organizations.push({
          name: currentOrg.name,
          role: currentOrg.role ?? null,
          start_date: currentOrg.start_date ?? null,
          end_date: currentOrg.end_date ?? null,
          description: currentOrg.description ?? null,
        });
      }

      currentOrg = {
        name: line.replace(dateRangeMatch[0], '').trim() || 'Organisasi',
        role: null,
        start_date: normalizeDateMatch(dateRangeMatch[1]),
        end_date: /present|sekarang/i.test(dateRangeMatch[2]) ? null : normalizeDateMatch(dateRangeMatch[2]),
        description: '',
      };
      continue;
    }

    if (currentOrg) {
      if (!currentOrg.role) {
        currentOrg.role = line;
      } else {
        const bullet = line.startsWith('•') || line.startsWith('-') ? line : `• ${line}`;
        currentOrg.description = currentOrg.description ? `${currentOrg.description}\n${bullet}` : bullet;
      }
    } else {
      currentOrg = {
        name: line,
        role: null,
        start_date: null,
        end_date: null,
        description: '',
      };
    }
  }

  if (currentOrg && currentOrg.name) {
    organizations.push({
      name: currentOrg.name,
      role: currentOrg.role ?? null,
      start_date: currentOrg.start_date ?? null,
      end_date: currentOrg.end_date ?? null,
      description: currentOrg.description || null,
    });
  }

  // Pemisahan cerdas: Cek apakah ada entri pendidikan yang keliru masuk ke Organisasi
  const finalOrgs: ProfileOrganization[] = [];
  const transferredEduEntries: ProfileEducation[] = [];

  for (const org of organizations) {
    const combined = `${org.name} ${org.role || ''} ${org.description || ''}`.toLowerCase();
    const isEduEntry =
      /student of|science student|ma ma'had|ma'had|average grade|ipk|gpa/i.test(
        combined,
      ) &&
      !/hima|k\s*abim|media and publication|kepanitiaan|ketua\b|wakil\b|staff of media/i.test(combined);

    if (isEduEntry) {
      let inst = org.name;
      let field = org.role || '';
      let degree = '';
      let desc = org.description || '';

      if (inst.includes('@')) {
        const parts = inst.split('@').map((s) => s.trim());
        field = parts[0];
        inst = parts.slice(1).join(' @ ');
      }

      if (/padjadjaran/i.test(inst) && !/universitas/i.test(inst)) {
        inst = 'Universitas Padjadjaran';
      }

      const gradeMatch = `${field} ${inst}`.match(
        /(?:average grade|grade|nilai rata-rata|ipk|gpa)\s*[:–—-]?\s*([0-9.,]+(?:\s*(?:out of|\/)\s*[0-9.,]+)?)/i,
      );
      if (gradeMatch) {
        const gradeText = `Average Grade / IPK: ${gradeMatch[1]}`;
        if (!desc.includes(gradeText)) {
          desc = (desc ? `${desc}\n` : '') + `• ${gradeText}`;
        }
        field = field.replace(gradeMatch[0], '').replace(/[–—-]\s*$/, '').trim();
        inst = inst.replace(gradeMatch[0], '').replace(/[–—-]\s*$/, '').trim();
      }

      if (
        /student of government administration/i.test(field) ||
        /student of government administration/i.test(inst)
      ) {
        degree = 'S1 (Sarjana)';
        field = 'Administrasi Pemerintahan';
      } else if (
        /science student/i.test(field) ||
        /science student/i.test(inst)
      ) {
        degree = 'Madrasah Aliyah (MA)';
        field = 'Ilmu Pengetahuan Alam (IPA / Science)';
      }

      if (!degree) {
        if (/s1|sarjana|bachelor/i.test(field)) degree = 'S1 (Sarjana)';
        else if (/s2|magister|master/i.test(field)) degree = 'S2 (Magister)';
        else if (/d3|diploma/i.test(field)) degree = 'D3 (Diploma)';
        else if (/d4/i.test(field)) degree = 'D4 (Sarjana Terapan)';
        else if (/sma|smk|ma|madrasah/i.test(inst)) degree = 'SMA / MA / Sederajat';
      }

      inst = inst.replace(/[-–—\s]+$/, '').trim();

      transferredEduEntries.push({
        institution: inst || 'Institusi Pendidikan',
        degree: degree || null,
        field: field || null,
        start_date: org.start_date,
        end_date: org.end_date,
        description: desc || null,
      });
    } else {
      finalOrgs.push(org);
    }
  }

  result.organizations = finalOrgs.slice(0, 20);

  // Education: Parse baris di section pendidikan dan gabungkan dengan transferredEduEntries
  const parsedEdu = parseEducationLines(sectionBuckets.education);
  const combinedEdu: ProfileEducation[] = [...parsedEdu];
  for (const trans of transferredEduEntries) {
    const alreadyExists = combinedEdu.some(
      (e) =>
        e.institution.toLowerCase().includes(trans.institution.toLowerCase()) ||
        trans.institution.toLowerCase().includes(e.institution.toLowerCase()),
    );
    if (!alreadyExists) {
      combinedEdu.push(trans);
    }
  }
  result.education = combinedEdu.slice(0, 20);

  // Projects (Portofolio & Proyek)
  const projLines = sectionBuckets.projects;
  const projects: ProfileProject[] = [];
  let currentProj: Partial<ProfileProject> | null = null;

  for (const line of projLines) {
    const isBullet = line.startsWith('•') || line.startsWith('-') || line.startsWith('*');
    if (!isBullet && (!currentProj || currentProj.description)) {
      if (currentProj && currentProj.name) {
        projects.push({
          name: currentProj.name,
          start_date: currentProj.start_date ?? null,
          end_date: currentProj.end_date ?? null,
          description: currentProj.description || null,
          url: currentProj.url ?? null,
        });
      }
      currentProj = {
        name: line,
        start_date: null,
        end_date: null,
        description: '',
        url: null,
      };
    } else if (currentProj) {
      const bullet = isBullet ? line : `• ${line}`;
      currentProj.description = currentProj.description
        ? `${currentProj.description}\n${bullet}`
        : bullet;
    }
  }

  if (currentProj && currentProj.name) {
    projects.push({
      name: currentProj.name,
      start_date: currentProj.start_date ?? null,
      end_date: currentProj.end_date ?? null,
      description: currentProj.description || null,
      url: currentProj.url ?? null,
    });
  }
  result.projects = projects.slice(0, 20);

  // Certifications
  const certLines = sectionBuckets.certifications;
  const certs: ProfileAchievement[] = [];
  for (const line of certLines) {
    const dateMatch = line.match(/\b(20\d{2})\b/);
    certs.push({
      title: line.replace(/^[•\-\*]\s*/, '').trim(),
      issuer: null,
      date: dateMatch ? dateMatch[1] : null,
      description: null,
    });
  }
  result.achievements = certs;

  for (const unmapped of sectionBuckets.unknown) {
    if (
      unmapped !== result.profile.full_name &&
      unmapped !== result.profile.headline &&
      !unmapped.match(EMAIL_REGEX) &&
      !unmapped.match(PHONE_REGEX)
    ) {
      unmappedLines.push(unmapped);
    }
  }

  if (unmappedLines.length > 0) {
    result.raw_unmapped = unmappedLines.map((line) => ({ text: line }));
  }

  return {
    content: result,
    unmappedLines,
    warnings,
    confidence: {
      contactFound: Boolean(result.profile.email || result.profile.phone),
      organizationFound: result.organizations.length > 0,
      experienceFound: result.experiences.length > 0,
      educationFound: result.education.length > 0,
      skillsFound: result.skills.length > 0,
    },
  };
}
