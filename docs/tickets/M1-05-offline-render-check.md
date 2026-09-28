# M1-05: Offline render check (de-risk M4 export)

**What to build:** Prove that the **same engine code** that plays live can also render **offline** (no speakers, faster than real time) and that it is **deterministic**. Nothing visible changes for the user; this guards the SPEC §2 rule "the same code path serves live playback and chunked offline export" before M2–M3 build on top of the engine.

**Blocked by:** M1-02

**Status:** done

## Approach

- The engine's graph construction must not assume the live global context: it builds its graph inside whatever Tone context it is given, so it can run inside `Tone.Offline(...)`.
- Offline rendering takes a settings snapshot (seed + layer levels + master section) and a duration, and returns the rendered audio.
- Add a dev-only hook, e.g. `window.__musicgen.renderOffline(seconds, settings)`, returning something small and comparable (RMS + a checksum/hash of the samples) rather than megabytes of data.
- Rendering with a **start offset** (e.g. "render 2 s starting at t = 45 s") should already work via `t mod bufferLength` — include it, it is the seek primitive M4 needs.
- No UI, no WAV writing (that is M4).

## Files touched

- `web/src/audio/engine.ts` (graph builder takes a context)
- `web/src/audio/offline.ts` (new)
- `web/e2e/offline.spec.ts` (new)
- Also, during implementation: `web/src/audio/graph.ts` (graph assembly shared by live and offline), `layer.ts` (one noise layer), `mixer.ts` (fixed-order summing — Chromium sums a node's inputs in hash-set order, so 3+ direct inputs aren't bit-exact), `web/src/lib/samples.ts` (checksum + RMS)

## Acceptance criteria

- [x] Offline render of 5 s with a mix of all three layers returns non-silent audio.
- [x] Two renders with the same settings return identical checksums; changing the seed changes the checksum.
- [x] Rendering `[2 s, 4 s)` equals the matching slice of a `[0 s, 4 s)` render (seekability) — sample-exact or within float epsilon.
- [x] Live playback still works exactly as before.
- [x] `npm run check` and `npm run test:e2e` pass.

## Tests

- **Playwright** (`offline.spec.ts`), all in the browser via the dev hook:
  - determinism (same seed → same checksum, different seed → different),
  - non-silence,
  - seek slice equality.
