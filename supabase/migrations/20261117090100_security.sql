grant usage on schema public to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_sources enable row level security;
alter table public.bookmarks enable row level security;
alter table public.cv_documents enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own on public.profiles
  for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists jobs_select_authenticated on public.jobs;
create policy jobs_select_authenticated on public.jobs
  for select to authenticated
  using (true);

drop policy if exists job_sources_select_authenticated on public.job_sources;
create policy job_sources_select_authenticated on public.job_sources
  for select to authenticated
  using (true);

drop policy if exists bookmarks_select_own on public.bookmarks;
create policy bookmarks_select_own on public.bookmarks
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists bookmarks_insert_own on public.bookmarks;
create policy bookmarks_insert_own on public.bookmarks
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists bookmarks_delete_own on public.bookmarks;
create policy bookmarks_delete_own on public.bookmarks
  for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists cv_documents_select_own on public.cv_documents;
create policy cv_documents_select_own on public.cv_documents
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists cv_documents_insert_own on public.cv_documents;
create policy cv_documents_insert_own on public.cv_documents
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists cv_documents_update_own on public.cv_documents;
create policy cv_documents_update_own on public.cv_documents
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists cv_documents_delete_own on public.cv_documents;
create policy cv_documents_delete_own on public.cv_documents
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.jobs from public, anon, authenticated;
revoke all on table public.job_sources from public, anon, authenticated;
revoke all on table public.bookmarks from public, anon, authenticated;
revoke all on table public.cv_documents from public, anon, authenticated;

grant select on table public.jobs to authenticated;
grant select on table public.job_sources to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, delete on table public.bookmarks to authenticated;
grant select, insert, update, delete on table public.cv_documents to authenticated;
grant all on table public.profiles, public.jobs, public.job_sources, public.bookmarks, public.cv_documents to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

drop trigger if exists cv_documents_set_updated_at on public.cv_documents;
create trigger cv_documents_set_updated_at
  before update on public.cv_documents
  for each row execute function public.set_updated_at();

create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  deleted_profiles integer := 0;
  deleted_bookmarks integer := 0;
  deleted_cv_documents integer := 0;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  delete from public.cv_documents where user_id = uid;
  get diagnostics deleted_cv_documents = row_count;
  delete from public.bookmarks where user_id = uid;
  get diagnostics deleted_bookmarks = row_count;
  delete from public.profiles where user_id = uid;
  get diagnostics deleted_profiles = row_count;
  return jsonb_build_object(
    'profiles', deleted_profiles,
    'bookmarks', deleted_bookmarks,
    'cv_documents', deleted_cv_documents
  );
end;
$$;

revoke all on function public.delete_my_data() from public, anon;
grant execute on function public.delete_my_data() to authenticated;

create or replace function public.ingest_job(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  src jsonb;
  j jsonb;
  v_job_id uuid;
  v_inserted boolean := false;
  v_existing_job_id uuid;
  v_requested_job_id uuid;
  v_source_name text;
  v_source_job_id text;
  v_source_url text;
  v_published_text text;
  v_published_at timestamptz;
  v_fetched_text text;
  v_fetched_at timestamptz;
  v_title text;
  v_company text;
  v_location text;
  v_work_mode text;
  v_employment_type text;
  v_level text;
  v_education text;
  v_description text;
  v_status text;
  v_deadline_text text;
  v_deadline date;
  v_skills text[];
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = '22023';
  end if;

  src := payload -> 'source';
  j := payload -> 'job';
  if src is null or jsonb_typeof(src) <> 'object' then
    raise exception 'source must be a JSON object' using errcode = '22023';
  end if;
  if j is null or jsonb_typeof(j) <> 'object' then
    raise exception 'job must be a JSON object' using errcode = '22023';
  end if;

  v_source_name := nullif(trim(src ->> 'name'), '');
  v_source_job_id := nullif(trim(src ->> 'job_id'), '');
  v_source_url := nullif(trim(src ->> 'url'), '');
  if v_source_name is null or char_length(v_source_name) > 80 then
    raise exception 'source.name is required and must be at most 80 characters' using errcode = '22023';
  end if;
  if v_source_job_id is null or char_length(v_source_job_id) > 200 then
    raise exception 'source.job_id is required and must be at most 200 characters' using errcode = '22023';
  end if;
  if v_source_url is null or v_source_url !~ '^https?://' or char_length(v_source_url) > 2048 then
    raise exception 'source.url must be an http(s) URL' using errcode = '22023';
  end if;

  v_published_text := nullif(trim(src ->> 'published_at'), '');
  if v_published_text is not null then
    if v_published_text !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$' then
      raise exception 'source.published_at must be an ISO timestamp' using errcode = '22023';
    end if;
    v_published_at := v_published_text::timestamptz;
  end if;

  v_fetched_text := nullif(trim(src ->> 'fetched_at'), '');
  if v_fetched_text is null then
    v_fetched_at := now();
  else
    if v_fetched_text !~ '^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$' then
      raise exception 'source.fetched_at must be an ISO timestamp' using errcode = '22023';
    end if;
    v_fetched_at := v_fetched_text::timestamptz;
  end if;

  v_title := nullif(trim(j ->> 'title'), '');
  v_company := nullif(trim(j ->> 'company'), '');
  if v_title is null or char_length(v_title) > 300 then
    raise exception 'job.title is required and must be at most 300 characters' using errcode = '22023';
  end if;
  if v_company is null or char_length(v_company) > 200 then
    raise exception 'job.company is required and must be at most 200 characters' using errcode = '22023';
  end if;

  v_location := nullif(trim(j ->> 'location'), '');
  if v_location is not null and char_length(v_location) > 120 then
    raise exception 'job.location must be at most 120 characters' using errcode = '22023';
  end if;

  v_education := nullif(trim(j ->> 'education'), '');
  if v_education is not null and char_length(v_education) > 200 then
    raise exception 'job.education must be at most 200 characters' using errcode = '22023';
  end if;

  v_description := nullif(trim(j ->> 'description'), '');
  if v_description is not null and char_length(v_description) > 20000 then
    raise exception 'job.description must be at most 20000 characters' using errcode = '22023';
  end if;

  v_work_mode := coalesce(nullif(trim(j ->> 'work_mode'), ''), 'unknown');
  if v_work_mode not in ('onsite', 'hybrid', 'remote', 'unknown') then
    raise exception 'job.work_mode is invalid' using errcode = '22023';
  end if;

  v_employment_type := coalesce(nullif(trim(j ->> 'employment_type'), ''), 'unknown');
  if v_employment_type not in ('full_time', 'part_time', 'contract', 'internship', 'freelance', 'temporary', 'unknown') then
    raise exception 'job.employment_type is invalid' using errcode = '22023';
  end if;

  v_level := coalesce(nullif(trim(j ->> 'level'), ''), 'unknown');
  if v_level not in ('intern', 'entry', 'junior', 'mid', 'senior', 'lead', 'unknown') then
    raise exception 'job.level is invalid' using errcode = '22023';
  end if;

  v_status := coalesce(nullif(trim(j ->> 'status'), ''), 'unknown');
  if v_status not in ('open', 'closed', 'unknown') then
    raise exception 'job.status is invalid' using errcode = '22023';
  end if;

  v_deadline_text := nullif(trim(j ->> 'deadline'), '');
  if v_deadline_text is not null then
    if v_deadline_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'job.deadline must be YYYY-MM-DD' using errcode = '22023';
    end if;
    v_deadline := v_deadline_text::date;
  end if;

  if j ? 'skills' then
    if jsonb_typeof(j -> 'skills') <> 'array' then
      raise exception 'job.skills must be an array' using errcode = '22023';
    end if;
    if jsonb_array_length(j -> 'skills') > 100 then
      raise exception 'job.skills must contain at most 100 items' using errcode = '22023';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(j -> 'skills') as item
      where jsonb_typeof(item) <> 'string' or char_length(item #>> '{}') > 80
    ) then
      raise exception 'job.skills items must be strings of at most 80 characters' using errcode = '22023';
    end if;
    v_skills := array(select item #>> '{}' from jsonb_array_elements(j -> 'skills') as item);
  end if;

  if j ? 'id' then
    if jsonb_typeof(j -> 'id') <> 'string' or (j ->> 'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'job.id must be a UUID' using errcode = '22023';
    end if;
    v_requested_job_id := (j ->> 'id')::uuid;
  end if;

  select job_id into v_existing_job_id
  from public.job_sources
  where source_name = v_source_name and source_job_id = v_source_job_id;

  if v_existing_job_id is not null then
    v_job_id := v_existing_job_id;
  elsif v_requested_job_id is not null then
    if not exists (select 1 from public.jobs where id = v_requested_job_id) then
      raise exception 'job.id does not exist' using errcode = '23503';
    end if;
    v_job_id := v_requested_job_id;
  else
    insert into public.jobs (
      title, company, location, work_mode, employment_type, level, education,
      skills, description, deadline, status, last_seen_at, last_fetched_at
    ) values (
      v_title, v_company, v_location, v_work_mode, v_employment_type, v_level, v_education,
      coalesce(v_skills, '{}'), v_description, v_deadline, v_status, v_fetched_at, v_fetched_at
    ) returning id into v_job_id;
    v_inserted := true;
  end if;

  if not v_inserted then
    update public.jobs set
      title = coalesce(v_title, title),
      company = coalesce(v_company, company),
      location = coalesce(v_location, location),
      work_mode = case when v_work_mode <> 'unknown' then v_work_mode else work_mode end,
      employment_type = case when v_employment_type <> 'unknown' then v_employment_type else employment_type end,
      level = case when v_level <> 'unknown' then v_level else level end,
      education = coalesce(v_education, education),
      skills = coalesce(v_skills, skills),
      description = coalesce(v_description, description),
      deadline = coalesce(v_deadline, deadline),
      status = case when v_status in ('open', 'closed') then v_status else status end,
      last_seen_at = greatest(last_seen_at, v_fetched_at),
      last_fetched_at = greatest(coalesce(last_fetched_at, v_fetched_at), v_fetched_at),
      updated_at = now()
    where id = v_job_id;
  end if;

  insert into public.job_sources (job_id, source_name, source_job_id, source_url, published_at, fetched_at)
  values (v_job_id, v_source_name, v_source_job_id, v_source_url, v_published_at, v_fetched_at)
  on conflict on constraint job_sources_identity do update set
    source_url = excluded.source_url,
    published_at = coalesce(excluded.published_at, public.job_sources.published_at),
    fetched_at = greatest(public.job_sources.fetched_at, excluded.fetched_at);

  return v_job_id;
end;
$$;

revoke all on function public.ingest_job(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_job(jsonb) to service_role;
