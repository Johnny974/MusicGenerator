import { expect, test, type Page } from '@playwright/test'

type TestWindow = Window & { __musicgen: { outputRms: () => number } }

function outputRms(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).__musicgen.outputRms())
}

test('page loads and Play produces non-silent audio', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Ambience' })).toBeVisible()

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()

  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeGreaterThan(0.001)
})

test('brown slider at 0 silences the output', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeGreaterThan(0.001)

  // Home moves a Radix slider thumb to its minimum.
  const slider = page.getByRole('group', { name: 'Brown' }).getByRole('slider')
  await slider.focus()
  await slider.press('Home')
  await expect(slider).toHaveAttribute('aria-valuenow', '0')

  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeLessThan(0.0001)
})

test('navigates to the lofi page', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Lofi' }).click()
  await expect(page.getByRole('heading', { name: 'Lofi' })).toBeVisible()
})
