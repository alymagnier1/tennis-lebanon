# RacketBound onboarding — design handoff

For Claude Code / Cursor working in `tennis-lebanon-claude-code/apps/mobile`.
The live, tappable source of truth is `RacketBound Onboarding.dc.html` in the design project
(option ids are the badges on each frame).

## Approved designs

| Screen                            | Design id                                                | Spec file                   | Repo target                                                                   |
| --------------------------------- | -------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| Welcome                           | **5a** (green) and **2a** (mint) — both ship, switchable | `01-welcome.md`             | `app/(public)/welcome.tsx`, `src/components/onboarding-ui/AuthHeroLayout.tsx` |
| Welcome (third option, not wired) | 5c (clay)                                                | `01-welcome.md` §Alternate  | same                                                                          |
| Sign up                           | 1a                                                       | `02-sign-up.md`             | `app/(public)/sign-up.tsx`                                                    |
| Log in                            | 1a                                                       | `03-log-in.md`              | `app/(public)/sign-in.tsx`                                                    |
| Consent                           | 1a                                                       | `04-consent.md`             | `app/(onboarding)/consent.tsx`                                                |
| Birth year / identity             | 1a                                                       | `05-identity-birth-year.md` | `app/(onboarding)/identity.tsx`, `OnboardingYearField.tsx`                    |
| Zones                             | 1a                                                       | `06-zones.md`               | `app/(onboarding)/zones.tsx`                                                  |
| Done                              | **2f** (green) and **2e** (clay) — both ship, switchable | `07-done.md`                | `app/(onboarding)/complete.tsx`                                               |

**The undecided pair.** Welcome and Done each have two approved treatments and the
choice is deliberately deferred. Implement both behind one switch — see
`08-hero-variant-switch.md`, which contains drop-in source for the provider,
the dev toggle, and the auto-cycle mode. Welcome and Done must always resolve to the
same family so the flow opens and closes on one ground:

| Family  | Welcome | Done |
| ------- | ------- | ---- |
| `green` | 5a      | 2f   |
| `light` | 2a      | 2e   |

Never pair a light Welcome with a green Done.

## Read order

1. `00-tokens.md` — the only file that adds tokens and primitives. Apply first.
2. `08-hero-variant-switch.md` — the switch. Apply second; Welcome and Done both consume it.
3. `01-` … `07-` — one file per screen.

## Folder contents

- `renders/` — 402×874 reference renders: `welcome-5a`, `welcome-2a`, `welcome-5c`, `done-2e`, `done-2f`.
- `assets/` — the art the specs reference. Copy into `apps/mobile/assets/onboarding/`.

## Ground rules

- Copy is **verbatim** from `packages/i18n/src/locales/en.json`. Where a spec shows a string
  with no key, add the key (and an `ar.json` entry); never hardcode in a screen.
- No raw hex in a screen file. Colours land in `tennis-tokens.ts` first (`00-tokens.md §1`).
- Fonts come from `tennisFontFamily`. Outfit 400/600/700/800 and Inter 400/500/600 are already
  loaded in `useTennisFonts.ts`; no new weights are needed.
- `px` in these specs are RN density-independent units measured on a 402×874 frame.
  Horizontal screen padding is always `tennisSpacing.screenX` (28).
- Primary buttons 54 tall, secondary 50, every tappable row ≥44.
- This is a visual pass. No change to validation, submit payloads, routing or consent records.
