---
description: Mobile UI/UX constraints for Tennis Lebanon — actions, colour, states, i18n
globs: apps/mobile/**/*
alwaysApply: false
---

# Mobile UI/UX

Read `docs/FLOWS_AND_SCREENS.md` and `.cursor/plans/ui_ux_milestones_*.plan.md` before reskinning or adding screens.

## Primary action

- One obvious next step per screen. Use server `next_action` on match hub; use `deriveHomeNextActions` on Home.
- One primary CTA per view. Demote everything else to secondary, link, or overflow menu.
- Global create: tab-bar `+` → create flow. Do not add a second full-width Create on Home unless empty-state only.

## Colour = information

- Use semantic tones from `apps/mobile/src/theme/tennis-tokens.ts` (`tennisSemantic`). Never new hardcoded hex for status.
- Every status badge pairs **colour + glyph** (colour-blind safe). Skill bands use a separate ordinal ramp, not semantic tones.
- Two badge slots on match cards when two facts are true (e.g. court secured + expiring). No tie-break that drops one.
- Loss/outcome is **neutral**, not error red. No attendance/reliability badges on **public** player profiles (`CLAUDE.md`).

## Visual system

- Tokens: `tennisColors`, `tennisRadii`, `tennisSpacing`, `FigmaPrimaryButton` / onboarding-ui on reskinned screens.
- Do not introduce a third button or chip system. Reuse `AppUi`, `FormUi`, `onboarding-ui`.
- Minimum 44px touch targets; labelled controls; support RTL via `useLayoutDirection`.

## Async states (required)

Every list or hub section: skeleton or inline loading, useful empty state with liquidity CTA, recoverable error + retry.

- Never gate static chrome (Home hero, headers) on a full-screen spinner.
- Never show empty copy when a query failed. Use toast/snackbar for mutation success; avoid `Alert.alert` for routine feedback.

## Copy and locale

- No hardcoded user-facing strings. Add en/ar/fr keys; `matches.*` is CI-guarded.
- Human status labels ("Needs 1 player"), not enum names (`open`, `ready_to_book`).
- No fake pilot stats or invented liquidity numbers.

## Out of scope

Payments, leaderboards, challenges, social feed, public W/L, NTRP, phone OTP, in-app payments — unless PRD scope explicitly changes.
