-- Milestone 9, part 1 of 2: the terminal state for a result nobody ever answered.
--
-- A submitted result currently has three ways out -- confirmed, disputed, or an
-- operator resolution -- and one way to go nowhere, which is what actually
-- happens most of the time. Nothing sweeps `submitted`, so a score the opponent
-- never looked at stays "awaiting confirmation" forever and the match it belongs
-- to never leaves in_progress.
--
-- `unverified` is that fourth exit: the score stands in history, attributed to
-- whoever entered it, and no rating moves. It is distinct from `resolved`, which
-- means an operator looked at a dispute and voided it -- conflating the two
-- would lose the difference between "nobody answered" and "somebody judged".
--
-- This is on its own because `alter type ... add value` does not make the label
-- usable until the transaction commits. 064 executes code that writes it, so the
-- two cannot share a migration.

alter type public.result_status add value if not exists 'unverified';
