import { expect, test, type Page } from '@playwright/test'
import { activeLayers, averageRms, FADE_IN_SETTLE_MS, outputRms, play } from './helpers.ts'

/** Collects uncaught page errors so a test can assert there were none. */
function collectErrors(page: Page) {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  return errors
}

test('Play fades in: output right after onset is much quieter than after the fade', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  // Building the graph takes a moment; time the fade from the first audible sample.
  await expect.poll(() => outputRms(page), { intervals: [20] }).toBeGreaterThan(0)
  const early = await averageRms(page, 6, 300)

  await page.waitForTimeout(FADE_IN_SETTLE_MS)
  const late = await averageRms(page)
  expect(late).toBeGreaterThan(0.001)
  // A 3 s linear fade (src/audio/fades.ts) averages ~5 % gain over its first 0.3 s; a click-free cut-in would be ~100 %.
  expect(early).toBeLessThan(late * 0.3)
})

test('Stop fades out briefly instead of cutting, then is silent', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Stop' }).click()

  // Still fading 0.35 s after Stop (a hard cut, or the players' own 0.1 s fade, is silent by now)...
  await page.waitForTimeout(350)
  expect(await outputRms(page)).toBeGreaterThan(0.0001)

  // ...and gone soon after (fade + Tone's 0.1 s scheduling lookahead + test latency).
  await page.waitForTimeout(550)
  expect(await outputRms(page)).toBeLessThan(0.0001)
  await expect.poll(() => activeLayers(page)).toEqual([])
})

test('Play → Stop → Play quickly keeps playing with no errors', async ({ page }) => {
  const errors = collectErrors(page)
  await play(page)
  await page.getByRole('button', { name: 'Stop' }).click()
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // Past the cancelled stop and the new fade-in: the layer must still be running.
  await page.waitForTimeout(FADE_IN_SETTLE_MS)
  expect(await activeLayers(page)).toEqual(['brown'])
  expect(await outputRms(page)).toBeGreaterThan(0.001)
  expect(errors).toEqual([])
})

test('rapid Play/Stop toggling ends cleanly in either state', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  for (let i = 0; i < 6; i++) {
    const next = i % 2 === 0 ? 'Play' : 'Stop'
    await page.getByRole('button', { name: next }).click()
  }
  // Last click was Stop.
  await page.waitForTimeout(1000)
  expect(await outputRms(page)).toBeLessThan(0.0001)
  expect(await activeLayers(page)).toEqual([])

  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeGreaterThan(0.001)
  expect(errors).toEqual([])
})

test('navigating to /lofi while playing goes silent', async ({ page }) => {
  await play(page)
  await page.getByRole('link', { name: 'Lofi' }).click()
  await expect(page.getByRole('heading', { name: 'Lofi' })).toBeVisible()

  await page.waitForTimeout(1000)
  expect(await outputRms(page)).toBeLessThan(0.0001)
  expect(await activeLayers(page)).toEqual([])
})

test('leaving the page right after pressing Play never starts sound', async ({ page }) => {
  await page.goto('/')
  // No waiting between the two clicks: the page unmounts while Play is still starting up.
  await page.getByRole('button', { name: 'Play' }).click()
  await page.getByRole('link', { name: 'Lofi' }).click()

  await page.waitForTimeout(FADE_IN_SETTLE_MS)
  expect(await outputRms(page)).toBeLessThan(0.0001)
  expect(await activeLayers(page)).toEqual([])
})
