import { expect, test, type Page } from '@playwright/test'

type TestWindow = Window & {
  __musicgen: { outputRms: () => number; activeLayers: () => string[] }
}

const LAYERS = ['White', 'Pink', 'Brown'] as const

function outputRms(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).__musicgen.outputRms())
}

function activeLayers(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).__musicgen.activeLayers().sort())
}

function fader(page: Page, label: string) {
  return page.getByRole('group', { name: label }).getByRole('slider')
}

/** Radix sliders: Home → minimum; each PageUp adds 10 steps (0.1 here). */
async function setFader(page: Page, label: string, tenths: number) {
  const slider = fader(page, label)
  await slider.focus()
  await slider.press('Home')
  for (let i = 0; i < tenths; i++) await slider.press('PageUp')
  await expect(slider).toHaveAttribute('aria-valuenow', String(tenths / 10))
}

async function play(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
}

test('offers White, Pink and Brown faders with only brown up by default', async ({ page }) => {
  await page.goto('/')
  for (const label of LAYERS) await expect(fader(page, label)).toBeVisible()
  await expect(fader(page, 'White')).toHaveAttribute('aria-valuenow', '0')
  await expect(fader(page, 'Pink')).toHaveAttribute('aria-valuenow', '0')

  await page.getByRole('button', { name: 'Play' }).click()
  // Layers at 0 never start their player.
  await expect.poll(() => activeLayers(page)).toEqual(['brown'])
})

for (const label of LAYERS) {
  test(`${label} alone at mid fader is audible`, async ({ page }) => {
    await play(page)
    for (const other of LAYERS) await setFader(page, other, 0)
    await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeLessThan(0.0001)

    await setFader(page, label, 5)
    await expect.poll(() => activeLayers(page)).toEqual([label.toLowerCase()])
    await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeGreaterThan(0.001)
  })
}

test('all faders at 0 is silent and stops every layer', async ({ page }) => {
  await play(page)
  await setFader(page, 'White', 3)
  await setFader(page, 'Pink', 3)
  await expect.poll(() => activeLayers(page)).toEqual(['brown', 'pink', 'white'])

  for (const label of LAYERS) await setFader(page, label, 0)
  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeLessThan(0.0001)
  await expect.poll(() => activeLayers(page)).toEqual([])
})
