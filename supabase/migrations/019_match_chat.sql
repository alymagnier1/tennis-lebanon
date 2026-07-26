-- Milestone 6.1: participant-only match chat RPCs and RLS.

create or replace function public.is_match_chat_participant(
  p_match_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_participants as mp
    where mp.match_id = p_match_id
      and mp.user_id = p_user_id
      and mp.status = 'accepted'
  );
$$;

create or replace function public.list_match_messages(
  p_match_id uuid,
  p_limit integer default 50
)
returns table (
  message_id uuid,
  match_id uuid,
  author_id uuid,
  author_display_name text,
  body text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_limit integer;
begin
  v_user_id := public.assert_marketplace_caller();

  if not public.is_match_chat_participant(p_match_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Match chat access required';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);

  return query
  select
    mm.id,
    mm.match_id,
    mm.author_id,
    p.display_name,
    mm.body,
    mm.created_at
  from public.match_messages as mm
  join public.profiles as p on p.id = mm.author_id
  where mm.match_id = p_match_id
    and mm.deleted_at is null
  order by mm.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.send_match_message(
  p_match_id uuid,
  p_body text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_message_id uuid;
  v_body text;
  v_recent_count integer;
begin
  v_user_id := public.assert_marketplace_caller();

  if not public.is_match_chat_participant(p_match_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Match chat access required';
  end if;

  v_body := nullif(trim(coalesce(p_body, '')), '');
  if v_body is null or char_length(v_body) > 2000 then
    raise exception using errcode = 'P0001', message = 'Message must be between 1 and 2000 characters';
  end if;

  select count(*)::integer
  into v_recent_count
  from public.match_messages as mm
  where mm.match_id = p_match_id
    and mm.author_id = v_user_id
    and mm.created_at > now() - interval '1 hour';

  if v_recent_count >= 60 then
    raise exception using errcode = 'P0001', message = 'Chat rate limit reached for this match';
  end if;

  insert into public.match_messages (match_id, author_id, body)
  values (p_match_id, v_user_id, v_body)
  returning id into v_message_id;

  return v_message_id;
end;
$$;

grant select on table public.match_messages to authenticated;

create policy match_messages_select_participant on public.match_messages
  for select
  to authenticated
  using (
    public.is_match_chat_participant(match_id)
    and deleted_at is null
  );

alter publication supabase_realtime add table public.match_messages;

revoke all on function public.is_match_chat_participant(uuid, uuid) from public, anon;
grant execute on function public.is_match_chat_participant(uuid, uuid) to authenticated;

revoke all on function public.list_match_messages(uuid, integer) from public, anon;
grant execute on function public.list_match_messages(uuid, integer) to authenticated;

revoke all on function public.send_match_message(uuid, text) from public, anon;
grant execute on function public.send_match_message(uuid, text) to authenticated;
