# First Claude Code Prompt

Copy the text below into Claude Code from the repository root.

---

Read `CLAUDE.md` and every file it lists as source material. Do not implement product features yet.

Your task is Milestone 0 only: propose the repository bootstrap for the Tennis Lebanon MVP.

First:

1. Summarize the product boundary and the non-negotiable security rules.
2. Inspect the current repository.
3. Propose the exact monorepo tree, commands, dependencies, and compatible current stable framework versions.
4. Identify any conflict between the documents and the proposed tooling.
5. List the files you will create or modify.
6. State what will be verifiably working at the end of Milestone 0.

Wait for my approval before writing files or installing dependencies.

After approval, create the smallest clean bootstrap satisfying Milestone 0 in `docs/ROADMAP.md`. Do not implement authentication, profiles, matchmaking, chat, booking, payments, or sample production features. A basic health screen for each app and an RTL localization test screen are sufficient.

Requirements:

- pnpm workspaces and Turborepo
- strict TypeScript
- Expo mobile app with Expo Router
- Next.js App Router dashboard
- local Supabase configuration and migration commands
- shared environment validation and `.env.example`
- formatting, linting, type checking, unit-test setup, and CI
- English/Arabic/French i18n scaffolding with an Arabic RTL visual check
- Sentry setup that fails safely when no DSN exists
- no secrets committed

Run all checks after implementation. Finish with changed files, commands run and results, assumptions, risks, and the exact recommended prompt for Milestone 1.

---
