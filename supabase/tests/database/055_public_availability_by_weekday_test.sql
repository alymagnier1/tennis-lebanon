\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(1);

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_description text
)
returns void
language plpgsql
as $$
begin
  if not p_condition then
    raise exception '%', p_description;
  end if;
end;
$$;

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
  v_viewer uuid := '11111111-1111-1111-1111-111111111111';
  v_target uuid := '13131313-1313-1313-1313-131313131313';
  v_summary jsonb;
begin
  perform pg_temp.set_caller(v_target);
  perform public.set_recurring_availability(
    jsonb_build_array(
      jsonb_build_object('weekday', 2, 'local_start', '18:00', 'local_end', '21:00'),
      jsonb_build_object('weekday', 4, 'local_start', '09:00', 'local_end', '11:00')
    )
  );

  perform pg_temp.set_caller(v_viewer);
  v_summary := public.get_public_player_availability_summary(v_target);

  perform pg_temp.assert_true(
    v_summary -> 'by_weekday' @> jsonb_build_array(
      jsonb_build_object('weekday', 2, 'day_parts', jsonb_build_array('evening')),
      jsonb_build_object('weekday', 4, 'day_parts', jsonb_build_array('morning'))
    ),
    format('by_weekday should list each day with its blocks, got %s', v_summary -> 'by_weekday')
  );
end;
$$;

select ok(true, 'by_weekday lists day-part blocks per weekday');

select * from finish();

rollback;
