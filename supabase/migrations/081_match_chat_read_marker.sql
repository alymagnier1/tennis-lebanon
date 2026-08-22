-- Unread chat had nowhere to be recorded.
--
-- `match_messages` carries `created_at` and `author_id` but nothing tracked who
-- had seen what, so the hub's chat row could show the latest message and still
-- not say whether it was new. A player opening a match had to read the preview
-- and remember whether they had seen that line before.
--
-- Stored as a read marker per participant rather than a per-message read table:
-- match chat is a small group thread read front to back, so "everything before
-- this moment" is the whole of what a reader means. A join table would carry a
-- row per message per participant to express the same fact.
--
-- Counting stays in the client. `MatchChatEntry` already lists the messages to
-- render its preview, so with a marker in hand the count is a filter over data
-- it has, not a second round trip -- and the rule (later than the marker, and
-- not written by you) is pure enough to unit test on its own.

alter table public.match_participants
  add column if not exists chat_last_read_at timestamptz;

comment on column public.match_participants.chat_last_read_at is
  'When this participant last opened the match chat. Null means never opened; everything is unread.';

create or replace function public.mark_match_chat_read(p_match_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_now timestamptz := now();
begin
  v_user_id := public.assert_marketplace_caller();

  update public.match_participants
  set chat_last_read_at = v_now
  where match_id = p_match_id
    and user_id = v_user_id
    and status = 'accepted';

  if not found then
    raise exception using errcode = '42501', message = 'not_a_match_participant';
  end if;

  return v_now;
end;
$$;

revoke all on function public.mark_match_chat_read(uuid) from public, anon;
grant execute on function public.mark_match_chat_read(uuid) to authenticated;

create or replace function public.get_own_chat_last_read(p_match_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select mp.chat_last_read_at
  from public.match_participants as mp
  where mp.match_id = p_match_id
    and mp.user_id = public.assert_marketplace_caller()
    and mp.status = 'accepted';
$$;

revoke all on function public.get_own_chat_last_read(uuid) from public, anon;
grant execute on function public.get_own_chat_last_read(uuid) to authenticated;
