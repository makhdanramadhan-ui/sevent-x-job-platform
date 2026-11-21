import type {
  ProfileAchievement,
  ProfileEducation,
  ProfileExperience,
  ProfileLink,
  ProfileOrganization,
  ProfileProject,
} from '@/lib/contracts';

export type CvLanguage = 'id' | 'en';

export type CvProfileInfo = {
  full_name: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  photo_url?: string | null;
  links: ProfileLink[];
};

export type CvBuiltinSectionId =
  | 'profile'
  | 'summary'
  | 'experience'
  | 'education'
  | 'organization'
  | 'projects'
  | 'skills'
  | 'certifications'
  | 'achievements'
  | 'custom';

export type CvCustomSectionId = `custom:${string}`;

export type CvSectionId = CvBuiltinSectionId | CvCustomSectionId;

export const BUILTIN_SECTION_IDS: readonly CvBuiltinSectionId[] = [
  'profile',
  'summary',
  'experience',
  'education',
  'organization',
  'projects',
  'skills',
  'certifications',
  'achievements',
  'custom',
] as const;

export type CvCustomSection = {
  id: string;
  title: string;
  content: string;
};

export type CvRawUnmappedItem = {
  title?: string;
  text: string;
};

export type CvContent = {
  version: 'v1';
  language: CvLanguage;
  summary: string;
  profile: CvProfileInfo;
  organizations: ProfileOrganization[];
  experiences: ProfileExperience[];
  education: ProfileEducation[];
  achievements: ProfileAchievement[]; // Digunakan juga untuk Course & Certification
  skills: string[];
  projects: ProfileProject[];
  custom_sections?: CvCustomSection[];
  section_titles?: Partial<Record<string, string>>;
  section_order: CvSectionId[];
  hidden_sections: CvSectionId[];
  raw_unmapped?: CvRawUnmappedItem[];
};

export const SECTION_LABELS: Record<CvLanguage, Record<CvBuiltinSectionId, string>> = {
  id: {
    profile: 'Identitas & Kontak',
    summary: 'Ringkasan Profil',
    experience: 'Pengalaman Kerja',
    education: 'Pendidikan',
    organization: 'Pengalaman Organisasi',
    projects: 'Proyek & Portofolio',
    skills: 'Keahlian & Tools',
    certifications: 'Kursus & Sertifikasi',
    achievements: 'Penghargaan & Sertifikasi',
    custom: 'Bagian Tambahan',
  },
  en: {
    profile: 'Identity & Contact',
    summary: 'Profile Summary',
    experience: 'Work Experience',
    education: 'Education',
    organization: 'Organization Experience',
    projects: 'Projects',
    skills: 'Skills & Tools',
    certifications: 'Courses & Certifications',
    achievements: 'Awards & Achievements',
    custom: 'Additional Section',
  },
};

export const SECTION_DISPLAY_LABELS: Record<CvBuiltinSectionId, string> = {
  profile: 'Identitas & Kontak',
  summary: 'Ringkasan Profil',
  experience: 'Pengalaman Kerja',
  education: 'Pendidikan',
  organization: 'Pengalaman Organisasi',
  projects: 'Proyek & Portofolio',
  skills: 'Keahlian & Tools',
  certifications: 'Kursus & Sertifikasi',
  achievements: 'Penghargaan & Sertifikasi',
  custom: 'Bagian Tambahan',
};

export const SECTION_SHORT_LABELS: Record<CvBuiltinSectionId, string> = {
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

export const DEFAULT_SECTION_ORDER: CvBuiltinSectionId[] = [
  'profile',
  'summary',
  'experience',
  'education',
  'organization',
  'projects',
  'skills',
  'certifications',
];

export function isBuiltinSectionId(secId: string): secId is CvBuiltinSectionId {
  return (BUILTIN_SECTION_IDS as readonly string[]).includes(secId);
}

export function isCustomSectionId(secId: string): secId is CvCustomSectionId {
  return secId.startsWith('custom:') && secId.length > 'custom:'.length;
}

export function getCustomSectionKey(secId: CvCustomSectionId): string {
  return secId.slice('custom:'.length);
}

export function findCustomSection(content: CvContent, secId: CvSectionId): CvCustomSection | undefined {
  if (!isCustomSectionId(secId)) return undefined;
  const key = getCustomSectionKey(secId);
  return content.custom_sections?.find((item) => item.id === key);
}

export function getSectionDisplayTitle(content: CvContent, secId: CvSectionId): string {
  if (isCustomSectionId(secId)) {
    return findCustomSection(content, secId)?.title.trim() || 'Bagian Tambahan';
  }
  const customTitle = content.section_titles?.[secId]?.trim();
  if (customTitle) return customTitle;
  return SECTION_DISPLAY_LABELS[secId] ?? String(secId);
}

export function getSectionTabTitle(content: CvContent, secId: CvSectionId): string {
  if (isCustomSectionId(secId)) {
    return findCustomSection(content, secId)?.title.trim() || 'Tambahan';
  }
  const customTitle = content.section_titles?.[secId]?.trim();
  if (customTitle) return customTitle;
  return SECTION_SHORT_LABELS[secId] ?? String(secId);
}

export function getSectionAtsHeading(content: CvContent, secId: CvSectionId): string {
  if (isCustomSectionId(secId)) {
    return findCustomSection(content, secId)?.title.trim() || 'Bagian Tambahan';
  }
  const customTitle = content.section_titles?.[secId]?.trim();
  if (customTitle) return customTitle;
  const langLabels = SECTION_LABELS[content.language || 'en'] || SECTION_LABELS.en;
  return langLabels[secId] ?? String(secId);
}
