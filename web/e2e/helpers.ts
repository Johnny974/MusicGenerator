import { expect, type Page } from '@playwright/test'

type TestWindow = Window & {
  __musicgen: { outputRms: () => number; activeLayers: () => string[] }
}

export function outputRms(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).__musicgen.outputRms())
}

export function activeLayers(page: Page) {
  return page.evaluate(() => (window as unknown as TestWindow).__musicgen.activeLayers().sort())
}

/** A labelled slider: each fader lives in a role="group" named by its label. */
export function slider(page: Page, label: string) {
  return page.getByRole('group', { name: label, exact: true }).getByRole('slider')
}

/** 0–1 faders: Home → minimum; each PageUp adds 10 steps (0.1 here). */
export async function setFader(page: Page, label: string, tenths: number) {
  const handle = slider(page, label)
  await handle.focus()
  await handle.press('Home')
  for (let i = 0; i < tenths; i++) await handle.press('PageUp')
  await expect(handle).toHaveAttribute('aria-valuenow', String(tenths / 10))
}

export async function play(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible()
}

/**
 * Average of several RMS reads spread over `ms`, so one noisy analyser frame
 * can't decide a louder/quieter comparison.
 */
export async function averageRms(page: Page, reads = 10, ms = 500) {
  let sum = 0
  for (let i = 0; i < reads; i++) {
    sum += await outputRms(page)
    await page.waitForTimeout(ms / reads)
  }
  return sum / reads
}

/** EQ sliders (±12 dB, 0.5 dB steps): Home → −12 dB, then ArrowUp in 0.5 dB steps. */
export async function setEq(page: Page, label: string, db: number) {
  const handle = slider(page, label)
  await handle.focus()
  await handle.press('Home')
  for (let i = 0; i < (db + 12) * 2; i++) await handle.press('ArrowUp')
  await expect(handle).toHaveAttribute('aria-valuenow', String(db))
}
