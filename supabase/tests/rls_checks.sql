begin;

select plan(23);

select has_table('public', 'jobs', 'tabel jobs tersedia');
select ok((select relrowsecurity from pg_class where oid = 'public.jobs'::regclass), 'RLS jobs aktif');
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS profiles aktif');
select ok((select relrowsecurity from pg_class where oid = 'public.bookmarks'::regclass), 'RLS bookmarks aktif');
select ok((select relrowsecurity from pg_class where oid = 'public.cv_documents'::regclass), 'RLS cv_documents aktif');

select ok(not has_table_privilege('anon', 'public.jobs', 'select'), 'anon tidak dapat membaca jobs');
select ok(not has_table_privilege('anon', 'public.jobs', 'insert'), 'anon tidak dapat menulis jobs');
select ok(has_table_privilege('authenticated', 'public.jobs', 'select'), 'authenticated dapat membaca jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'insert'), 'authenticated tidak dapat insert jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'update'), 'authenticated tidak dapat update jobs');
select ok(not has_table_privilege('authenticated', 'public.jobs', 'delete'), 'authenticated tidak dapat delete jobs');

select ok(not has_table_privilege('anon', 'public.profiles', 'select'), 'anon tidak dapat membaca profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'select'), 'authenticated dapat membaca profiles');
select ok(has_table_privilege('authenticated', 'public.profiles', 'insert'), 'authenticated dapat insert profiles');
select ok(not has_table_privilege('anon', 'public.cv_documents', 'select'), 'anon tidak dapat membaca CV');
select ok(has_table_privilege('authenticated', 'public.cv_documents', 'select'), 'authenticated dapat membaca CV');

select ok(not has_function_privilege('anon', 'public.ingest_job(jsonb)', 'execute'), 'anon tidak dapat ingest');
select ok(not has_function_privilege('authenticated', 'public.ingest_job(jsonb)', 'execute'), 'authenticated tidak dapat ingest');
select ok(has_function_privilege('service_role', 'public.ingest_job(jsonb)', 'execute'), 'service_role dapat ingest');
select ok(has_function_privilege('authenticated', 'public.delete_my_data()', 'execute'), 'authenticated dapat menghapus data sendiri');
select ok(not has_function_privilege('anon', 'public.delete_my_data()', 'execute'), 'anon tidak dapat menghapus data');

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'bookmarks', 'cv_documents')
      and cmd in ('INSERT', 'UPDATE', 'ALL')
      and with_check is null
  ),
  'kebijakan tulis personal memiliki WITH CHECK'
);

select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'jobs'),
  1::bigint,
  'jobs hanya memiliki kebijakan baca'
);

select * from finish();
rollback;
