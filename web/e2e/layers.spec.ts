import { expect, test } from '@playwright/test'
import { activeLayers, outputRms, play, setFader, slider } from './helpers.ts'

const LAYERS = ['White', 'Pink', 'Brown'] as const

test('offers White, Pink and Brown faders with only brown up by default', async ({ page }) => {
  await page.goto('/')
  for (const label of LAYERS) await expect(slider(page, label)).toBeVisible()
  await expect(slider(page, 'White')).toHaveAttribute('aria-valuenow', '0')
  await expect(slider(page, 'Pink')).toHaveAttribute('aria-valuenow', '0')

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
