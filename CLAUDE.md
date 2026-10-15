# Kithe

A cozy dog-raising game for iPhone and Android where real-life movement is the only way to care for your pup. Money buys outfits, never care.

## Read first
- Scope (locked): @SCOPE.md
- Expo rules for the app workspace: @apps/mobile/AGENTS.md
- Current milestone: `docs/specs/phase-0-concept-art-prototype.md` (read the section your task names; task IDs T1 to T17 live there)
- Decisions: `docs/decisions/` (one dated file per decision; check it before asking Tommy to re-decide anything)
- Full design doc: `docs/design-doc.md` (long; read the section you need, not the whole thing)
- Landing page and waitlist: `docs/landing-page.md`

## Stack
- Expo SDK 57 (React Native 0.86, React 19.2), Expo Router, TypeScript 6. Development builds only; native modules do not run in Expo Go. The design doc's "SDK 56" is superseded by `docs/decisions/2026-10-11-toolchain-sdk-57-npm-vitest.md`.
- npm workspaces, one hoisted root install, one lockfile. Add app dependencies with `npx expo install <pkg>` from `apps/mobile` so versions match the SDK.
- Tests: vitest for `packages/*` and `scripts`. App component tests arrive with the first real screens.
- Health: `@kingstinct/react-native-healthkit` (iOS), `react-native-health-connect` (Android), `expo-sensors` pedometer fallback (deferred). HealthKit and Rive both run on `react-native-nitro-modules`.
- Pet animation: `@rive-app/react-native` from Phase 1. Phase 0 uses static concept art swapped by state.
- Backend: Supabase. The Phase 0 app is local-first with no app backend; Supabase holds the waitlist. Server wallet, auth, and nightly AI jobs arrive in Phase 2.
- Purchases: RevenueCat (Phase 2). AI: Claude API, server-side only, nightly batches (Phase 2).
- Analytics and crashes: PostHog, Sentry. No health data in any event.

## Commands (from the repo root)
- `npm ci` installs everything.
- `npm run typecheck`, `npm run lint`, `npm run format`, `npm run format:check`.
- `npm test` runs vitest across packages and scripts.
- `npm run sim` runs `scripts/economy-sim.ts`.
- `npm run mobile` starts the Expo dev server; `npm run android` builds and launches the Android dev build (`expo run:android`). After native changes (new modules, app.config.ts), run `APP_VARIANT=development npx expo prebuild --platform android --no-install` in `apps/mobile` first; letting `run:android` regenerate the folders itself has failed mid-build twice.
- `npx expo-doctor` in `apps/mobile` checks dependencies and config.
- iOS builds: `npx eas-cli build --profile development --platform ios` from `apps/mobile` (cloud; needs the Apple Developer account).
- Local Android builds need JDK 17 (`C:\Users\tommy\Java\jdk-17.0.20.1+1`) and the dev caches on E: because C: is full: `ANDROID_HOME=E:\dev\Android\sdk`, `ANDROID_AVD_HOME=E:\dev\Android\avd`, `GRADLE_USER_HOME=E:\dev\gradle`, with `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator` on `PATH`. `ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64,arm64-v8a` limits local builds to the emulator and phone ABIs; EAS builds ignore it and ship all ABIs.

## Repo layout
- `apps/mobile` — `@kithe/mobile`, the Expo app: routes in `src/app/`, components and adapters outside it
- `packages/core` — `@kithe/core`: pure TypeScript game rules; no React, no platform types; fully unit-tested
- `packages/content` — `@kithe/content`: zod-validated data (`src/data/*.json`, schemas in `src/schema/`)
- `scripts/` — `@kithe/scripts`: `economy-sim.ts` and the Claude Code hooks in `scripts/hooks/`
- `docs/` — design doc, specs, decisions
- `web/` — static landing page and waitlist (plain HTML/CSS/JS, no build), live at https://kithe-dusky.vercel.app; deploy with `npx vercel@latest deploy --prod` from `web/` (Vercel account marqueofficialhq-5849, project `kithe`)
- `backend/supabase/migrations/` — SQL run by hand in the Supabase SQL Editor (project `gmrktteafiuejkaeewrb`); the public key may only call `join_waitlist` and `answer_waitlist`, never touch tables

## Conventions
- Game rules live in `packages/core` as pure functions with test vectors; the app and the economy sim both call them. Never duplicate a rule in UI code.
- Tunable numbers (prices, decay rates, caps, thresholds) live in `packages/content`, never as literals in code.
- `packages/content/src/core-config.ts` is the only place content becomes core config (`careConfig`, `needsConfig`, ...). The app and the sim both import from it; core never imports content at runtime.
- One adapter interface per native capability (MovementSource, Notifier, Storage); platform-specific code lives only in adapters.
- Day boundaries use the player's home time zone, locked at adoption; a change applies from the next day; a backwards clock never re-credits a day.
- Numbers stay quiet in the UI: needs show as pet behavior and icons first; exact values only on tap.
- Copy: no screen needs more than 12 words to understand. Notifications are always good news.

## Invariants (never break; each gets a test)
1. Care can never be bought. No food, care item, healing, growth speed, Rest Mode, or movement credit ever has a Stars or dollar price, and nothing grants Pawprints except movement, the starter kit, and documented event rewards. Data side: `packages/content/src/invariants.test.ts`. Rule side: `packages/core` tests.
2. The pet never dies, starves, or gets sick from neglect. There is no death state in the types. Needs never drop below the safety floor (25).
3. Raw health data never leaves the device. The server, analytics, logs, and the AI receive goal progress and coarse buckets only; never step counts, exercise minutes, heart rate, or health samples.
4. No guilt mechanics: no streak resets, no countdown timers, no "hungry / sad / misses you" notifications, no purchase prompts when the pet is mopey or sick or before day 7. Notification and diary copy passes the banned-phrase test.
5. The app never shows calories, weight, or body measurements. AI and template copy never contain body, diet, or medical talk. This protects the player: the pup's own realistic dog life (teething, a mild upset tummy, a vet checkup) is a design feature, described gently and never as suffering.
6. No ads. No randomized paid items.
7. Growth requires both calendar time and bond; nothing purchasable shortens it.
8. Game content is data (schema-validated files), not engine code.

## Workflow
- Never commit to `main`. One task, one branch or worktree, named after the task ID (`feature/t03-core-earnings`).
- Plan first for anything touching more than a few files; get the plan approved before editing.
- Tests alongside code. The hooks in `.claude/settings.json` format, typecheck, and lint every edit and run the tests when you stop; still run `npm run typecheck && npm run lint && npm test` before saying a task is done.
- Brief subagents with the task ID, the spec section, and "done means" criteria (template: `~/.claude/skills/app-project-kickoff/references/task-brief-template.md`).
- Record any non-obvious decision in `docs/decisions/<date>-<slug>.md`.
- Keep diffs reviewable in one sitting; split the task, not the review.

## Do not
- Propose selling Pawprints, care items, or faster growth, even as an experiment.
- Add features outside the current milestone without moving something out or adding to the backlog in SCOPE.md.
- Use Expo Go for anything involving health, Rive, or notifications.
- Put health data, real names, or precise activity timestamps in logs, analytics, or AI prompts.
- Add app dependencies with plain `npm install`; use `npx expo install` so SDK-compatible versions are chosen.
- Edit `ios/` or `android/` by hand; they are generated from `apps/mobile/app.config.ts` and config plugins.
- Treat a zero-movement read as "didn't move" without checking `movementSource.getAccess()` first; a revoked permission also reads as zero (see `docs/spikes/t07-health-data.md`).
- Call `adb` from Git Bash without `MSYS_NO_PATHCONV=1`; Git Bash rewrites device paths like `/sdcard/...` into Windows paths.
- Run `expo start` or `expo run:*` with `CI` set: Metro then disables its file watcher ("running in CI mode, reloads are disabled"), so Fast Refresh and even manual reloads serve stale code. Expo CLI already goes non-interactive without a TTY; no flag is needed.
