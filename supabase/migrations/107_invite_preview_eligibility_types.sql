-- The preview of an invite link has to be able to say two things it cannot say
-- today. Part 1 of 2: the types. `108` changes the functions.
--
-- `skill_out_of_range`. `preview_match_invite` (105) answered `ok` without
-- looking at the recipient's band, so a beginner opening a link to an
-- intermediate-and-up match was offered Accept, and every tap on it failed on
-- `assert_joinable_match` with `skill_out_of_range` behind a generic error. That
-- is not a race with somebody filling the seat; it is certain from the moment
-- the link opens, so the preview must say so instead of offering the button.
--
-- `is_addressed`. The screen sent every Decline to `decline_match_invitation`,
-- which only matches invitations addressed to the caller. A shared link has no
-- recipient, so Decline on one raised `P0002` -- 105's comment calling it a
-- harmless no-op was wrong. The screen needs to know which kind it is holding:
-- an addressed invitation is refused on the server, a shared link is simply
-- left, because refusing it would withdraw it for everyone else it was sent to.
--
-- On its own because `alter type ... add value` does not make the label usable
-- until the transaction commits, and `108` writes it (same split as 063/064).
-- Appending the attribute keeps every existing field in position.

alter type public.match_invite_preview_status add value if not exists 'skill_out_of_range';

alter type public.match_invite_preview add attribute is_addressed boolean;
