# M1-04: Smooth transport — fade-in, fade-out, no clicks

**What to build:** Starting, stopping and adjusting sound is always smooth: Play **fades in** over ~3 s (SPEC §3), Stop fades out briefly instead of cutting, dragging any fader glides instead of crackling ("zipper noise"), and leaving the page stops the audio.

**Blocked by:** M1-01

**Status:** ready-for-agent

## Approach

- Fade-in / fade-out live on the master bus gain (one place, covers all layers), not per layer.
- Stop = ramp master to silence (~0.3–0.5 s), then stop the players. Pressing Play during a fade-out must work cleanly (cancel scheduled ramps).
- Every parameter change from the UI goes through a short ramp (~50 ms), never a hard value jump.
- Navigation away from the Ambience page stops audio (already roughly there from M0 — make sure it still holds with the new engine).
- Fade durations are named constants in one place (the sleep timer in M4 will reuse the fade-out mechanism with a much longer duration).

## Files touched

- `web/src/audio/engine.ts`
- `web/src/pages/AmbiencePage.tsx` (only if the Play/Stop wiring changes)
- `web/e2e/`

## Acceptance criteria

- [ ] Play: sound rises gradually from silence over ~3 s.
- [ ] Stop: no click; sound gone within ~0.5 s.
- [ ] Rapid Play/Stop/Play toggling produces no clicks, stuck audio or errors in the console.
- [ ] Dragging a fader quickly produces no crackle.
- [ ] Navigating to /lofi while playing → silence.
- [ ] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Playwright**: RMS sampled ~0.3 s after Play is clearly lower than RMS after ~4 s (fade-in happens).
- **Playwright**: play, navigate to /lofi, wait 1 s → `outputRms()` ~0.
- **Playwright**: Play → Stop → Play quickly → still non-silent after fade-in, no page errors (`page.on('pageerror')`).
