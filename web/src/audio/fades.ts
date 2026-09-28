/**
 * Every fade and ramp duration in the audio engine, in seconds.
 *
 * Any change in level — starting, stopping, moving a fader — goes through a
 * ramp. A sudden jump in a gain makes a step in the waveform, which you hear
 * as a click; many small jumps in a row (a dragged fader) crackle ("zipper noise").
 */

/** Play: the whole mix rises from silence (SPEC §3). */
export const FADE_IN_SECONDS = 3

/** Stop and page leave: the whole mix sinks to silence before the players stop. */
export const STOP_FADE_SECONDS = 0.4

/** Every UI parameter change (faders, EQ knobs): short enough to feel instant. */
export const PARAM_RAMP_SECONDS = 0.05

/** A single layer's player starting or stopping when its fader crosses 0. */
export const SOURCE_FADE_SECONDS = 0.1
