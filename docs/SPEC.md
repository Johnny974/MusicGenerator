# MusicGenerator — Specification

Procedural audio web app for focus, relaxation and sleep. Everything is generated
in the browser from a **seed + settings**, so any mix is reproducible and shareable.

Status: design agreed 2026-09-27. Build order in [Milestones](#milestones).

---

## 1. Product

- Public website, **no accounts**. Open it, tweak, listen.
- Two pages:
  1. **Ambience** (`/`) — noise mixer for sleep / relax / focus.
  2. **Lofi** (`/lofi`) — endless procedural lofi music for studying.
- Both pages can **export** long sessions (1 h+) as WAV for YouTube uploads.
- Navigating between pages stops the current page's audio (may change later).

### Settings persistence

- **URL query string** is the source of truth (shareable, bookmarkable),
  e.g. `/?seed=4821&brown=0.6&rain=0.8`.
- **localStorage** stores the last session and is used when the URL has no settings.
- Named presets: later, not v1.

---

## 2. Architecture

The key rule: **composition is separate from sound**.

```
seed + settings + [t0, t1) ──► Generator / Composer (pure TS) ──► events ──► Audio engine ──► speakers
                                                                                     └──► WAV chunks (export)
```

- **Generators/Composer** are pure functions. They do not import Tone.js or touch
  Web Audio. Given `(seed, settings, t0, t1)` they return every event in that window
  (notes, raindrops, crackles, parameter curves).
- **Seekable**: the output at time `t` depends only on `(seed, settings, t)`, never on
  what was played before. Needed for chunked export and makes bugs reproducible.
- **Deterministic**: all randomness goes through the seeded PRNG / seeded Perlin in
  `src/lib/`. `Math.random()` is forbidden in generator code.
- **Audio engine** (Tone.js, raw Web Audio / AudioWorklet where Tone does not help)
  schedules events and owns the node graph. The same engine code renders live or
  offline.
- Settings are modelled as "settings at time t" (constant in v1) so that automation
  or scene timelines can be added later without rewriting the engine.

### Perlin noise

Seeded 1D Perlin/simplex noise sampled at different speeds drives all variation.
Each modulation target has its own noise channel (derived sub-seed) so targets
move independently.

---

## 3. Page 1 — Ambience

### Layers (all procedural, no samples)

| Layer | Technique |
|---|---|
| White / pink / brown noise | Seeded ~30 s loop buffers (per color, separate L/R), click-free seam; position at `t` = `t mod length` |
| Rain | Filtered noise bed + spawned droplet impulses |
| Wind | Band-passed noise with moving cutoff / resonance, gusts |
| Fire | Brown-noise roar + crackle and pop impulses |

### Modulation (internal, rich)

Perlin noise modulates, per layer:
- volume
- filter cutoff (brightness / distance)
- event density (drops/s, crackles, gusts)
- stereo position

### Controls (simple UI)

- Per layer: **level**, **variation** (Perlin depth).
- Global: **calm ↔ lively** (scales modulation depth and speed of all layers).
- Master **3-band EQ** (low / mid / high).
- **Seed** field + re-roll.
- **Fade-in** on start, **sleep timer** (30 / 60 / 90 min, slow fade-out).
- Visualizer: later. Mobile background playback: best effort, not a goal.

---

## 4. Page 2 — Lofi

### Structure

- Endless stream split into **sections** of ~3 min (internally varied length).
- Each section is derived from `seed + sectionIndex`: key, mode, chord progression,
  tempo, drum template.
- Section index for time t is computable directly → seekable.
- Transitions: drum drop, filter sweep, vinyl stop, etc.

### How noise leads the music

| Noise speed | Drives |
|---|---|
| Slow (per section) | key, mode (major / dorian / minor…), progression choice, tempo 70–90 BPM |
| Medium (per bar) | dynamics: velocity, active instruments, filter brightness, drum fills |
| Fast (per beat) | melody contour: Perlin walk over scale degrees, snapped to chord tones on strong beats |

- **Chords**: curated library of ~20 lofi progressions (ii–V–I, I–vi–IV–V, …) with
  7th/9th extensions; noise chooses progression and voicing. Markov chords later.
- **Drums**: probabilistic 16-step grid. 4–6 templates (boom-bap, half-time, …);
  section seed picks a template, noise mutates hit probabilities, ghost notes, fills.
- **Swing, complexity, section length**: internal, noise-driven — not user controls.

### Instruments (v1)

| Instrument | Source |
|---|---|
| Drums (kick, snare, hat, ghosts) | Samples |
| Keys (Rhodes / piano chords) | Samples |
| Lead melody (piano / Rhodes) | Samples |
| Guitar (chord stabs, short licks — supporting, not lead) | Samples |
| Bass | Synth |
| Pad | Synth |
| Ambience | Vinyl crackle, or rain / wind / fire reused from page 1 |

### Controls

- **Mood** (bright ↔ dark, biases mode choice)
- **Tempo range**
- **Lofi-ness** (tape wobble, low-pass, crackle amount)
- **Seed** + 🎲 re-roll
- **Mixer**: fader + pan per instrument
- Master 3-band EQ (shared with page 1)

### Samples

- **CC0 only** (e.g. VSCO 2 Community Edition, Freesound filtered to CC0).
  No CC-BY, no "free for personal use".
- Every file listed in `web/public/samples/manifest.json` with source URL and license.
- Compressed (MP3 / M4A), max 2–3 velocity layers, total budget ~20 MB.

---

## 5. Export

- Exports a **snapshot**: current seed + settings rendered for N minutes.
  (Automation / scenes: later.)
- Rendered **offline in chunks** (30–60 s) and streamed to disk as **WAV** via the
  File System Access API. A 1 h WAV is ~635 MB; rendering it in one piece would need
  ~1.3 GB RAM, so chunking is mandatory.
- Chunk seams must be continuous (reverb tails, overlapping notes). Tested.
- Export works in **Chrome / Edge** only; playback works everywhere.
- `tools/mux.py` (Python + ffmpeg) converts WAV → MP3, or WAV + image/loop → MP4
  for YouTube.

---

## 6. Tech stack

| Area | Choice |
|---|---|
| Language | TypeScript |
| App | Vite + React, React Router |
| Audio | Tone.js, Web Audio API / AudioWorklet |
| UI | Tailwind CSS + shadcn/ui; custom rotary knobs and visualizer |
| Lint / format | ESLint + Prettier, format on save |
| Unit tests | Vitest — pure logic (determinism, scale snapping, seam continuity) |
| E2E tests | Playwright, Chromium only |
| Tools | Python 3.12 venv in `tools/`, ffmpeg |
| Hosting | GitHub + Vercel (root directory `web`) |
| Node | 24 LTS (`.node-version`) |

### Repo layout

```
MusicGenerator/
├─ docs/SPEC.md
├─ CLAUDE.md
├─ web/                 Vite React app
│  ├─ src/
│  │  ├─ lib/           seeded PRNG, Perlin, math — pure
│  │  ├─ generators/    ambience + lofi composers — pure, no audio imports
│  │  ├─ audio/         engine, Tone.js graph, export
│  │  ├─ components/    React UI (ui/ = shadcn)
│  │  └─ pages/
│  ├─ public/samples/   CC0 samples + manifest.json
│  └─ e2e/              Playwright tests
└─ tools/               Python scripts (mux.py)
```

---

## Milestones

Each milestone ends working and deployed.

| # | Milestone | Done when |
|---|---|---|
| M0 | Setup | Repo, Vite app, lint, Vitest + Playwright running, deployed hello on Vercel |
| M1 | Noise core | White / pink / brown with faders, master EQ, play / stop, fade-in |
| M2 | Perlin + seed | Seeded Perlin modulation, variation knobs, calm ↔ lively, URL + localStorage state |
| M3 | Rain / wind / fire | Procedural layers via the event architecture |
| M4 | Export | Chunked seekable WAV render to disk, `tools/mux.py`, sleep timer |
| M5 | Composer | Pure lofi composer (sections, chords, melody, drums) + Vitest determinism tests |
| M6 | Lofi engine | Samples, synths, lofi FX, per-instrument mixer + pan, ambience from page 1 |
| M7 | Polish | Lofi export, visualizer, broader Playwright coverage |

## Working agreement

Claude writes the code; the owner reviews it to learn React / TypeScript.
