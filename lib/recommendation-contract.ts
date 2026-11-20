import type { EmploymentType, ExperienceLevel, Job, ProfileRecord, WorkMode } from './contracts';

export type RecommendationProfileInput = Pick<
  ProfileRecord,
  'skills' | 'education' | 'experiences' | 'projects' | 'preferences'
> | null;

export type RecommendationJobInput = Pick<
  Job,
  | 'id'
  | 'title'
  | 'company'
  | 'location'
  | 'work_mode'
  | 'employment_type'
  | 'level'
  | 'education'
  | 'skills'
  | 'status'
  | 'deadline'
>;

export type RecommendationJobInputWithContext = RecommendationJobInput & {
  company_logo_url?: string | null;
  last_fetched_at?: string | null;
  description?: string | null;
};

export type RecommendationJobCard = Pick<
  Job,
  | 'id'
  | 'title'
  | 'company'
  | 'company_logo_url'
  | 'location'
  | 'work_mode'
  | 'employment_type'
  | 'level'
  | 'status'
  | 'last_fetched_at'
>;

export type RecommendationSource = {
  source_name: string;
  source_url: string | null;
};

export type RecommendationItem = {
  job_id: string;
  score: number;
  matched: string[];
  missing: string[];
  unknown: string[];
  job?: RecommendationJobCard | null;
  source?: RecommendationSource | null;
};

export type RecommendationInput = {
  profile: RecommendationProfileInput;
  jobs: RecommendationJobInput[];
};

export type RecommendationOutput = {
  contract_version: 1;
  items: RecommendationItem[];
};

export type RecommendationFilters = {
  work_modes: WorkMode[];
  employment_types: EmploymentType[];
  levels: ExperienceLevel[];
};
