export const WORK_MODES = ['onsite', 'hybrid', 'remote', 'unknown'] as const;
export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'internship',
  'freelance',
  'temporary',
  'unknown',
] as const;
export const EXPERIENCE_LEVELS = [
  'intern',
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'unknown',
] as const;
export const JOB_STATUSES = ['open', 'closed', 'unknown'] as const;

export type WorkMode = (typeof WORK_MODES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobSource = {
  id: string;
  job_id: string;
  source_name: string;
  source_job_id: string;
  source_url: string;
  published_at: string | null;
  fetched_at: string;
  created_at: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  work_mode: WorkMode;
  employment_type: EmploymentType;
  level: ExperienceLevel;
  education: string | null;
  skills: string[];
  description: string | null;
  deadline: string | null;
  status: JobStatus;
  first_seen_at: string;
  last_seen_at: string;
  last_fetched_at: string | null;
  updated_at: string;
};

export type JobDetail = Job & {
  job_sources: JobSource[];
};

export type ProfileLink = {
  label: string;
  url: string;
};

export type ProfileEducation = {
  institution: string;
  degree: string | null;
  field: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type ProfileExperience = {
  company: string;
  title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  description: string | null;
};

export type ProfileProject = {
  name: string;
  url: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type ProfileOrganization = {
  name: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

export type ProfileAchievement = {
  title: string;
  issuer: string | null;
  date: string | null;
  description: string | null;
};

export type ProfilePreferences = {
  positions: string[];
  locations: string[];
  levels: ExperienceLevel[];
  work_modes: WorkMode[];
  employment_types: EmploymentType[];
};

export type ProfileRecord = {
  user_id: string;
  full_name: string | null;
  headline: string | null;
  phone: string | null;
  location: string | null;
  links: ProfileLink[];
  skills: string[];
  education: ProfileEducation[];
  experiences: ProfileExperience[];
  projects: ProfileProject[];
  organizations: ProfileOrganization[];
  achievements: ProfileAchievement[];
  preferences: ProfilePreferences;
  created_at: string;
  updated_at: string;
};

export type BookmarkRecord = {
  job_id: string;
  created_at: string;
  jobs: Job | null;
};

export type CvDocumentSummary = {
  id: string;
  title: string;
  template_version: string;
  created_at: string;
  updated_at: string;
};

export type CvDocument = CvDocumentSummary & {
  content: Record<string, unknown>;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiSuccess<T> = {
  data: T;
};

export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  avatar_source?: 'custom' | 'provider' | null;
};

export type AuthMeData = {
  user: AuthUser;
  auth_mode: 'cookie' | 'bearer';
  has_profile: boolean;
};
