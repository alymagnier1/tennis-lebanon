# Copy-paste stickies for FigJam

Create a sticky, pick the colour from the section header, paste **Title** then **Body**.

---

## ENTRY (gray)

### Tab bar +

**Body:** Centre tab. Clears draft; loads profile defaults.

### Discover → Create match

**Body:** From player card. Prefills zones, time, format, intent.

### Organise a match

**Body:** Discover or Matches empty state CTA.

### Challenge to match

**Body:** Player profile footer. Same as Discover card flow.

---

## FLOW (blue)

### 00 Loading

**Route:** `/match/create`  
**Body:** Spinner while profile + areas load. Auto-navigates.

### 00 Load error

**Route:** `/match/create`  
**Body:** Could not load settings. Retry.

### 01 First-run Where I play (once)

**Route:** `/profile/where-i-play?firstRun=1`  
**Body:** Areas + favourite clubs, from the onboarding completion CTA. Done or Skip → tabs. Feeds the club prefill on every later create.

### 02b Overrides

**Route:** `/match/create/details`  
**Body:** Change format, intent, level for this match only. Done → back. Auto-save on change.

---

## FLOW (green) — main

### 02 When and where — DEFAULT

**Route:** `/match/create/schedule`  
**Body:** Hero screen. Summary cards + when + where + Discover + notes. Footer: Publish | Invite players.

### Summary cards row

**Body:** Three cards side by side: Format · Intent · Level. Tap card row → overrides.

### When panel

**Body:** Day, time, duration. “More options” → fixed/flexible, up to 3 slots.

### Where (collapsed)

**Body:** Shows area + club summaries from profile. Links to expand or Profile.

### Where (expanded)

**Body:** Club checklist (max 3). Area chips. Required clubs if Discover on.

### Who can join

**Body:** List on Discover toggle. Approve join requests when listed.

---

## FLOW (orange)

### Invite target banner

**Body:** “Setting up match for {name}”. Top of schedule in challenge flow.

---

## FLOW (red) — on schedule

### Active match block

**Body:** Host already has open match. Continue inviting or go to hub — cannot publish new.

---

## POST (violet)

### Match hub

**Route:** `/match/[id]`  
**Body:** After **Publish match**. Vote time, book court, chat.

### Invite players

**Route:** `/match/[id]/invite`  
**Body:** After **Invite players** (draft created, not published).

---

## PROFILE (yellow) — sidebar, not in wizard

### Where I play

**Route:** `/profile/where-i-play`  
**Body:** Areas + favourite clubs. Feeds create “where” prefill.

### Match defaults

**Route:** `/profile/match-defaults`  
**Body:** Intent, format, level, Discover defaults. Auto-save.

---

## EDGE CASES (red)

### Alert: zone required

**Body:** Need ≥1 area before publish.

### Alert: club required

**Body:** Public listing needs ≥1 club.

### Error: time in past

**Body:** Inline error on schedule footer.

### Alert: active hosted match

**Body:** One open hosted match per format at a time.

---

## Flow order (for connectors)

```
ENTRY → Loading → When and where
When and where ↔ Overrides
When and where → Match hub (Publish)
When and where → Invite players
When and where → Profile links (Where I play)
When and where → EDGE alerts (validation)
```
