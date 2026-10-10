# Kithe

A cozy dog-raising game for iPhone and Android where real-life movement is the only way to care for your pup. Money buys outfits, never care.

## Read first
- Scope (locked): @SCOPE.md
- Current milestone: `docs/specs/phase-0-concept-art-prototype.md` (read the section your task names; task IDs T1 to T17 live there)
- Decisions: `docs/decisions/` (one dated file per decision; check it before asking Tommy to re-decide anything)
- Full design doc: `docs/design-doc.md` (long; read the section you need, not the whole thing)
- Landing page and waitlist: `docs/landing-page.md`

## Stack (planned; verify against package.json once the skeleton lands)
- Expo SDK 56 (React Native 0.85), Expo Router, TypeScript. Development builds only; native modules do not run in Expo Go.
- Health: `@kingstinct/react-native-healthkit` (iOS), `react-native-health-connect` (Android), `expo-sensors` pedometer fallback (deferred).
- Pet animation: `@rive-app/react-native` from Phase 1. Phase 0 uses static concept art swapped by state.
- Backend: Supabase. Phase 0 app is local-first with no app backend; Supabase holds the waitlist. Server wallet, auth, and nightly AI jobs arrive in Phase 2.
- Purchases: RevenueCat (Phase 2). AI: Claude API, server-side only, nightly batches (Phase 2).
- Analytics and crashes: PostHog, Sentry. No health data in any event.

## Commands
Not yet defined. Task T1 (skeleton) creates `typecheck`, `lint`, `format`, `test`, `sim`, and per-platform run scripts. Update this section when it lands.

## Repo layout (planned)
- `apps/mobile` — Expo app: screens, navigation, platform adapters
- `packages/core` — pure TypeScript game rules; no React, no platform imports; fully unit-tested
- `packages/content` — schema-validated data: economy, items, events, diary templates, notification copy, banned phrases
- `backend/supabase` — migrations, RLS policies, edge functions (waitlist first)
- `web/` — landing page
- `scripts/` — `economy-sim.ts` and other tooling
- `docs/` — design doc, specs, decisions

## Conventions
- Game rules live in `packages/core` as pure functions with test vectors; the app and the economy sim both call them. Never duplicate a rule in UI code.
- Tunable numbers (prices, decay rates, caps, thresholds) live in `packages/content`, never as literals in code.
- One adapter interface per native capability (MovementSource, Notifier, Storage); platform-specific code lives only in adapters.
- Day boundaries use the player's home time zone, locked at adoption; a change applies from the next day; a backwards clock never re-credits a day.
- Numbers stay quiet in the UI: needs show as pet behavior and icons first; exact values only on tap.
- Copy: no screen needs more than 12 words to understand. Notifications are always good news.

## Invariants (never break; each gets a test)
1. Care can never be bought. No food, care item, healing, growth speed, Rest Mode, or movement credit ever has a Stars or dollar price, and nothing grants Pawprints except movement, the starter kit, and documented event rewards. `packages/core/__tests__/invariants.test.ts`
2. The pet never dies, starves, or gets sick from neglect. There is no death state in the types. Needs never drop below the safety floor (25).
3. Raw health data never leaves the device. The server, analytics, logs, and the AI receive goal progress and coarse buckets only; never step counts, exercise minutes, heart rate, or health samples.
4. No guilt mechanics: no streak resets, no countdown timers, no "hungry / sad / misses you" notifications, no purchase prompts when the pet is mopey or sick or before day 7. Notification and diary copy passes the banned-phrase test.
5. The app never shows calories, weight, or body measurements. AI and template copy never contain body, diet, or medical talk.
6. No ads. No randomized paid items.
7. Growth requires both calendar time and bond; nothing purchasable shortens it.
8. Game content is data (schema-validated files), not engine code.

## Workflow
- Never commit to `main`. One task, one branch or worktree, named after the task ID (`feature/t03-core-earnings`).
- Plan first for anything touching more than a few files; get the plan approved before editing.
- Tests alongside code; run typecheck, lint, and tests before saying a task is done.
- Brief subagents with the task ID, the spec section, and "done means" criteria (template: `~/.claude/skills/app-project-kickoff/references/task-brief-template.md`).
- Record any non-obvious decision in `docs/decisions/<date>-<slug>.md`.
- Keep diffs reviewable in one sitting; split the task, not the review.

## Do not
- Propose selling Pawprints, care items, or faster growth, even as an experiment.
- Add features outside the current milestone without moving something out or adding to the backlog in SCOPE.md.
- Use Expo Go for anything involving health, Rive, or notifications.
- Put health data, real names, or precise activity timestamps in logs, analytics, or AI prompts.
