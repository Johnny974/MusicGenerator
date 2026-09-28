# M1-06: Review fixes — limiter, fade-in curve, Play pending state

**What to build:** Three fixes from the M1 code review. The mix can't clip however the knobs are set; Play's fade-in _sounds_ like it takes the full ~3 s instead of arriving in the first second; and the Play button shows that it's starting, so a double-click can't fire twice.

**Blocked by:** M1-03, M1-04

**Status:** done

## Approach

### Limiter on the master bus

- Why: three layers at full plus a +12 dB EQ boost can exceed 0 dBFS. Each layer alone is safe (M1-01 peak test); the sum is not.
- Add a limiter as the last stage before the transport fade: `… → volume → limiter → fade → destination`. It sits before `fade` so a fade-out still lands on true silence, and inside `master.ts` so live playback and offline render both get it with no extra wiring.
- Ceiling just under full scale (e.g. −1 dBFS). The limiter must be **transparent below the ceiling**: default settings should sound, and measure, the same as before.
- Watch-out: Tone.Limiter wraps the native `DynamicsCompressorNode`, and the Web Audio spec gives that node **automatic makeup gain**, which can raise the level even when nothing is being limited. Measure it first. If it isn't transparent, use a different approach (e.g. a `WaveShaper` soft clip above the ceiling, or a small AudioWorklet), and write the reason in a comment.
- The limiter has its own internal state (envelope, look-ahead). Check that the M1-05 seek test (`maxError < 1e-6`) still passes. If a loud setting breaks it, the 0.5 s offline pre-roll may need to cover the limiter's release time.

### dB-linear fade-in

- Why: `fade.gain.linearRampTo(1, 3)` is linear in _gain_, which is already −20 dB after 0.3 s and ~−9.5 dB after 1 s. The ear hears in dB, so most of the rise happens in the first second.
- A **pure** curve in `web/src/lib/` (e.g. `fadeInGain(progress)`, progress 0–1 → gain): rises evenly in dB from a floor (~−50 dB, tune by ear) to 0 dB, with `progress = 0 → 0` exactly. Write it test-first with `/tdd`.
- `master.ts` samples it into a `Float32Array` and plays it with `setValueCurveAtTime` (Tone: `Param.setValueCurveAtTime`).
- **Reversal must stay click-free:** Play during a Stop fade-out has to continue from the current level. Hold the current value (`cancelAndHoldAtTime`), invert the curve to find where on it that level sits, and play only the rest of the curve for the remaining share of `FADE_IN_SECONDS`. Stop during a fade-in still cancels, holds and ramps linearly to 0 (the stop fade is short, so linear is fine).

### Play button pending state

- Why: while `Tone.start()` is pending the button still says "Play", so a double-click calls `startAudio` twice. `transportRequest` makes this harmless, but the UI shouldn't allow it.
- In `AmbiencePage.tsx`, replace the `playing` boolean with one state value: `'stopped' | 'starting' | 'playing'`. While `'starting'`, the button is disabled and reads "Starting…". A union type for UI state is a common React pattern: it rules out impossible combinations such as "starting and playing at once".

### Deferred (not in this ticket)

- Live playback restarts a layer at the start of its loop instead of `t mod length`. No difference can be heard for noise; it's recorded under M2 in [M2–M4 outline](M2-M4-outline.md).

## Files touched

- `web/src/audio/master.ts` — limiter, curve-based fade-in
- `web/src/lib/fade.ts` (+ `fade.test.ts`) — pure fade-in curve
- `web/src/audio/fades.ts` — curve floor / limiter ceiling constants, if they belong with the fades
- `web/src/pages/AmbiencePage.tsx` — pending state
- `web/e2e/` — new checks below

## Acceptance criteria

- [x] All three layers at full + every EQ band at +12 dB + master at full → the offline render's peak is ≤ the ceiling (no sample ≥ 1.0).
- [x] Default settings: offline RMS is within ±0.2 dB of the value before the limiter was added (the limiter is transparent).
- [x] Play: loudness rises steadily across the whole fade; at 1 s it is still well below the level at 3 s (by ear and by test).
- [x] Play during a Stop fade-out, and Stop during a Play fade-in, continue from the current level with no click.
- [x] While audio is starting the Play button is disabled and shows "Starting…"; a double-click on Play ends up playing, with no page errors.
- [x] The M1-05 seek and determinism tests still pass.
- [x] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Vitest (`fade.test.ts`)**: `fadeInGain(0) === 0`, `fadeInGain(1) === 1`; the curve only ever rises; evenly spaced progress steps give evenly spaced dB steps above the floor; inverting the curve at a mid value returns the progress that produced it.
- **Playwright (offline)**: worst-case settings → peak ≤ ceiling; default settings → RMS unchanged (±0.2 dB) versus a pinned pre-limiter value.
- **Playwright (live)**: `outputRms()` at ~1 s is clearly below ~2 s, which is clearly below ~4 s (a steady rise, not front-loaded).
- **Playwright**: double-click Play → the button reaches "Stop", audio is non-silent after the fade, no `pageerror`.
