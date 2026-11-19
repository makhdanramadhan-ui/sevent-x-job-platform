create table if not exists public.auth_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint auth_rate_limits_bucket_length check (char_length(bucket) between 1 and 80),
  constraint auth_rate_limits_key_hash_length check (char_length(key_hash) = 64),
  constraint auth_rate_limits_count_nonnegative check (count >= 0),
  primary key (bucket, key_hash, window_start)
);

create index if not exists auth_rate_limits_window_start_idx
  on public.auth_rate_limits (window_start);

alter table public.auth_rate_limits enable row level security;

revoke all on table public.auth_rate_limits from public, anon, authenticated;
grant all on table public.auth_rate_limits to service_role;

create or replace function public.consume_rate_limit(
  bucket text,
  key text,
  max integer,
  window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_window_seconds integer;
  v_window_start timestamptz;
  v_key_hash text;
  v_count integer;
  v_retry_after integer;
begin
  if bucket is null or char_length(trim(bucket)) < 1 or char_length(bucket) > 80 then
    raise exception 'bucket is invalid' using errcode = '22023';
  end if;
  if key is null or char_length(key) < 1 or char_length(key) > 1024 then
    raise exception 'key is invalid' using errcode = '22023';
  end if;
  if max is null or max < 1 or max > 100000 then
    raise exception 'max is invalid' using errcode = '22023';
  end if;
  if window_seconds is null or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'window_seconds is invalid' using errcode = '22023';
  end if;

  v_window_seconds := window_seconds;
  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / v_window_seconds) * v_window_seconds
  );
  v_key_hash := encode(extensions.digest(convert_to(key, 'UTF8'), 'sha256'), 'hex');

  delete from public.auth_rate_limits
  where window_start < v_now - interval '1 day';

  insert into public.auth_rate_limits as rl (bucket, key_hash, window_start, count, updated_at)
  values (bucket, v_key_hash, v_window_start, 1, v_now)
  on conflict (bucket, key_hash, window_start) do update
    set count = rl.count + 1,
        updated_at = v_now
  returning rl.count into v_count;

  if v_count <= max then
    return query select true, 0;
    return;
  end if;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch from (v_window_start + make_interval(secs => v_window_seconds) - v_now)))::integer
  );
  return query select false, v_retry_after;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
