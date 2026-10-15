# Kithe

A cozy dog-raising game for iPhone and Android where real-life movement is the only way to care for your pup. Money buys outfits, never care.

The product docs (design doc, scope, specs, decisions) are private and not part of this repo.

## Prerequisites

- Node 22 (see `.nvmrc`)
- Local Android builds: JDK 17, `ANDROID_HOME` pointing at an Android SDK, and `%ANDROID_HOME%\platform-tools` on `PATH`
- iOS builds run in the cloud through EAS Build and need an Apple Developer account

## Setup

```
npm ci
```

## Commands (from the repo root)

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint over the whole repo |
| `npm run format` / `npm run format:check` | Prettier write / check |
| `npm test` | vitest across `packages/*` and `scripts` |
| `npm run sim` | economy simulation (`scripts/economy-sim.ts`) |
| `npm run mobile` | Expo dev server for `apps/mobile` |
| `npm run android` | build and launch the Android development build |

## Layout

- `apps/mobile` — Expo app: screens, navigation, platform adapters
- `packages/core` — pure TypeScript game rules; no React, no platform imports
- `packages/content` — schema-validated data: economy, items, events, copy
- `scripts/` — simulations and Claude Code hooks
