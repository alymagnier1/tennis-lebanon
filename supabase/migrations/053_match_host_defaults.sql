-- Match-host defaults on player_profiles: visibility, approval, level range,
-- default format, and first-configure timestamp for the mobile create flow.

alter table public.player_profiles
  add column default_match_visibility public.match_visibility not null default 'public',
  add column default_requires_creator_approval boolean not null default false,
  add column default_min_skill public.skill_band,
  add column default_max_skill public.skill_band,
  add column default_match_format public.match_format,
  add column match_defaults_set_at timestamptz;

comment on column public.player_profiles.default_match_visibility is
  'Default listing visibility when the host creates a match.';
comment on column public.player_profiles.default_requires_creator_approval is
  'Default join-approval flag for public listings.';
comment on column public.player_profiles.default_min_skill is
  'Optional explicit min skill for new listings; null derives from skill_band.';
comment on column public.player_profiles.default_max_skill is
  'Optional explicit max skill for new listings; null derives from skill_band.';
comment on column public.player_profiles.default_match_format is
  'Optional default format when both singles and doubles are preferred.';
comment on column public.player_profiles.match_defaults_set_at is
  'When the host completed first-create defaults (Discover/approval) or saved match defaults.';

-- Veterans who already hosted skip the first-create sheet.
update public.player_profiles as pp
set match_defaults_set_at = now()
where pp.match_defaults_set_at is null
  and exists (
    select 1
    from public.matches as m
    where m.creator_id = pp.user_id
  );
