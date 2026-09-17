\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(8);

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

create or replace function pg_temp.status(p_user uuid)
returns text
language sql
stable
as $$
  select p.account_status::text from public.profiles as p where p.id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- The round trip: request, then withdraw
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '14141414-1414-1414-1414-141414141414';
begin
  perform pg_temp.set_caller(v_user);
  perform public.request_account_deletion();

  perform pg_temp.assert_true(
    pg_temp.status(v_user) = 'deletion_requested',
    'requesting deletion should flag the profile'
  );

  -- The state the fix exists for: nothing marketplace-facing works here,
  -- because `assert_discovery_caller_eligible` requires `active`.
  perform pg_temp.assert_true(
    (select not exists (
      select 1 from public.profiles as p
      where p.id = v_user and p.account_status = 'active'
    )),
    'a pending deletion must not still read as active'
  );

  perform public.cancel_account_deletion();

  perform pg_temp.assert_true(
    pg_temp.status(v_user) = 'active',
    'withdrawing the request should restore the account'
  );
  perform pg_temp.assert_true(
    (select p.deletion_requested_at is null from public.profiles as p
     where p.id = v_user),
    'the timestamp should be cleared, not left behind'
  );

  -- Both halves stay on the record. That a request was made and withdrawn is
  -- exactly what the audit trail is for.
  perform pg_temp.assert_true(
    (select count(*) from public.audit_events as a
     where a.actor_id = v_user
       and a.action in ('account_deletion_requested', 'account_deletion_cancelled')
    ) >= 2,
    'both the request and the withdrawal should be audited'
  );
end;
$$;

select pass('requesting deletion flags the profile');
select pass('a pending deletion is not active');
select pass('withdrawing restores the account');
select pass('the requested-at timestamp is cleared');
select pass('both events are audited');

-- ---------------------------------------------------------------------------
-- Only a pending request is the account holder's to undo
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '13131313-1313-1313-1313-131313131313';
  v_message text;
begin
  perform pg_temp.set_caller(v_user);

  -- Nothing pending: there is nothing to withdraw.
  begin
    perform public.cancel_account_deletion();
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%no_pending_deletion%',
    'an active account has nothing to withdraw, got: ' || v_message
  );

  -- A suspension is a moderation decision, not the player's to reverse.
  update public.profiles set account_status = 'suspended' where id = v_user;
  begin
    perform public.cancel_account_deletion();
    v_message := 'no error';
  exception when others then
    v_message := sqlerrm;
  end;
  perform pg_temp.assert_true(
    v_message like '%no_pending_deletion%',
    'a suspended account must not restore itself, got: ' || v_message
  );
  perform pg_temp.assert_true(
    pg_temp.status(v_user) = 'suspended',
    'the suspension must survive the attempt'
  );
end;
$$;

select pass('an active account cannot withdraw a request it never made');
select pass('a suspended account cannot restore itself');
select pass('the suspension survives the attempt');

select * from finish();

rollback;
