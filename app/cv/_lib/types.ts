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
  links: ProfileLink[];
};

export type CvSectionId =
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
  section_order: CvSectionId[];
  hidden_sections: CvSectionId[];
  raw_unmapped?: CvRawUnmappedItem[];
};

export const SECTION_LABELS: Record<CvLanguage, Record<CvSectionId, string>> = {
  id: {
    profile: 'IDENTITAS & KONTAK',
    summary: 'PROFIL',
    experience: 'PENGALAMAN KERJA',
    education: 'PENDIDIKAN',
    organization: 'PENGALAMAN ORGANISASI',
    projects: 'PROYEK & PORTOFOLIO',
    skills: 'KEAHLIAN & TOOLS',
    certifications: 'KURSUS & SERTIFIKASI',
    achievements: 'PENCAPAIAN & PENGHARGAAN',
    custom: 'BAGIAN TAMBAHAN',
  },
  en: {
    profile: 'IDENTITY & CONTACT',
    summary: 'PROFILE',
    experience: 'WORK EXPERIENCE',
    education: 'EDUCATION',
    organization: 'ORGANIZATION EXPERIENCE',
    projects: 'PROJECTS & PORTFOLIO',
    skills: 'SKILLS & TOOLS',
    certifications: 'COURSE & CERTIFICATION',
    achievements: 'AWARDS & ACHIEVEMENTS',
    custom: 'ADDITIONAL SECTION',
  },
};

export const DEFAULT_SECTION_ORDER: CvSectionId[] = [
  'profile',
  'summary',
  'experience',
  'education',
  'organization',
  'projects',
  'skills',
  'certifications',
];
