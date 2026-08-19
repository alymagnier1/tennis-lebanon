-- Pilot zone setup for STAGING and PRODUCTION. Not a migration, and not seed.
--
-- Migrations are schema and run everywhere, including `pnpm db:reset`. Zones are
-- environment data: local keeps the `pilot-north/central/south` fixtures that 31
-- test files and `seed.sql` reference by id, while staging and production get the
-- real corridor. Phase 1.5 of the launch checklist already forbids running
-- `seed.sql` against either, so this file is how Phase 1.6 gets done.
--
-- Run once against the hosted project:
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/pilot/beirut-zones.sql
--
-- Idempotent: `unique (country_code, city_code, slug)` makes a second run a no-op.
--
-- WHY ONE ZONE FOR BEIRUT
--
-- Zone granularity should follow where courts are, not where people live. Cohort
-- 1's bookable supply is four venues, and three of them -- Renaissance, Al Riyadi
-- and JDK -- sit together at Manara; the fourth is The Private Club in Dekwaneh.
-- Splitting the city would leave east-Beirut players holding a zone with nothing
-- they can book, and it would not shorten anyone's journey, because both players
-- drive to Manara either way. Splitting only shrinks the pool that the liquidity
-- signal reads from.
--
-- Keserwan is a separate network with its own supply and gets its own `city_code`
-- when it opens. Nothing here has to change for that.

insert into public.zones (
  country_code,
  city_code,
  slug,
  name_i18n,
  timezone,
  is_active,
  sort_order
)
values (
  'LB',
  'beirut',
  'beirut',
  '{"en":"Beirut","ar":"بيروت","fr":"Beyrouth"}'::jsonb,
  'Asia/Beirut',
  true,
  1
)
on conflict (country_code, city_code, slug) do nothing;

-- Expect exactly one active zone on a correctly prepared pilot database. More
-- than one means `seed.sql` was run here, which Phase 1.5 forbids -- stop and
-- check before inviting players, because the fictional zones and the
-- `@tennis-lebanon.test` accounts arrive together.
select
  z.city_code,
  z.slug,
  z.name_i18n ->> 'en' as name_en,
  z.is_active,
  count(*) over () as active_zone_count
from public.zones as z
where z.is_active
order by z.sort_order;
