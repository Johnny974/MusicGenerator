import { expect, test } from '@playwright/test'
import { averageRms, outputRms, play, setEq, setFader } from './helpers.ts'

test('master volume at 0 silences the whole mix', async ({ page }) => {
  await play(page)
  await setFader(page, 'White', 5)
  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeGreaterThan(0.001)

  await setFader(page, 'Master volume', 0)
  await expect.poll(() => outputRms(page), { timeout: 5000 }).toBeLessThan(0.0001)
})

test('master volume at 50% is quieter than at 100%', async ({ page }) => {
  await play(page)
  await setFader(page, 'Master volume', 10)
  const full = await averageRms(page)

  await setFader(page, 'Master volume', 5)
  // Fader curve: 0.5 → gain 0.125, so the drop should be large, not marginal.
  await expect.poll(() => averageRms(page)).toBeLessThan(full * 0.25)
})

test('cutting High darkens white noise; returning to flat restores it', async ({ page }) => {
  await play(page)
  await setFader(page, 'Brown', 0)
  await setFader(page, 'White', 5)
  const flat = await averageRms(page)

  await setEq(page, 'High', -12)
  // White noise carries most of its energy above 2.5 kHz, so a −12 dB shelf there is a big drop.
  await expect.poll(() => averageRms(page)).toBeLessThan(flat * 0.6)

  await setEq(page, 'High', 0)
  await expect.poll(() => averageRms(page)).toBeGreaterThan(flat * 0.9)
})

test('boosting Low adds rumble to brown noise', async ({ page }) => {
  await play(page)
  const flat = await averageRms(page)

  await setEq(page, 'Low', 12)
  await expect.poll(() => averageRms(page)).toBeGreaterThan(flat * 1.5)
})
