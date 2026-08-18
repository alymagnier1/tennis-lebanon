#!/usr/bin/env node
/**
 * Local sandbox for walking the attendance → score → rating flow by hand.
 *
 * Three things make this flow awkward to exercise through the UI alone: a match
 * only reaches `in_progress` after its agreed hour has passed, the auto-confirm
 * and grace-window rules are measured in days, and the rating itself is only
 * visible in the database. This drives those three from the outside so the
 * parts you actually want to click — attendance, score entry, confirm, correct —
 * can be clicked.
 *
 * Local only, by assertion: it refuses to run against anything but 127.0.0.1.
 *
 *   node scripts/rating-sandbox.mjs setup [playerA] [playerB]
 *   node scripts/rating-sandbox.mjs state [matchId]
 *   node scripts/rating-sandbox.mjs deliver <matchId>
 *   node scripts/rating-sandbox.mjs fastforward <matchId>
 *   node scripts/rating-sandbox.mjs magic-link <email>
 *   node scripts/rating-sandbox.mjs reset
 */
import { execFileSync } from "node:child_process";

const DB_URL =
  process.env.SANDBOX_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const MAIL_URL = process.env.SANDBOX_MAIL_URL ?? "http://127.0.0.1:54324";
const APP_URL = process.env.SANDBOX_APP_URL ?? "http://localhost:8081";
const DOCKER_DB = process.env.SANDBOX_DB_CONTAINER ?? null;

if (!/127\.0\.0\.1|localhost/.test(DB_URL)) {
  process.stderr.write(`✖ Refusing to run against a non-local database.\n`);
  process.exit(1);
}

/** Prefers psql on PATH; falls back to the Supabase container. */
function sql(query, { rows = false } = {}) {
  const args = rows ? ["-tAF", ""] : ["-tA"];
  try {
    return execFileSync(
      "psql",
      [DB_URL, ...args, "-v", "ON_ERROR_STOP=1", "-c", query],
      {
        encoding: "utf8",
      },
    ).trim();
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const container = DOCKER_DB ?? discoverContainer();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      ...args,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}

/** psql echoes a command tag per statement ("DO", "UPDATE 3"); we want the value. */
function lastLine(out) {
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

let cachedContainer = null;
function discoverContainer() {
  if (cachedContainer) return cachedContainer;
  const names = execFileSync("docker", ["ps", "--format", "{{.Names}}"], {
    encoding: "utf8",
  }).split("\n");
  const found = names.find((n) => n.startsWith("supabase_db_"));
  if (!found) {
    process.stderr.write(
      "✖ No running supabase_db_* container. Run: pnpm db:start\n",
    );
    process.exit(1);
  }
  cachedContainer = found.trim();
  return cachedContainer;
}

function playerId(email) {
  const id = sql(`select u.id from auth.users u where u.email = '${email}'`);
  if (!id) {
    process.stderr.write(`✖ No seeded user ${email}. Run: pnpm db:reset\n`);
    process.exit(1);
  }
  return id;
}

// ---------------------------------------------------------------------------

function setup(emailA, emailB) {
  const a = playerId(emailA);
  const b = playerId(emailB);

  // create_and_publish_match refuses a past time and one host may hold only one
  // active match, so: clear, create in the future, then backdate the slot and
  // answer the "did you play?" prompt to land on in_progress with no booking —
  // the shape most casual pilot matches will actually have.
  const matchId = lastLine(
    sql(`
    do $$
    declare v_a uuid := '${a}'; v_b uuid := '${b}'; v_m uuid; v_old uuid;
    begin
      perform set_config('request.jwt.claim.sub', v_a::text, false);
      perform set_config('request.jwt.claim.role', 'authenticated', false);
      for v_old in select lm.match_id from public.list_my_matches() lm
        where lm.is_creator and lm.status in
          ('draft','open','full','ready_to_book','booking_pending','confirmed','in_progress')
      loop
        begin perform public.cancel_match(v_old, 'sandbox reset'); exception when others then null; end;
      end loop;

      v_m := public.create_and_publish_match(
        'singles','public','social','beginner','competitive',false,null,
        array['aaaaaaaa-0001-0001-0001-000000000002']::uuid[],
        jsonb_build_array(jsonb_build_object(
          'starts_at',(now()+interval '3 days')::text,
          'ends_at',(now()+interval '3 days 90 minutes')::text)),
        'fixed',
        array['bbbbbbbb-0001-0001-0001-000000000001']::uuid[]);

      perform set_config('request.jwt.claim.sub', v_b::text, false);
      perform public.join_match(v_m);

      update public.match_time_options
      set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours'
      where match_id = v_m;

      perform set_config('request.jwt.claim.sub', v_a::text, false);
      perform public.report_match_played(v_m, true);

      create temp table if not exists sandbox_out(id uuid);
      delete from sandbox_out; insert into sandbox_out values (v_m);
    end $$;
    select id from sandbox_out;
  `),
  );

  process.stdout.write(
    `\nMatch ready (in_progress, no booking)\n` +
      `  id   ${matchId}\n` +
      `  url  ${APP_URL}/match/${matchId}\n\n` +
      `  ${emailA}  (host, side A)\n` +
      `  ${emailB}  (opponent, side B)\n\n` +
      `Sign each in from a separate browser profile, then:\n` +
      `  both tap "I played"        → match completes with no score\n` +
      `  either adds a score        → e.g. 6-4, 4-6, 6-3\n` +
      `  the other confirms         → rating moves\n\n` +
      `  node scripts/rating-sandbox.mjs state ${matchId}\n\n`,
  );
}

function state(matchId) {
  const where = matchId
    ? `m.id = '${matchId}'`
    : `m.status in ('in_progress','completed') `;
  const out = sql(
    `
    select
      m.id, m.status,
      coalesce((select string_agg(p.display_name || '=' || mp.attendance, ', ' order by p.display_name)
        from public.match_participants mp join public.profiles p on p.id = mp.user_id
        where mp.match_id = m.id and mp.status='accepted'), '-'),
      coalesce(mr.status::text,'(no score)'),
      coalesce(mr.score::text,'-'),
      coalesce(mr.revision::text,'-'),
      coalesce((select p.display_name from public.profiles p where p.id = mr.winner_user_id),'-'),
      coalesce((select count(*)::text from public.rating_events re where re.result_id = mr.id),'0')
    from public.matches m
    left join public.match_results mr on mr.match_id = m.id
    where ${where}
    order by m.updated_at desc limit 5
  `,
    { rows: true },
  );

  process.stdout.write("\nMatches\n");
  for (const line of out.split("\n").filter(Boolean)) {
    const [id, status, att, res, score, rev, winner, ratings] = line.split("");
    process.stdout.write(
      `  ${id}\n    match=${status}  attendance=${att}\n` +
        `    result=${res} rev=${rev} winner=${winner} score=${score} rating_events=${ratings}\n`,
    );
  }

  const ratings = sql(
    `select p.display_name || '  ' || pp.internal_rating || '  (' || pp.rated_match_count || ' rated)'
     from public.player_profiles pp join public.profiles p on p.id = pp.user_id
     where pp.rated_match_count > 0 or pp.internal_rating <> 1200 order by p.display_name`,
  );
  process.stdout.write(
    `\nRatings that have moved\n${
      ratings
        ? ratings
            .split("\n")
            .map((r) => "  " + r)
            .join("\n")
        : "  (none yet)"
    }\n\n`,
  );
}

function deliver(matchId) {
  const count = lastLine(
    sql(
      `select count(*) from public.notifications
       where entity_id = '${matchId}' and kind = 'result_confirm_request' and sent_at is null`,
    ),
  );
  sql(
    `update public.notifications set sent_at = now()
     where entity_id = '${matchId}' and kind = 'result_confirm_request' and sent_at is null`,
  );
  process.stdout.write(
    `\nMarked ${count} confirm-request notification(s) as delivered.\n` +
      `Silence now counts as agreement for this result — without this it goes to 'unverified'.\n\n`,
  );
}

function fastforward(matchId) {
  // updated_at is written by a BEFORE UPDATE trigger, so ageing the row needs
  // the trigger out of the way.
  sql(`
    alter table public.match_results disable trigger results_updated_at;
    update public.match_results set updated_at = now() - interval '80 hours'
      where match_id = '${matchId}';
    alter table public.match_results enable trigger results_updated_at;
    update public.match_time_options set starts_at = now() - interval '100 hours',
      ends_at = now() - interval '98 hours' where match_id = '${matchId}';
  `);
  const jobs = sql(`select public.run_notification_jobs()::text`);
  process.stdout.write(
    `\nAged past the 72h windows, then ran the sweeps:\n  ${jobs}\n\n`,
  );
  state(matchId);
}

async function magicLink(email) {
  const res = await fetch(`${MAIL_URL}/api/v1/messages`);
  const { messages = [] } = await res.json();
  const box = email.split("@")[0];
  const hit = messages.find(
    (m) =>
      JSON.stringify(m.To ?? []).includes(box) ||
      JSON.stringify(m).includes(email),
  );
  if (!hit) {
    process.stderr.write(
      `✖ No mail for ${email} yet. Request a sign-in link in the app first.\n` +
        `  Mailpit UI: ${MAIL_URL}\n`,
    );
    process.exit(1);
  }
  const full = await (
    await fetch(`${MAIL_URL}/api/v1/message/${hit.ID}`)
  ).json();
  const body = `${full.Text ?? ""}${full.HTML ?? ""}`.replace(/&amp;/g, "&");
  const link = (body.match(/https?:\/\/[^\s"<>]+verify[^\s"<>]*/) ?? [])[0];
  process.stdout.write(
    link ? `\n${link}\n\n` : "\n✖ No verify link found in the latest mail.\n\n",
  );
}

function reset() {
  sql(`
    delete from public.rating_events;
    delete from public.match_results;
    update public.player_profiles set internal_rating = 1200, rated_match_count = 0;
    delete from public.notifications where kind in ('result_confirm_request','result_auto_confirmed');
  `);
  process.stdout.write(
    "\nCleared results, rating events and confirm notifications; ratings back to 1200.\n" +
      "Matches themselves are left alone — run setup for a fresh one.\n\n",
  );
}

// ---------------------------------------------------------------------------

const [cmd, ...rest] = process.argv.slice(2);
switch (cmd) {
  case "setup":
    setup(
      rest[0] ?? "player-a@tennis-lebanon.test",
      rest[1] ?? "player-b@tennis-lebanon.test",
    );
    break;
  case "state":
    state(rest[0]);
    break;
  case "deliver":
    deliver(rest[0]);
    break;
  case "fastforward":
    fastforward(rest[0]);
    break;
  case "magic-link":
    await magicLink(rest[0]);
    break;
  case "reset":
    reset();
    break;
  default:
    process.stdout.write(
      "Usage:\n" +
        "  setup [emailA] [emailB]   in_progress match between two seeded players\n" +
        "  state [matchId]           match, attendance, result and rating state\n" +
        "  deliver <matchId>         mark the confirm push delivered (enables auto-confirm)\n" +
        "  fastforward <matchId>     age past the 72h windows and run the sweeps\n" +
        "  magic-link <email>        print the newest sign-in link from Mailpit\n" +
        "  reset                     ratings back to 1200, results cleared\n",
    );
}
