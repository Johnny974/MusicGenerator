# M1-02: White and pink noise layers

**What to build:** The Ambience page offers three independent layers — **white, pink, brown** — each with its own level fader, freely mixable. A layer at 0 does not run (no wasted CPU); raising its fader brings it in.

**Blocked by:** M1-01

**Status:** done

## Approach

- Extend the pure noise generator from M1-01 with `white` and `pink`:
  - white = raw seeded samples,
  - pink = white through a pinking filter (e.g. Paul Kellet's filter).
- Same rules as brown: seeded per color and channel, ~30 s loop, click-free seam, RMS-normalized to the shared target.
- Reuse the layer channel from M1-01 — adding a layer should be data (a list of layer definitions), not copy-pasted engine code.
- Settings model gains a level per layer. Default mix: brown up, the others at 0.

**Follow-up (after listening):** equal RMS left white ~10 dB louder than brown to the ear. Layers are now normalized to perceived loudness instead — ITU-R BS.1770 K-weighted, `NOISE_TARGET_LUFS = -24` (`web/src/lib/loudness.ts`).

## Files touched

- `web/src/generators/noise.ts` + `noise.test.ts`
- `web/src/audio/engine.ts`
- `web/src/pages/AmbiencePage.tsx` (three faders; a small `LayerFader` component under `web/src/components/` is welcome)
- `web/e2e/` (new or extended spec)

## Acceptance criteria

- [x] Three faders labelled White / Pink / Brown; each audibly controls its own layer.
- [x] The three colors sound clearly different (white hiss → pink rush → brown rumble).
- [x] At equal fader positions the layers are roughly equally loud.
- [x] Layers at 0 are not playing (player stopped or never started).
- [x] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Vitest**: determinism per color; spectral ordering — high-frequency energy share white > pink > brown; RMS normalization; loop seam continuity for all three colors.
- **Playwright**: for each layer alone at a mid fader → `outputRms()` > threshold; all faders at 0 → ~silent.
