create table if not exists public.account_setting_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  current_email text not null,
  target_email text,
  current_code_digest text not null,
  new_code_digest text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  constraint account_setting_challenges_action check (action in ('email', 'password', 'delete')),
  constraint account_setting_challenges_current_email_length check (char_length(current_email) between 3 and 320),
  constraint account_setting_challenges_target_email_length check (
    target_email is null or char_length(target_email) between 3 and 320
  ),
  constraint account_setting_challenges_digest_length check (
    char_length(current_code_digest) = 64
    and (new_code_digest is null or char_length(new_code_digest) = 64)
  ),
  constraint account_setting_challenges_shape check (
    (action = 'email' and target_email is not null and new_code_digest is not null)
    or (action in ('password', 'delete') and target_email is null and new_code_digest is null)
  ),
  constraint account_setting_challenges_failed_attempts check (failed_attempts >= 0 and failed_attempts <= 100),
  constraint account_setting_challenges_expiry check (expires_at > created_at)
);

create index if not exists account_setting_challenges_user_created_idx
  on public.account_setting_challenges (user_id, created_at desc);
create index if not exists account_setting_challenges_expires_idx
  on public.account_setting_challenges (expires_at);

alter table public.account_setting_challenges enable row level security;

revoke all on table public.account_setting_challenges from public, anon, authenticated;
grant all on table public.account_setting_challenges to service_role;

create or replace function public.consume_account_setting_challenge(
  p_challenge_id uuid,
  p_user_id uuid,
  p_action text,
  p_current_email text,
  p_target_email text,
  p_current_code_digest text,
  p_new_code_digest text,
  p_max_attempts integer
)
returns table (status text, failed_attempts integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_row public.account_setting_challenges%rowtype;
  v_now timestamptz := now();
  v_current_ok boolean;
  v_new_ok boolean;
begin
  if p_challenge_id is null or p_user_id is null then
    return query select 'invalid'::text, 0;
    return;
  end if;
  if p_action not in ('email', 'password', 'delete') then
    return query select 'invalid'::text, 0;
    return;
  end if;
  if p_current_email is null or char_length(p_current_email) < 3 or char_length(p_current_email) > 320 then
    return query select 'invalid'::text, 0;
    return;
  end if;
  if p_current_code_digest is null or char_length(p_current_code_digest) <> 64 then
    return query select 'invalid'::text, 0;
    return;
  end if;
  if p_max_attempts is null or p_max_attempts < 1 or p_max_attempts > 20 then
    return query select 'invalid'::text, 0;
    return;
  end if;
  if p_action = 'email' then
    if p_target_email is null or char_length(p_target_email) < 3 or char_length(p_target_email) > 320 then
      return query select 'invalid'::text, 0;
      return;
    end if;
    if p_new_code_digest is null or char_length(p_new_code_digest) <> 64 then
      return query select 'invalid'::text, 0;
      return;
    end if;
  end if;

  select * into v_row
  from public.account_setting_challenges
  where id = p_challenge_id
  for update;

  if not found then
    return query select 'not_found'::text, 0;
    return;
  end if;

  if v_row.user_id <> p_user_id then
    return query select 'not_found'::text, 0;
    return;
  end if;

  if v_row.consumed_at is not null then
    return query select 'consumed'::text, v_row.failed_attempts;
    return;
  end if;

  if v_row.expires_at <= v_now then
    return query select 'expired'::text, v_row.failed_attempts;
    return;
  end if;

  if v_row.failed_attempts >= p_max_attempts then
    return query select 'too_many_attempts'::text, v_row.failed_attempts;
    return;
  end if;

  if v_row.action <> p_action then
    return query select 'invalid'::text, v_row.failed_attempts;
    return;
  end if;

  if lower(v_row.current_email) <> lower(p_current_email) then
    return query select 'invalid'::text, v_row.failed_attempts;
    return;
  end if;

  if v_row.action = 'email' then
    if v_row.target_email is null or lower(v_row.target_email) <> lower(p_target_email) then
      return query select 'invalid'::text, v_row.failed_attempts;
      return;
    end if;
  end if;

  v_current_ok := v_row.current_code_digest = p_current_code_digest;
  v_new_ok := (v_row.action <> 'email') or (v_row.new_code_digest = p_new_code_digest);

  if not v_current_ok or not v_new_ok then
    update public.account_setting_challenges
    set failed_attempts = v_row.failed_attempts + 1
    where id = p_challenge_id and consumed_at is null;
    if v_row.failed_attempts + 1 >= p_max_attempts then
      return query select 'too_many_attempts'::text, v_row.failed_attempts + 1;
      return;
    end if;
    return query select 'mismatch'::text, v_row.failed_attempts + 1;
    return;
  end if;

  update public.account_setting_challenges
  set consumed_at = v_now
  where id = p_challenge_id
    and consumed_at is null
    and expires_at > v_now
    and failed_attempts < p_max_attempts;

  if not found then
    return query select 'consumed'::text, v_row.failed_attempts;
    return;
  end if;

  return query select 'ok'::text, v_row.failed_attempts;
end;
$$;

revoke all on function public.consume_account_setting_challenge(uuid, uuid, text, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.consume_account_setting_challenge(uuid, uuid, text, text, text, text, text, integer) to service_role;
