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

set local role authenticated;

do $$
declare
  v_match_id uuid;
  v_hub public.match_hub_card;
  v_existing_id uuid;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = 'singles'::public.match_format
      and lm.status in ('draft', 'open', 'full', 'ready_to_book')
  loop
    perform public.cancel_match(v_existing_id);
  end loop;

  select public.create_match_draft(
    'singles'::public.match_format,
    'public'::public.match_visibility,
    'social'::public.play_intent,
    'improving'::public.skill_band,
    'intermediate'::public.skill_band,
    false,
    null,
    array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
    jsonb_build_array(
      jsonb_build_object(
        'starts_at', (now() + interval '3 days')::text,
        'ends_at', (now() + interval '3 days 90 minutes')::text
      )
    )
  )
  into v_match_id;

  v_hub := public.get_match_hub(v_match_id);

  if v_hub.status <> 'draft' then
    raise exception 'expected draft status, got %', v_hub.status;
  end if;

  perform public.create_match_invite(
    v_match_id,
    '22222222-2222-2222-2222-222222222222'
  );

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  if exists (
    select 1
    from public.list_my_match_invites() as li
    where li.match_id = v_match_id
  ) then
    raise exception 'draft invite should not appear in inbox before publish';
  end if;

  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');
  perform public.publish_match(v_match_id);

  v_hub := public.get_match_hub(v_match_id);

  if v_hub.status <> 'open' then
    raise exception 'expected open status after publish, got %', v_hub.status;
  end if;

  perform pg_temp.set_caller('22222222-2222-2222-2222-222222222222');

  if not exists (
    select 1
    from public.list_my_match_invites() as li
    where li.match_id = v_match_id
  ) then
    raise exception 'published invite should appear in inbox';
  end if;
end;
$$;

select pass('draft create, invite, and publish flow works');
select * from finish();

rollback;
