# FigJam — Create match flow (stickies board)

Build a one-page flow map in FigJam for design uplift. Pair with [`FIGMA_CREATE_MATCH_FLOW.md`](../FIGMA_CREATE_MATCH_FLOW.md) for full specs.

---

## Quick setup (≈15 min)

1. In Figma, **File → New → FigJam file** (or add a page to your Tennis Lebanon FigJam).
2. Name the board **Create match — stickies flow**.
3. Add **section frames** (FigJam Sections) in a row:

   | Section name | Sticky colour |
   |--------------|---------------|
   | ENTRY | Gray |
   | FLOW | Blue / Green |
   | POST | Violet |
   | PROFILE | Yellow (place to the right as sidebar) |
   | EDGE CASES | Red (below FLOW) |

4. Import or paste stickies from [`create-match-flow-stickies.csv`](create-match-flow-stickies.csv) (see below).
5. Draw **connectors** using the map at the end of this file.
6. Pin a **legend** sticky: gray = entry · green = main screen · violet = after publish · yellow = profile settings · red = errors/blocks.

---

## Import the CSV

FigJam has no built-in CSV import. Use one of these:

### Option A — Copy-paste (no plugin)

Open [`create-match-flow-stickies.md`](create-match-flow-stickies.md). Each block is one sticky: copy title + body into a new FigJam sticky, set colour from the header.

### Option B — Plugin

1. In FigJam: **Plugins → search “CSV” or “bulk sticky”**.
2. Import `create-match-flow-stickies.csv` with columns: `section`, `color`, `title`, `body`, `route`.
3. If the plugin only accepts `text`, concatenate: `title + newline + body`.

### Option C — Paste CSV into spreadsheet → copy column

Open the CSV in Excel/Sheets, copy the `title` and `body` columns, paste into stickies in batches per `section`.

---

## Board layout (visual)

```
┌─────────────┐     ┌──────────────────────────────────────────┐     ┌──────────────┐
│   ENTRY     │     │              FLOW                        │     │  PROFILE     │
│  (gray)     │     │  Loading → First intro* → When & where   │     │  (yellow)    │
│             │     │       ↓              ↓                   │     │              │
│  + Tab      │────▶│   Overrides ◀── Edit for this match      │     │ Where I play │
│  Discover   │     │       ↓                                  │     │ Match defs   │
│  Challenge  │     │  Publish ──▶ Hub    Invite ──▶ Invite UI  │     │              │
└─────────────┘     └──────────────────────────────────────────┘     └──────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  EDGE CASES (red) │
                    │  alerts + blocks  │
                    └───────────────────┘

* First intro only once per host
```

---

## Connector map (draw these arrows)

| From | To | Label |
|------|-----|--------|
| Any ENTRY sticky | `00 Loading` | |
| `00 Loading` | `01 First intro` | first-time host only |
| `00 Loading` | `02 When and where` | returning host |
| `00 Loading` | `02 When and where` | invite flow skips intro |
| `01 First intro` | `02 When and where` | Continue |
| `02 When and where` | `02b Overrides` | Edit for this match |
| `02b Overrides` | `02 When and where` | Done |
| `02 When and where` | `Profile: Where I play` | Set in Profile link |
| `02 When and where` | `Match hub` | Publish match |
| `02 When and where` | `Invite players` | Invite players CTA |
| `02 When and where` | EDGE stickies | validation fails |

---

## Happy-path stickies only (minimal board)

If you want a **thin** board, use only these 6 stickies:

1. **ENTRY** — Tab + / Discover / Challenge  
2. **Loading** — brief  
3. **First intro** — once (optional branch)  
4. **When and where** — hero  
5. **Overrides** — optional branch  
6. **Match hub** — success  

---

## Files in this folder

| File | Purpose |
|------|---------|
| `create-match-flow-stickies.csv` | Bulk data for plugins / spreadsheets |
| `create-match-flow-stickies.md` | Copy-paste friendly sticky text |
| `README.md` | This guide |

---

## After the board is built

- Link the FigJam URL in your Figma project description or `docs/DECISIONS.md`.
- When screens change in code, update the CSV and refresh stickies.
- Use **green** `02 When and where` as the anchor for high-fidelity frames on the Figma design page.
