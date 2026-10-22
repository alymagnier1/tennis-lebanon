-- Only newly completed, opted-in email signups are queued by the server.
-- Existing entries keep not_requested. No contact/body copies or backfill.
alter table public.prelaunch_signups
  add column welcome_status text not null default 'not_requested'
    check (welcome_status in ('not_requested','pending','sending','accepted','failed')),
  add column welcome_attempts integer not null default 0 check (welcome_attempts between 0 and 3),
  add column welcome_first_attempt_at timestamptz,
  add column welcome_next_attempt_at timestamptz not null default now(),
  add column welcome_lease uuid,
  add column welcome_lease_until timestamptz,
  add column welcome_accepted_at timestamptz,
  add column welcome_failure_code text;

create index prelaunch_welcome_due_idx on public.prelaunch_signups (welcome_next_attempt_at)
  where welcome_status in ('pending','sending');

create function public.claim_prelaunch_welcome(p_key text default null)
returns table (id uuid, first_name text, contact text, lease uuid)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- Never resend outside Resend's 24-hour deduplication window. Stop at 23h.
  update public.prelaunch_signups s set welcome_status = 'failed', welcome_failure_code = 'expired'
  where s.welcome_status in ('pending','sending')
    and (s.created_at < now() - interval '24 hours'
      or s.welcome_first_attempt_at < now() - interval '23 hours'
      or (s.welcome_attempts >= 3 and coalesce(s.welcome_lease_until, '-infinity') <= now())
      or s.status <> 'waiting');
  select s.id into v_id from public.prelaunch_signups s
  where s.channel = 'email' and s.consent_version = 'beirut-prelaunch-v3'
    and s.status = 'waiting' and s.welcome_attempts < 3
    and (p_key is null or s.idempotency_key = p_key)
    and ((s.welcome_status = 'pending' and s.welcome_next_attempt_at <= now())
      or (s.welcome_status = 'sending' and s.welcome_lease_until <= now()))
  order by s.created_at for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.prelaunch_signups s
    set welcome_status = 'sending', welcome_attempts = s.welcome_attempts + 1,
      welcome_first_attempt_at = coalesce(s.welcome_first_attempt_at, now()),
      welcome_lease = gen_random_uuid(), welcome_lease_until = now() + interval '5 minutes'
    where s.id = v_id returning s.id, s.first_name, s.contact, s.welcome_lease;
end;
$$;

create function public.finish_prelaunch_welcome(p_id uuid, p_lease uuid, p_result text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_result not in ('accepted','transient','rejected') or p_result is null then
    raise exception 'Invalid welcome result';
  end if;
  update public.prelaunch_signups s
  set welcome_status = case when p_result = 'accepted' then 'accepted'
      when p_result = 'rejected' or s.welcome_attempts >= 3 then 'failed' else 'pending' end,
    welcome_accepted_at = case when p_result = 'accepted' then now() else null end,
    welcome_failure_code = case when p_result = 'accepted' then null else p_result end,
    welcome_next_attempt_at = now() + interval '10 minutes',
    welcome_lease = null, welcome_lease_until = null
  where s.id = p_id and s.welcome_lease = p_lease and s.welcome_status = 'sending';
end;
$$;

revoke all on function public.claim_prelaunch_welcome(text) from public, anon, authenticated;
revoke all on function public.finish_prelaunch_welcome(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.claim_prelaunch_welcome(text) to service_role;
grant execute on function public.finish_prelaunch_welcome(uuid,uuid,text) to service_role;

-- Uses the existing pg_net/Vault setup. No requests until the dedicated
-- token is configured; this never reuses the Supabase service-role key.
create function public.invoke_prelaunch_welcome()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_token text; v_request bigint;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets
    where name = 'prelaunch_welcome_token';
  if v_token is null or length(v_token) < 32 then return null; end if;
  select net.http_post(
    url := 'https://racketbound.com/api/internal/prelaunch-welcome',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_token),
    body := '{}'::jsonb, timeout_milliseconds := 30000) into v_request;
  return v_request;
exception when invalid_schema_name or undefined_function or undefined_table then return null;
end;
$$;
revoke all on function public.invoke_prelaunch_welcome() from public, anon, authenticated, service_role;
do $$
begin
  if exists(select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('beirut_welcome_email', '*/5 * * * *', 'select public.invoke_prelaunch_welcome();');
  end if;
exception when undefined_table or undefined_function then
  raise notice 'Schedule the protected prelaunch-welcome endpoint externally.';
end;
$$;
