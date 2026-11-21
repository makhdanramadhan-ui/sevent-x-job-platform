import type {
  ProfileAchievement,
  ProfileEducation,
  ProfileExperience,
  ProfileLink,
  ProfileOrganization,
  ProfileProject,
  ProfileRecord,
} from '@/lib/contracts';
import type { ProfileInput } from '@/lib/profile';
import {
  type CvContent,
  DEFAULT_SECTION_ORDER,
} from './types';

export function getSampleAtsCvContent(): CvContent {
  return {
    version: 'v1',
    language: 'id',
    summary:
      'Mahasiswa tingkat akhir Program Studi Teknik Informatika dengan ketertarikan tinggi pada pengembangan web dan teknologi cloud. Aktif berkontribusi dalam organisasi kemahasiswaan serta memiliki kemampuan komunikasi, kerja sama tim, dan kepemimpinan yang baik.',
    profile: {
      full_name: 'Budi Santoso',
      headline: 'Fresh Graduate Teknik Informatika',
      email: 'budi.santoso@example.com',
      phone: '081234567890',
      location: 'Jakarta, Indonesia',
      links: [
        { label: 'linkedin.com/in/budisantoso', url: 'https://linkedin.com' },
        { label: 'github.com/budisantoso', url: 'https://github.com' },
      ],
    },
    organizations: [
      {
        name: 'Himpunan Mahasiswa Informatika',
        role: 'Ketua Divisi Media & Publikasi',
        start_date: '2024-01',
        end_date: '2024-12',
        description:
          '• Mengelola publikasi informasi dan media sosial organisasi dengan peningkatan interaksi sebesar 35%\n• Memimpin tim beranggotakan 6 orang untuk dokumentasi dan publikasi kegiatan tahunan\n• Menyusun strategi konten visual dan kalender publikasi berkala',
      },
      {
        name: 'Komite Seminar Nasional Teknologi',
        role: 'Koordinator Acara',
        start_date: '2024-05',
        end_date: '2024-06',
        description:
          '• Merancang susunan acara dan mengoordinasikan jalannya seminar yang dihadiri 300+ peserta\n• Berkolaborasi dengan pembicara industri dan tim logistik untuk kelancaran kegiatan',
      },
    ],
    experiences: [
      {
        company: 'PT Solusi Teknologi Nusantara',
        title: 'Frontend Developer Intern',
        location: 'Jakarta',
        start_date: '2024-07',
        end_date: '2024-10',
        current: false,
        description:
          '• Mengembangkan modul antarmuka pengguna berbasis Next.js dan TypeScript\n• Mengoptimalkan kecepatan muat halaman dan memastikan responsivitas lintas perangkat',
      },
    ],
    education: [
      {
        institution: 'Universitas Indonesia',
        degree: 'S1',
        field: 'Teknik Informatika – IPK 3.75/4.00',
        start_date: '2021-08',
        end_date: '2025-07',
        description: null,
      },
    ],
    achievements: [
      {
        title: 'Cloud Practitioner Certification',
        issuer: 'AWS Training & Certification',
        date: '2024',
        description: null,
      },
    ],
    skills: [
      'JavaScript',
      'TypeScript',
      'React.js',
      'Next.js',
      'HTML & CSS',
      'Git & GitHub',
      'Komunikasi',
      'Kerja Sama Tim',
      'Problem Solving',
    ],
    projects: [
      {
        name: 'Platform Job Matching & Career Portal',
        url: 'https://github.com',
        start_date: '2024-03',
        end_date: '2024-06',
        description:
          '• Membangun portal lowongan kerja interaktif dengan fitur pencarian dan filter keahlian\n• Mengintegrasikan antarmuka responsif dengan standar aksesibilitas web',
      },
    ],
    custom_sections: [],
    section_order: [...DEFAULT_SECTION_ORDER],
    hidden_sections: [],
  };
}

export function createDefaultCvContent(
  profile?: ProfileRecord | ProfileInput | null,
  userEmail?: string,
): CvContent {
  return {
    version: 'v1',
    language: 'id',
    summary: profile?.headline ? `Profesional di bidang ${profile.headline}.` : '',
    profile: {
      full_name: profile?.full_name ?? '',
      headline: profile?.headline ?? '',
      email: userEmail ?? '',
      phone: profile?.phone ?? '',
      location: profile?.location ?? '',
      links: Array.isArray(profile?.links)
        ? (profile.links as ProfileLink[]).map((l: ProfileLink) => ({ label: l.label, url: l.url }))
        : [],
    },
    organizations: Array.isArray(profile?.organizations)
      ? (profile.organizations as ProfileOrganization[]).map((org: ProfileOrganization) => ({
          name: org.name,
          role: org.role ?? null,
          start_date: org.start_date ?? null,
          end_date: org.end_date ?? null,
          description: org.description ?? null,
        }))
      : [],
    experiences: Array.isArray(profile?.experiences)
      ? (profile.experiences as ProfileExperience[]).map((exp: ProfileExperience) => ({
          company: exp.company,
          title: exp.title,
          location: exp.location ?? null,
          start_date: exp.start_date ?? null,
          end_date: exp.end_date ?? null,
          current: Boolean(exp.current),
          description: exp.description ?? null,
        }))
      : [],
    education: Array.isArray(profile?.education)
      ? (profile.education as ProfileEducation[]).map((edu: ProfileEducation) => ({
          institution: edu.institution,
          degree: edu.degree ?? null,
          field: edu.field ?? null,
          start_date: edu.start_date ?? null,
          end_date: edu.end_date ?? null,
          description: edu.description ?? null,
        }))
      : [],
    achievements: Array.isArray(profile?.achievements)
      ? (profile.achievements as ProfileAchievement[]).map((ach: ProfileAchievement) => ({
          title: ach.title,
          issuer: ach.issuer ?? null,
          date: ach.date ?? null,
          description: ach.description ?? null,
        }))
      : [],
    skills: Array.isArray(profile?.skills) ? [...profile.skills] : [],
    projects: Array.isArray(profile?.projects)
      ? (profile.projects as ProfileProject[]).map((proj: ProfileProject) => ({
          name: proj.name,
          url: proj.url ?? null,
          start_date: proj.start_date ?? null,
          end_date: proj.end_date ?? null,
          description: proj.description ?? null,
        }))
      : [],
    custom_sections: [],
    section_order: [...DEFAULT_SECTION_ORDER],
    hidden_sections: [],
  };
}

export function normalizeCvContent(raw: unknown, userEmail?: string): CvContent {
  if (!raw || typeof raw !== 'object') {
    return createDefaultCvContent(null, userEmail);
  }
  const obj = raw as Record<string, unknown>;
  const base = createDefaultCvContent(null, userEmail);

  const profileRaw = (obj.profile as Record<string, unknown>) ?? {};
  const profile: CvContent['profile'] = {
    full_name: typeof profileRaw.full_name === 'string' ? profileRaw.full_name : '',
    headline: typeof profileRaw.headline === 'string' ? profileRaw.headline : '',
    email: typeof profileRaw.email === 'string' ? profileRaw.email : (userEmail ?? ''),
    phone: typeof profileRaw.phone === 'string' ? profileRaw.phone : '',
    location: typeof profileRaw.location === 'string' ? profileRaw.location : '',
    links: Array.isArray(profileRaw.links)
      ? profileRaw.links
          .filter((l): l is { label: string; url: string } => Boolean(l && typeof l === 'object'))
          .map((l) => ({ label: String(l.label || ''), url: String(l.url || '') }))
      : [],
  };

  const sectionOrderRaw = Array.isArray(obj.section_order) ? obj.section_order : DEFAULT_SECTION_ORDER;
  const filteredOrder = sectionOrderRaw.filter(
    (s): s is CvContent['section_order'][number] => typeof s === 'string',
  );
  // Deduplikasi urutan bagian agar tidak ada bagian yang muncul ganda
  const section_order = Array.from(new Set(filteredOrder));

  const hiddenSectionsRaw = Array.isArray(obj.hidden_sections) ? obj.hidden_sections : [];
  const hidden_sections = Array.from(
    new Set(hiddenSectionsRaw.filter((s): s is CvContent['hidden_sections'][number] => typeof s === 'string')),
  );

  return {
    version: 'v1',
    language: obj.language === 'en' ? 'en' : 'id',
    summary: typeof obj.summary === 'string' ? obj.summary : base.summary,
    profile,
    organizations: Array.isArray(obj.organizations)
      ? (obj.organizations as CvContent['organizations'])
      : [],
    experiences: Array.isArray(obj.experiences) ? (obj.experiences as CvContent['experiences']) : [],
    education: Array.isArray(obj.education) ? (obj.education as CvContent['education']) : [],
    achievements: Array.isArray(obj.achievements)
      ? (obj.achievements as CvContent['achievements'])
      : [],
    skills: Array.isArray(obj.skills)
      ? (obj.skills.filter((s): s is string => typeof s === 'string') as string[])
      : [],
    projects: Array.isArray(obj.projects) ? (obj.projects as CvContent['projects']) : [],
    custom_sections: Array.isArray(obj.custom_sections)
      ? (obj.custom_sections as CvContent['custom_sections'])
      : [],
    section_order: section_order.length > 0 ? section_order : [...DEFAULT_SECTION_ORDER],
    hidden_sections,
    raw_unmapped: Array.isArray(obj.raw_unmapped)
      ? (obj.raw_unmapped as CvContent['raw_unmapped'])
      : undefined,
  };
}
