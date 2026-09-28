# MusicGenerator

Procedural ambience + lofi music web app. Full design: [docs/SPEC.md](docs/SPEC.md) — read it before any feature work; milestones M0–M7 define the build order. Work is split into tickets in [docs/tickets/](docs/tickets/README.md): one ticket per session; when done, tick its criteria, set Status to `done`, update the README table.

## Layout

- `web/` — Vite + React 19 + TypeScript + Tone.js + Tailwind v4 + shadcn/ui. Run all npm commands from here.
- `tools/` — Python 3.12 scripts (ffmpeg muxing), own venv in `tools/.venv`.

## Architecture rules

- `web/src/generators/` and `web/src/lib/` are **pure**: no Tone.js, no Web Audio, no DOM. They map `(seed, settings, t0, t1)` → events.
- Generators must be **seekable** (output at time t depends only on seed, settings, t) and **deterministic**: use `createRng` / `deriveSeed` from `src/lib/random.ts`. Never `Math.random()`.
- Exception: noise beds (`generators/noise.ts`) return a seeded loop buffer, not events (SPEC layer table). They stay seekable because the audio layer plays buffer position `t mod length`.
- `web/src/audio/` owns Tone.js / Web Audio and turns events into sound; the same code path serves live playback and chunked offline export.
- `src/components/ui/` is shadcn-generated — add via `npx shadcn@latest add <name>`, don't hand-edit unless necessary.
- Imports use the `@/` alias for `src/`.

## Commands (in `web/`)

- `npm run dev` — dev server on :5173
- `npm run check` — typecheck + lint (oxlint) + prettier check + unit tests
- `npm test` — Vitest (`src/**/*.test.ts`, pure logic only)
- `npm run test:e2e` — Playwright (`e2e/`). `PW_CHANNEL=msedge` uses installed Edge.
- E2E audio checks read `window.__musicgen.outputRms()` (dev-only hook in `src/audio/engine.ts`).

## Conventions

- Prettier: no semicolons, single quotes, width 100.
- Samples: CC0 only, each listed in `web/public/samples/manifest.json` with source URL + license.
- Owner is learning React: Claude writes the code; keep it readable and explain notable React/audio patterns when handing work over.
