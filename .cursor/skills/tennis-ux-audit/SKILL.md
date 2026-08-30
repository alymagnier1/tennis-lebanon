---
name: tennis-ux-audit
description: Runs a read-only UX consistency audit on Tennis Lebanon mobile changes or a named screen — alerts, missing retries, hardcoded colours, wrong a11y labels, duplicate CTAs. Use before opening a UI PR, when the user asks for a UX review, or to check polish milestone completeness.
disable-model-invocation: true
---

# Tennis Lebanon — UX audit (read-only)

Do not modify files unless the user asks to fix findings. Report defects first, grouped by severity.

## Scan checklist

### P0 — breaks trust or core flow

- [ ] Primary action missing or competing with 2+ primary-styled buttons
- [ ] `next_action` not reflected in visible CTA (match hub, Home)
- [ ] Query failure shown as empty state
- [ ] Hardcoded pilot/marketing numbers
- [ ] Public reliability/shame styling on profiles

### P1 — consistency and a11y

- [ ] `Alert.alert` used for routine mutation success/failure
- [ ] `discover.loading` misused as loading label (grep `discover.loading`)
- [ ] Hardcoded hex outside `tennis-tokens` / `tennisSemantic`
- [ ] Status colour without paired glyph
- [ ] `StatusBanner` or `danger` text below WCAG AA on known backgrounds
- [ ] Screen with async data but no retry on error
- [ ] Full-screen spinner hiding static chrome

### P2 — polish debt

- [ ] Raw `fontSize` instead of typography tokens
- [ ] Second button system (`PrimaryButton` vs `FigmaPrimaryButton`) on same flow
- [ ] Card nested in card
- [ ] Fake section tabs (scroll anchors without scroll sync)
- [ ] Dead routes or dev-only menu in production

## Commands

```bash
# Wrong loading labels
rg "discover\.loading" apps/mobile

# Alert overuse
rg "Alert\.alert" apps/mobile --count

# Hardcoded colours in mobile
rg "#[0-9a-fA-F]{3,8}" apps/mobile/src --glob "*.tsx"

# Raw font sizes
rg "fontSize:\s*\d+" apps/mobile --count
```

## Output format

```markdown
## UX audit — [screen or "branch changes"]

### Critical

- [file:line] finding → suggested fix

### High

- ...

### Low / debt

- ...

### Passed

- What already meets mobile-ui-ux rule
```

Cross-check against `.cursor/rules/mobile-ui-ux.mdc` and milestones plan todos.
