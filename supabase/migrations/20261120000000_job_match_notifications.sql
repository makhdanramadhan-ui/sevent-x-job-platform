create table if not exists public.job_match_notifications (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  sent_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists job_match_notifications_sent_at_idx
  on public.job_match_notifications (sent_at desc);

alter table public.job_match_notifications enable row level security;

revoke all on table public.job_match_notifications from public, anon, authenticated;
grant all on table public.job_match_notifications to service_role;

-- rollback: drop table if exists public.job_match_notifications;
