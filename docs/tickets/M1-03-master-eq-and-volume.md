# M1-03: Master 3-band EQ and master volume

**What to build:** A master section on the Ambience page with **Low / Mid / High EQ** and a **master volume**, applied to the whole mix. The same master section will later be reused on the Lofi page (SPEC §4), so it should be a self-contained part of the engine and a self-contained UI component.

**Blocked by:** M1-01 (independent of M1-02 — can run in parallel)

**Status:** ready-for-agent

## Approach

- Engine: `master bus → 3-band EQ → master volume → destination`, analyser tap after master volume (so tests see what the listener hears).
- EQ bands: ±12 dB each, default 0 dB (flat). Master volume uses the fader helper from M1-01.
- UI: a `MasterSection` component (EQ sliders + volume). Rotary knobs come in M2 — sliders are fine here.

## Files touched

- `web/src/audio/engine.ts` (or a small `master.ts` beside it)
- `web/src/components/MasterSection.tsx` (new)
- `web/src/pages/AmbiencePage.tsx`
- `web/e2e/`

## Acceptance criteria

- [ ] Cutting High makes brown/pink/white noticeably darker; boosting Low adds rumble.
- [ ] Master volume scales the entire mix; 0 = silent.
- [ ] All EQ at 0 dB sounds identical to no EQ.
- [ ] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Playwright**: master volume at 50% gives lower `outputRms()` than at 100%; at 0 → ~silent.
- **Playwright** (optional): with white noise only, cutting High lowers RMS.
