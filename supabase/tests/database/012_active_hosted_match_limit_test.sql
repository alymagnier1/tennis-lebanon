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

create or replace function pg_temp.assert_raises(
  p_sql text,
  p_sqlstate text,
  p_description text
)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    raise exception '%', p_description || ' (expected failure)';
  exception
    when others then
      if sqlstate <> p_sqlstate then
        raise exception '%: got sqlstate %', p_description, sqlstate;
      end if;
  end;
end;
$$;

set local role authenticated;

do $$
declare
  v_existing_id uuid;
begin
  perform pg_temp.set_caller('11111111-1111-1111-1111-111111111111');

  for v_existing_id in
    select lm.match_id
    from public.list_my_matches() as lm
    where lm.is_creator
      and lm.format = 'singles'::public.match_format
      and lm.status in ('open', 'full', 'ready_to_book')
  loop
    perform public.cancel_match(v_existing_id, 'test cleanup');
  end loop;

  perform public.create_and_publish_match(
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
    ),
    p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
  );

  perform pg_temp.assert_raises(
    $sql$select public.create_and_publish_match(
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
          'starts_at', (now() + interval '4 days')::text,
          'ends_at', (now() + interval '4 days 90 minutes')::text
        )
      ),
      p_preferred_club_ids => array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]
    )$sql$,
    'P0001',
    'second singles hosted match is blocked'
  );
end;
$$;

select pass('active hosted match limit enforced');
select * from finish();

rollback;
