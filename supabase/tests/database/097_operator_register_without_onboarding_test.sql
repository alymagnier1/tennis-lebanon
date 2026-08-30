\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(3);

create or replace function pg_temp.set_caller(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end;
$$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '09700000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'ops-incomplete@tennis-lebanon.test',
  crypt('test-only-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  '',
  '',
  ''
);

update public.profiles
set
  onboarding_completed_at = null,
  is_adult_confirmed = false
where id = '09700000-0000-0000-0000-000000000001';

insert into public.platform_roles (user_id, role)
values ('09700000-0000-0000-0000-000000000001', 'admin');

do $$
declare
  v_ops uuid := '09700000-0000-0000-0000-000000000001';
  v_player uuid := '11111111-1111-1111-1111-111111111111';
  v_zone_id uuid;
  v_club uuid;
  v_refused text;
begin
  select z.id into v_zone_id from public.zones as z where z.is_active limit 1;

  perform pg_temp.set_caller(v_ops);
  v_club := public.register_pilot_club(
    'Incomplete Ops Club',
    'incomplete-ops-club',
    v_zone_id,
    null,
    'Manara',
    null,
    null,
    array['parking']::text[],
    jsonb_build_array(jsonb_build_object('name', 'Court 1', 'surface', 'hard')),
    'external_link',
    '+961 70 111 222',
    true
  );

  if v_club is null then
    raise exception 'operator without onboarding should be able to register a club';
  end if;

  perform pg_temp.set_caller(v_ops);
  begin
    perform public.register_pilot_club(
      'Ops Own Club',
      'ops-own-club',
      v_zone_id,
      null, null, null, null,
      '{}'::text[],
      jsonb_build_array(jsonb_build_object('name', 'Court 1')),
      'external_link',
      '+961 70 111 223',
      false
    );
    v_refused := 'no error';
  exception
    when others then
      v_refused := sqlerrm;
  end;

  if v_refused <> 'Caller is not marketplace-eligible' then
    raise exception 'self-service still requires onboarding, got %', v_refused;
  end if;

  perform pg_temp.set_caller(v_player);
  begin
    perform public.register_pilot_club(
      'Player Posing',
      'player-posing',
      v_zone_id,
      null, null, null, null,
      '{}'::text[],
      jsonb_build_array(jsonb_build_object('name', 'Court 1')),
      'external_link',
      '+961 70 111 224',
      true
    );
    v_refused := 'no error';
  exception
    when others then
      v_refused := sqlerrm;
  end;

  if v_refused <> 'Platform operator access required' then
    raise exception 'only an operator may use p_as_operator, got %', v_refused;
  end if;
end;
$$;

select pass('an un-onboarded operator can enter a WhatsApp club');
select pass('self-service still requires marketplace eligibility');
select pass('p_as_operator still requires the platform role');

select * from finish();

rollback;
