# M1-01: Brown noise end to end (seeded buffer → master bus → fader)

**What to build:** Pressing Play on the Ambience page plays **seeded, looped brown noise** through a real mixer structure, and a level slider controls it. This replaces the M0 placeholder engine (`Tone.Noise`, which uses `Math.random` and is not reproducible) and establishes the structure every later layer plugs into.

**Blocked by:** None (can start immediately)

**Status:** done

## Approach (decided — see SPEC §2 and the M1 planning discussion)

Noise is a **pre-computed seeded loop buffer** ("option B"):

- A pure function generates ~30 s of noise per channel from `createRng(deriveSeed(seed, 'noise', color, channel))`. Left and right channels use different sub-seeds (stereo width).
- Brown = leaky-integrated white noise, DC-removed. (Pink and white arrive in M1-02 — design the function to take a `color` parameter.)
- The engine wraps the arrays in an AudioBuffer and plays them with a looping buffer player.
- **Seekable by construction**: the sound at time `t` is buffer position `t mod bufferLength`. Keep this property — M4's chunked export relies on it.
- **The loop seam must be click-free**: integrated noise does not end where it started. Crossfade the tail into the head (~50–100 ms) so the loop point is inaudible.
- Loudness: normalize by RMS to a shared target (no clipping), so later layers are comparable at equal fader positions.
- Buffers are generated at the audio context's sample rate (pass it in; don't hardcode 44.1/48 kHz).

Mixer graph: `layer player → layer gain → master bus gain → destination`, with the existing analyser tap on the master output kept working. The fader maps 0–1 to decibels (0 = silent, 1 = 0 dB, perceptually sensible curve) via a pure helper.

M1 has no seed UI yet (M2) — use a default seed constant in the settings model.

## Files touched

- `web/src/generators/noise.ts` (new, pure — no Tone.js imports) + `noise.test.ts`
- `web/src/lib/` — fader/dB helper + test
- `web/src/audio/engine.ts` — rewrite: mixer graph, layer channel, master bus; keep `outputRms` and the `window.__musicgen` dev hook
- `web/src/pages/AmbiencePage.tsx` — Play/Stop + brown level slider (shadcn `Slider`)
- `web/e2e/smoke.spec.ts`

## Acceptance criteria

- [x] Play produces brown noise; the level slider changes loudness live; slider at 0 is silent.
- [x] Same seed → bit-identical buffers; different seed → different buffers.
- [x] No audible click at the loop point (listen for 60+ s).
- [x] No `Math.random` anywhere in `src/generators` or `src/lib`.
- [x] `Tone.Noise` placeholder removed.
- [x] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Vitest (`noise.test.ts`)**: determinism per seed; L ≠ R; RMS near the target and peak < 1; brown spectrum is low-heavy (e.g. mean |sample-to-sample difference| much smaller than for white noise, or energy ratio of a simple low-pass vs. high-pass split); loop seam continuity — `|last − first|` is within the typical sample-to-sample step.
- **Vitest**: fader helper — 0 → silent (−∞ / gain 0), 1 → 0 dB, monotonic.
- **Playwright**: existing smoke test still passes (Play → non-silent); moving the slider to 0 → `outputRms()` drops to ~0.
