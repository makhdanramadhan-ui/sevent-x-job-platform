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

export type RecommendationItem = {
  job_id: string;
  score: number;
  matched: string[];
  missing: string[];
  unknown: string[];
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
