\set ON_ERROR_STOP on

begin;

create extension if not exists pgtap;
select plan(7);

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

-- Revised by `102`. This used to request a deletion and then withdraw it, but
-- `request_account_deletion` no longer leaves anything pending: it completes,
-- releases the address and tombstones the profile. `cancel_account_deletion`
-- now serves exactly one population -- accounts flagged `deletion_requested` by
-- the pre-102 behaviour and stranded there -- so the pending state is set
-- directly here, which is the only way it now arises.
-- ---------------------------------------------------------------------------
-- A legacy pending request can still be withdrawn
-- ---------------------------------------------------------------------------

do $$
declare
  v_user uuid := '14141414-1414-1414-1414-141414141414';
begin
  update public.profiles
  set account_status = 'deletion_requested', deletion_requested_at = now()
  where id = v_user;

  perform pg_temp.set_caller(v_user);

  -- The state the fix exists for: nothing marketplace-facing works here,
  -- because `assert_discovery_caller_eligible` requires `active`.
  perform pg_temp.assert_true(
    pg_temp.status(v_user) = 'deletion_requested',
    'precondition: the account is stranded pending'
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
  perform pg_temp.assert_true(
    (select count(*) from public.audit_events as a
     where a.actor_id = v_user and a.action = 'account_deletion_cancelled') >= 1,
    'the withdrawal should be audited'
  );

  -- A completed deletion is terminal: there is no pending request behind it.
  perform public.request_account_deletion();
  begin
    perform public.cancel_account_deletion();
    raise exception 'expected no_pending_deletion';
  exception when others then
    perform pg_temp.assert_true(
      sqlerrm like '%no_pending_deletion%',
      'a completed deletion must not be withdrawable, got: ' || sqlerrm
    );
  end;
end;
$$;

select pass('a stranded pending request is restored');
select pass('the requested-at timestamp is cleared');
select pass('the withdrawal is audited');
select pass('a completed deletion cannot be withdrawn');

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
