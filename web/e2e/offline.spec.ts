import { expect, test } from '@playwright/test'
import {
  outputRms,
  play,
  renderOffline,
  type AmbienceSettings,
  type TestWindow,
} from './helpers.ts'

/** Mirrors DEFAULT_AMBIENCE_SETTINGS (src/lib/settings.ts). */
const DEFAULT_SETTINGS: AmbienceSettings = {
  seed: 20260927,
  levels: { white: 0, pink: 0, brown: 0.7 },
  master: { eq: { low: 0, mid: 0, high: 0 }, volume: 1 },
}

/** All three layers plus a non-flat EQ, so every part of the graph is exercised. */
const MIX: AmbienceSettings = {
  seed: 12345,
  levels: { white: 0.4, pink: 0.6, brown: 0.8 },
  master: { eq: { low: 6, mid: -3, high: -9 }, volume: 0.9 },
}

test('renders 5 s of the full mix offline, and it is not silent', async ({ page }) => {
  const { rms } = await renderOffline(page, { settings: MIX, duration: 5 })
  expect(rms).toBeGreaterThan(0.001)
})

test('same settings render identically; a different seed does not', async ({ page }) => {
  const first = await renderOffline(page, { settings: MIX, duration: 2 })
  const again = await renderOffline(page, { settings: MIX, duration: 2 })
  const otherSeed = await renderOffline(page, { settings: { ...MIX, seed: 54321 }, duration: 2 })

  expect(again.checksum).toBe(first.checksum)
  expect(otherSeed.checksum).not.toBe(first.checksum)
})

// Seek primitive for chunked export: a chunk starting at t must equal the same
// stretch of a longer render. Covers a start inside the first loop and one past it.
for (const start of [2, 45]) {
  test(`rendering [${start} s, ${start + 2} s) equals that slice of a longer render`, async ({
    page,
  }) => {
    await page.goto('/')
    const maxError = await page.evaluate(
      async ({ settings, start }) => {
        const { renderOfflineSamples } = (window as unknown as TestWindow).__musicgen
        const whole = await renderOfflineSamples({ settings, start: start - 2, duration: 4 })
        const chunk = await renderOfflineSamples({ settings, start, duration: 2 })
        const offset = 2 * whole.sampleRate
        let max = 0
        for (const [a, b] of [
          [whole.left, chunk.left],
          [whole.right, chunk.right],
        ]) {
          if (b.length !== a.length - offset) return Infinity
          for (let i = 0; i < b.length; i++) max = Math.max(max, Math.abs(a[i + offset] - b[i]))
        }
        return max
      },
      { settings: MIX, start },
    )
    // Float epsilon, not "close enough to hear": a seam here would click in an export.
    expect(maxError).toBeLessThan(1e-6)
  })
}

/** Every layer, every EQ band and the master at full: the loudest mix the knobs allow. */
const LOUDEST: AmbienceSettings = {
  seed: 12345,
  levels: { white: 1, pink: 1, brown: 1 },
  master: { eq: { low: 12, mid: 12, high: 12 }, volume: 1 },
}

/** The limiter's ceiling, −1 dBFS (src/lib/limiter.ts). */
const CEILING = 10 ** (-1 / 20)

test('the loudest possible mix stays under the limiter ceiling', async ({ page }) => {
  await page.goto('/')
  const peak = await page.evaluate(async (settings) => {
    const { renderOfflineSamples } = (window as unknown as TestWindow).__musicgen
    const { left, right } = await renderOfflineSamples({ settings, duration: 5 })
    let max = 0
    for (const channel of [left, right]) for (const x of channel) max = Math.max(max, Math.abs(x))
    return max
  }, LOUDEST)
  // Without the limiter this mix peaks near 2.9 (+9 dBFS).
  expect(peak).toBeLessThanOrEqual(CEILING)
})

test('the limiter leaves the default mix untouched', async ({ page }) => {
  const { rms } = await renderOffline(page, { settings: DEFAULT_SETTINGS, duration: 5 })
  // Measured before the limiter was added (M1-06).
  const beforeLimiter = 0.048590086
  expect(Math.abs(20 * Math.log10(rms / beforeLimiter))).toBeLessThan(0.2)
})

test('an offline render does not disturb live playback', async ({ page }) => {
  await play(page)
  await page.evaluate(
    (settings) =>
      (window as unknown as TestWindow).__musicgen.renderOffline({ settings, duration: 2 }),
    MIX,
  )
  await expect.poll(() => outputRms(page), { timeout: 2000 }).toBeGreaterThan(0.001)
})
