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
  summary: /^(profile|profil|ringkasan|tentang saya|about me|summary|professional summary|ikhtisar)/i,
  organization:
    /^(organization experience|pengalaman organisasi|organisasi|organization|aktivitas kepanitiaan|volunteer)/i,
  experience:
    /^(work experience|professional experience|pengalaman kerja|pengalaman|riwayat pekerjaan|employment history)/i,
  certifications:
    /^(course & certification|course & certifications|sertifikasi|kursus & sertifikasi|certifications|awards|honors)/i,
  education: /^(education|pendidikan|riwayat pendidikan|academic background)/i,
  skills: /^(skills & tools|skills and tools|keahlian & tools|keahlian|kemampuan|skills|technical skills)/i,
  projects: /^(projects|proyek|portofolio|portfolio|personal projects)/i,
  unknown:
    /^(informasi tambahan|informasi tambahan lainnya|additional information|lain-lain|hobi|hobby|interests|other|keterangan lainnya)(?:[:\s-]*$)/i,
};

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

    if (
      !nameFound &&
      !line.match(EMAIL_REGEX) &&
      !line.match(PHONE_REGEX) &&
      !line.match(URL_REGEX) &&
      line.length >= 3 &&
      line.length <= 60 &&
      !line.includes(':')
    ) {
      result.profile.full_name = line;
      nameFound = true;
      continue;
    }

    const isHeaderLine = Object.values(SECTION_HEADERS).some((r) => r.test(line));
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
    let matchedHeader = false;
    for (const [key, regex] of Object.entries(SECTION_HEADERS)) {
      if (regex.test(line)) {
        currentSection = key as SectionKey;
        matchedHeader = true;
        break;
      }
    }

    if (matchedHeader) continue;

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
  result.organizations = organizations.slice(0, 20);

  // Education
  const eduLines = sectionBuckets.education;
  const educations: ProfileEducation[] = [];
  let currentEdu: Partial<ProfileEducation> | null = null;

  for (const line of eduLines) {
    const isInst = /universitas|institut|sekolah|politeknik|academy|college|university|smk|sma|ma /i.test(
      line,
    );
    if (isInst) {
      if (currentEdu && currentEdu.institution) {
        educations.push({
          institution: currentEdu.institution,
          degree: currentEdu.degree ?? null,
          field: currentEdu.field ?? null,
          start_date: currentEdu.start_date ?? null,
          end_date: currentEdu.end_date ?? null,
          description: currentEdu.description ?? null,
        });
      }
      currentEdu = {
        institution: line.slice(0, 180),
        degree: null,
        field: null,
        start_date: null,
        end_date: null,
        description: null,
      };
    } else if (currentEdu) {
      if (!currentEdu.field) {
        currentEdu.field = line;
      } else {
        currentEdu.description = ((currentEdu.description || '') + ' ' + line).trim();
      }
    }
  }

  if (currentEdu && currentEdu.institution) {
    educations.push({
      institution: currentEdu.institution,
      degree: currentEdu.degree ?? null,
      field: currentEdu.field ?? null,
      start_date: currentEdu.start_date ?? null,
      end_date: currentEdu.end_date ?? null,
      description: currentEdu.description ?? null,
    });
  }
  result.education = educations.slice(0, 20);

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
