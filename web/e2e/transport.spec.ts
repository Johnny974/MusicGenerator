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
  // The fade-in (src/lib/fade.ts) is still below −40 dB over its first 0.3 s; a hard cut-in would be at full.
  expect(early).toBeLessThan(late * 0.3)
})

test('Play fades in evenly: still quiet at 1 s, louder at 2 s, full by 4 s', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => outputRms(page), { intervals: [20] }).toBeGreaterThan(0)
  const onset = Date.now()
  const rmsAt = async (ms: number) => {
    await page.waitForTimeout(ms - 100 - (Date.now() - onset))
    return averageRms(page, 4, 200)
  }

  const oneSecond = await rmsAt(1000)
  const twoSeconds = await rmsAt(2000)
  const fourSeconds = await rmsAt(4000)
  // The fade rises evenly in dB (src/lib/fade.ts): about −33, −17 and 0 dB. A ramp
  // linear in gain would already be at 1/3 and 2/3 of full, failing the second check.
  expect(oneSecond).toBeLessThan(twoSeconds * 0.4)
  expect(twoSeconds).toBeLessThan(fourSeconds * 0.4)
})

test('Play during a Stop fade-out continues from the current level', async ({ page }) => {
  await play(page)
  await page.getByRole('button', { name: 'Stop' }).click()
  // Early in the 0.4 s fade-out. Tone schedules 0.1 s ahead, so the fade-out keeps
  // going a little after Play too; press later and it has nearly reached silence.
  await page.waitForTimeout(150)
  const beforePlay = await outputRms(page)
  await page.getByRole('button', { name: 'Play' }).click()

  // Starting the fade-in over from silence would drop to its −50 dB floor (×0.003).
  let lowest = Infinity
  for (let i = 0; i < 10; i++) {
    lowest = Math.min(lowest, await outputRms(page))
    await page.waitForTimeout(30)
  }
  expect(lowest).toBeGreaterThan(beforePlay * 0.1)
})

test('Stop during a Play fade-in fades down from the current level', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => outputRms(page), { intervals: [20] }).toBeGreaterThan(0)
  await page.waitForTimeout(1500)
  const beforeStop = await outputRms(page)
  await page.getByRole('button', { name: 'Stop' }).click()

  // At 1.5 s the fade-in is ~−25 dB and rising 16 dB/s, and it keeps rising for
  // Tone's 0.1 s lookahead after Stop. A jump to full would be ~18× louder.
  let loudest = 0
  for (let i = 0; i < 10; i++) {
    loudest = Math.max(loudest, await outputRms(page))
    await page.waitForTimeout(30)
  }
  expect(loudest).toBeLessThan(beforeStop * 4)
  await page.waitForTimeout(500)
  expect(await outputRms(page)).toBeLessThan(0.0001)
})

test('Play shows "Starting…" and ignores clicks until audio has started', async ({ page }) => {
  const errors = collectErrors(page)
  // Make the browser slow to allow audio, so the starting state is long enough to see.
  await page.addInitScript(() => {
    const resume = AudioContext.prototype.resume
    AudioContext.prototype.resume = function () {
      return new Promise((done) => setTimeout(done, 500)).then(() => resume.call(this))
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).dblclick()
  await expect(page.getByRole('button', { name: 'Starting…' })).toBeDisabled()

  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
  await page.waitForTimeout(FADE_IN_SETTLE_MS)
  expect(await outputRms(page)).toBeGreaterThan(0.001)
  expect(errors).toEqual([])
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
