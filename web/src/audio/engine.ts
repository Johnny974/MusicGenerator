import * as Tone from 'tone'

/**
 * M0 placeholder engine: plays quiet brown noise so we can prove the audio
 * pipeline works end to end. M1 replaces this with the real noise mixer.
 */

let noise: Tone.Noise | null = null
let analyser: Tone.Analyser | null = null

export async function startAudio(): Promise<void> {
  // Browsers only allow audio after a user gesture; Tone.start() resumes the context.
  await Tone.start()

  if (!analyser) {
    // Tap the master output so tests (and later the visualizer) can inspect it.
    analyser = new Tone.Analyser('waveform', 1024)
    Tone.getDestination().connect(analyser)
  }

  if (!noise) {
    noise = new Tone.Noise('brown').toDestination()
    noise.volume.value = -12
    noise.fadeIn = 2
    noise.fadeOut = 0.5
  }
  noise.start()
}

export function stopAudio(): void {
  noise?.stop()
}

/** Root-mean-square level of the master output right now (0 = silence). */
export function outputRms(): number {
  if (!analyser) return 0
  const samples = analyser.getValue() as Float32Array
  let sum = 0
  for (const s of samples) sum += s * s
  return Math.sqrt(sum / samples.length)
}

// Test hook for Playwright: lets e2e tests check that audio is not silent.
if (import.meta.env.DEV) {
  ;(window as unknown as { __musicgen: object }).__musicgen = { outputRms }
}
