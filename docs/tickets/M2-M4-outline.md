# M2–M4 outline (rough)

Not tickets yet. Break each milestone into detailed tickets (like `M1-*.md`) when it starts — M1 will teach us things that change these.

## M2 — Perlin + seed

1. **Seeded Perlin library** — pure 1D Perlin/simplex noise from `createRng`, sampled at any time `t` (seekable), octaves. Vitest: determinism, range, smoothness (no jumps between close `t`).
2. **Volume modulation + variation knob** — each layer's volume drifts via its own Perlin channel; per-layer "variation" controls depth. First custom **rotary Knob** component (pointer drag, keyboard, accessible).
3. **Filter + pan modulation** — per-layer filter cutoff (brightness / distance) and stereo position driven by further Perlin channels.
4. **Calm ↔ lively** — global knob scaling modulation depth and speed of all layers.
5. **Seed UI** — seed field + 🎲 re-roll; changing seed regenerates buffers and modulation.
6. **URL + localStorage state** — URL query string is source of truth; localStorage restores the last session on a bare URL (SPEC §1).

Note: modulation must be computable for any `t` (offline render + seek), not accumulated live. Extend the M1-05 offline test to cover it.

## M3 — Rain / wind / fire

1. **Event scheduler** — engine pulls `(t0, t1)` event windows from pure generators slightly ahead of time and schedules them; same path offline. Vitest on generator windows: determinism, and that `[t0,t1)` ∪ `[t1,t2)` = `[t0,t2)`.
2. **Wind** — no discrete events: band-passed noise with moving cutoff/resonance + gusts from Perlin. Simplest, proves layer plumbing.
3. **Fire** — brown-noise roar + crackle/pop events.
4. **Rain** — noise bed + droplet events; hardest to make convincing (consider a `/prototype` session for sound design).

Each layer: level + variation knob, joins calm ↔ lively and URL state.

## M4 — Export + sleep timer

1. **Chunked offline renderer** — render N minutes in 30–60 s chunks via the M1-05 seek primitive; seam-continuity tests (reverb tails, events straddling chunk edges).
2. **Streaming WAV writer** — File System Access API (Chrome/Edge); header with final length; never holds the full file in memory.
3. **Export UI** — duration, progress, cancel, unsupported-browser message.
4. **`tools/mux.py`** — ffmpeg wrapper: WAV → MP3, WAV + image/loop → MP4 for YouTube.
5. **Sleep timer** — 30/60/90 min with slow fade-out (reuses M1-04 fade mechanism).
