\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

create or replace function pg_temp.create_test_match(
  p_creator_id uuid,
  p_format public.match_format default 'singles',
  p_visibility public.match_visibility default 'public',
  p_requires_creator_approval boolean default false
)
returns uuid
language plpgsql
as $$
declare
  v_match_id uuid;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller(p_creator_id);

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = p_format
      and lm.status in ('open', 'full', 'ready_to_book')
  loop
    perform public.cancel_match(v_existing_id, 'test cleanup');
  end loop;

  select public.create_and_publish_match(
    p_format,
    p_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    p_requires_creator_approval,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  )
  into v_match_id;

  return v_match_id;
end;
$$;

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_invite_b uuid;
  v_invite_d uuid;
  v_hub public.match_hub_card;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.create_match_invite(v_match_id, '22222222-2222-2222-2222-222222222222');
  perform public.create_match_invite(v_match_id, '77777777-7777-7777-7777-777777777777');

  reset role;
  select mi.id
  into v_invite_b
  from public.match_invitations as mi
  where mi.match_id = v_match_id
    and mi.invited_user_id = '22222222-2222-2222-2222-222222222222'
    and mi.revoked_at is null;

  select mi.id
  into v_invite_d
  from public.match_invitations as mi
  where mi.match_id = v_match_id
    and mi.invited_user_id = '77777777-7777-7777-7777-777777777777'
    and mi.revoked_at is null;
  set local role authenticated;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  if not exists (
    select 1
    from public.list_my_match_invites() as row
    where row.invitation_id = v_invite_b
  ) then
    raise exception 'invited player should see inbox row';
  end if;

  perform public.accept_match_invitation(v_invite_b);

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  v_hub := public.get_match_hub(v_match_id);

  if v_hub.participant_count <> 2 then
    raise exception 'expected singles match to fill after accept';
  end if;

  perform pg_temp.set_caller('77777777-7777-7777-7777-777777777777');

  if exists (
    select 1
    from public.list_my_match_invites() as row
    where row.invitation_id = v_invite_d
  ) then
    raise exception 'other pending singles invites should leave inbox when match fills';
  end if;

  begin
    perform public.accept_match_invitation(v_invite_d);
    raise exception 'expected full match invite accept to fail';
  exception
    when others then
      if sqlerrm not like '%Invite not found or expired%'
         and sqlerrm not like '%match_full%' then
        raise;
      end if;
  end;
end;
$$;

do $$
declare
  v_match_id uuid;
  v_invite_id uuid;
begin
  v_match_id := pg_temp.create_test_match(
    '11111111-1111-1111-1111-111111111111',
    'singles',
    'public',
    false
  );

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.create_match_invite(v_match_id, '22222222-2222-2222-2222-222222222222');

  reset role;
  select mi.id
  into v_invite_id
  from public.match_invitations as mi
  where mi.match_id = v_match_id
    and mi.invited_user_id = '22222222-2222-2222-2222-222222222222'
    and mi.revoked_at is null;
  set local role authenticated;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');
  perform public.decline_match_invitation(v_invite_id);

  if exists (
    select 1
    from public.list_my_match_invites() as row
    where row.invitation_id = v_invite_id
  ) then
    raise exception 'declined invite should leave inbox';
  end if;
end;
$$;

select pass('Milestone 3.5 match invite inbox flows passed');
select * from finish();

rollback;
