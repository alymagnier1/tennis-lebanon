# Architecture and Product Decisions

Record decisions using this template:

## YYYY-MM-DD — Decision title

- Status: proposed | accepted | superseded
- Context:
- Decision:
- Alternatives considered:
- Consequences:
- Owner:

## 2026-07-22 — Matchmaking-first MVP

- Status: accepted
- Context: Lebanon already has broad sports booking products; the unserved core problem is coordinating a compatible opponent, time, and court reliably.
- Decision: Build the completed-match loop first, with lightweight manual club approval.
- Alternatives considered: booking-only marketplace; full club-management system; tennis social network.
- Consequences: payments, coaches, leagues, advanced tournaments, social feed, and other sports are excluded from MVP.
- Owner: Founder

## 2026-07-22 — Shared TypeScript product stack

- Status: proposed
- Context: A solo founder using Claude Code benefits from one language and one cross-platform mobile codebase.
- Decision: Expo/React Native mobile, Next.js dashboard, Supabase backend, TypeScript monorepo.
- Alternatives considered: Flutter; native iOS/Android; Firebase backend.
- Consequences: framework versions must be selected for current compatibility during bootstrap; PostgreSQL/RLS becomes the main authorization boundary.
- Owner: Founder/technical reviewer
