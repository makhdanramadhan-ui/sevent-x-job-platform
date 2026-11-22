create table if not exists public.bookmark_deadline_notifications (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  reminder_day integer not null check (reminder_day in (1, 3)),
  sent_at timestamptz not null default now(),
  primary key (user_id, job_id, reminder_day)
);

create index if not exists bookmark_deadline_notifications_sent_at_idx
  on public.bookmark_deadline_notifications (sent_at desc);

alter table public.bookmark_deadline_notifications enable row level security;

revoke all on table public.bookmark_deadline_notifications from public, anon, authenticated;
grant all on table public.bookmark_deadline_notifications to service_role;

-- rollback: drop table if exists public.bookmark_deadline_notifications;
