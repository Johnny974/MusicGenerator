import { expect, test } from '@playwright/test'

type TestWindow = Window & { __musicgen: { outputRms: () => number } }

test('page loads and Play produces non-silent audio', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ambience' })).toBeVisible()

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  // Fade-in takes 2 s, so poll until the master output has real signal.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as TestWindow).__musicgen.outputRms()), {
      timeout: 5000,
    })
    .toBeGreaterThan(0.001)
})

test('navigates to the lofi page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Lofi' }).click()
  await expect(page.getByRole('heading', { name: 'Lofi' })).toBeVisible()
})
