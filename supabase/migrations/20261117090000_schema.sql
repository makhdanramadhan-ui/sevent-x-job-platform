create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  headline text,
  phone text,
  location text,
  links jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  education jsonb not null default '[]'::jsonb,
  experiences jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  organizations jsonb not null default '[]'::jsonb,
  achievements jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) between 1 and 120),
  constraint profiles_headline_length check (headline is null or char_length(headline) <= 200),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 40),
  constraint profiles_location_length check (location is null or char_length(location) <= 120),
  constraint profiles_links_shape check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 10),
  constraint profiles_skills_count check (coalesce(array_length(skills, 1), 0) <= 50),
  constraint profiles_education_shape check (jsonb_typeof(education) = 'array' and jsonb_array_length(education) <= 20),
  constraint profiles_experiences_shape check (jsonb_typeof(experiences) = 'array' and jsonb_array_length(experiences) <= 20),
  constraint profiles_projects_shape check (jsonb_typeof(projects) = 'array' and jsonb_array_length(projects) <= 20),
  constraint profiles_organizations_shape check (jsonb_typeof(organizations) = 'array' and jsonb_array_length(organizations) <= 20),
  constraint profiles_achievements_shape check (jsonb_typeof(achievements) = 'array' and jsonb_array_length(achievements) <= 20),
  constraint profiles_preferences_shape check (jsonb_typeof(preferences) = 'object')
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  location text,
  work_mode text not null default 'unknown',
  employment_type text not null default 'unknown',
  level text not null default 'unknown',
  education text,
  skills text[] not null default '{}',
  description text,
  deadline date,
  status text not null default 'unknown',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_fetched_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint jobs_title_length check (char_length(title) between 1 and 300),
  constraint jobs_company_length check (char_length(company) between 1 and 200),
  constraint jobs_location_length check (location is null or char_length(location) <= 120),
  constraint jobs_education_length check (education is null or char_length(education) <= 200),
  constraint jobs_description_length check (description is null or char_length(description) <= 20000),
  constraint jobs_skills_count check (coalesce(array_length(skills, 1), 0) <= 100),
  constraint jobs_work_mode_values check (work_mode in ('onsite', 'hybrid', 'remote', 'unknown')),
  constraint jobs_employment_type_values check (employment_type in ('full_time', 'part_time', 'contract', 'internship', 'freelance', 'temporary', 'unknown')),
  constraint jobs_level_values check (level in ('intern', 'entry', 'junior', 'mid', 'senior', 'lead', 'unknown')),
  constraint jobs_status_values check (status in ('open', 'closed', 'unknown'))
);

create table if not exists public.job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  source_name text not null,
  source_job_id text not null,
  source_url text not null,
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint job_sources_name_length check (char_length(source_name) between 1 and 80),
  constraint job_sources_source_job_id_length check (char_length(source_job_id) between 1 and 200),
  constraint job_sources_url check (source_url ~ '^https?://' and char_length(source_url) <= 2048),
  constraint job_sources_identity unique (source_name, source_job_id)
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  template_version text not null default 'v1',
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cv_documents_title_length check (char_length(title) between 1 and 200),
  constraint cv_documents_template_version_length check (char_length(template_version) between 1 and 40),
  constraint cv_documents_content_shape check (jsonb_typeof(content) = 'object' and pg_column_size(content) <= 131072)
);

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_last_fetched_at_idx on public.jobs (last_fetched_at desc nulls last);
create index if not exists job_sources_job_id_idx on public.job_sources (job_id);
create index if not exists bookmarks_job_id_idx on public.bookmarks (job_id);
create index if not exists cv_documents_user_updated_idx on public.cv_documents (user_id, updated_at desc);
