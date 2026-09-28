import { expect, test } from '@playwright/test'
import {
  outputRms,
  play,
  renderOffline,
  type AmbienceSettings,
  type TestWindow,
} from './helpers.ts'

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

test('an offline render does not disturb live playback', async ({ page }) => {
  await play(page)
  await page.evaluate(
    (settings) =>
      (window as unknown as TestWindow).__musicgen.renderOffline({ settings, duration: 2 }),
    MIX,
  )
  await expect.poll(() => outputRms(page), { timeout: 2000 }).toBeGreaterThan(0.001)
})
