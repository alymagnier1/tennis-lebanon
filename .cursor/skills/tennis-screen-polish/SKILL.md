---
name: tennis-screen-polish
description: Reskins or polishes a Tennis Lebanon mobile screen to match Figma tokens, next-action hierarchy, semantic status colour, and async states. Use when the user asks to improve UI/UX, align with Figma, reskin a screen, polish empty/loading/error states, or work on Home, Discover, Matches, Match Hub, Clubs, or Profile.
---

# Tennis Lebanon — Screen polish

## Before editing

1. Read the screen in `docs/FLOWS_AND_SCREENS.md`.
2. Skim Figma reference: `Figma designs/Tennis Lebanon Mobile App UI/src/screens/`.
3. Apply rule: `.cursor/rules/mobile-ui-ux.mdc`.
4. Inspect existing screen + shared components (`AppUi`, `FormUi`, `onboarding-ui`, `tennis-tokens`).

## Workflow

Copy and track:

```
Screen polish:
- [ ] 1. Map viewer states and next_action (if match-related)
- [ ] 2. Choose layout; one primary CTA identified
- [ ] 3. Map statuses → semantic tone + glyph
- [ ] 4. Loading / empty / error / retry
- [ ] 5. i18n keys (en/ar/fr if new copy)
- [ ] 6. a11y labels and contrast check
- [ ] 7. Tests for new pure logic
- [ ] 8. lint + typecheck + test
```

### 1. States and actions

- Match hub: primary button must match `hub.next_action`. Secondary actions in outline or menu.
- Home: upgrade next-action cards to explicit verb buttons; liquidity row only when no actions.
- Discover: card tap → detail; demote in-card Invite to secondary unless it is the only action.
- Create flow: prefill zones/clubs from profile when draft empty; Publish is primary on review.

### 2. Semantic tones

| Tone         | Use                                  |
| ------------ | ------------------------------------ |
| `actionable` | Viewer's turn (vote, book, accept)   |
| `attention`  | Time-boxed (expiring, stale warning) |
| `info`       | Waiting on others                    |
| `positive`   | Secured, confirmed                   |
| `critical`   | Not recoverable (cancelled, expired) |
| `neutral`    | Completed, outcomes, draft           |

Implement mapping in a pure function + unit test; do not inline colour logic in JSX.

### 3. Async states

| State   | Pattern                                                          |
| ------- | ---------------------------------------------------------------- |
| Loading | Skeleton rows for lists; spinner only inline                     |
| Empty   | `EmptyState` + liquidity CTA (create, relax filters, widen zone) |
| Error   | Message + retry; never masquerade as empty                       |
| Success | Toast/snackbar, not blocking alert                               |

### 4. Do not

- Add fake scroll-anchor "tabs" without real section separation or scroll sync.
- Nest card-in-card (`MatchCard` inside `formStyles.card`).
- Use `discover.loading` as a11y label outside Discover.
- Ship dev-only entries (e.g. RTL check) in production Settings.

## Verification

**Manual:** happy path + one error path + empty state on device or simulator.

**Automated:**

```bash
pnpm --filter mobile lint
pnpm --filter mobile typecheck
pnpm test -- --testPathPattern="mobile|domain"
```

**Record** material UI decisions in `docs/DECISIONS.md` (brand colour, tone boundaries, public vs private status).

## Reference

- Milestones plan: `.cursor/plans/ui_ux_milestones_*.plan.md`
- Audit findings: `Audit/TENNIS_LEBANON_AUDIT_2026-07-28.md` (contrast, fake tabs, prefill gaps)
