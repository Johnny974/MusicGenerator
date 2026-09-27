import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { LayerFader } from '@/components/LayerFader'
import { setLayerLevel, startAudio, stopAudio } from '@/audio/engine'
import type { NoiseColor } from '@/generators/noise'
import { DEFAULT_AMBIENCE_SETTINGS, NOISE_LAYERS, type AmbienceSettings } from '@/lib/settings'

export function AmbiencePage() {
  const [playing, setPlaying] = useState(false)
  const [settings, setSettings] = useState<AmbienceSettings>(DEFAULT_AMBIENCE_SETTINGS)

  // Stop sound when the user navigates away from this page.
  useEffect(() => stopAudio, [])

  async function toggle() {
    if (playing) {
      stopAudio()
      setPlaying(false)
    } else {
      await startAudio(settings)
      setPlaying(true)
    }
  }

  function changeLevel(color: NoiseColor, level: number) {
    // React state drives the slider UI; the engine gets the new level directly so
    // the sound follows the thumb without waiting for a re-render.
    setSettings((s) => ({ ...s, levels: { ...s.levels, [color]: level } }))
    setLayerLevel(color, level)
  }

  return (
    <section className="flex flex-col items-center gap-6">
      <h1 className="text-3xl font-semibold">Ambience</h1>
      <p className="text-muted-foreground">
        Noise, rain, wind and fire for sleep, relaxation and focus.
      </p>
      <Button size="lg" onClick={toggle}>
        {playing ? 'Stop' : 'Play'}
      </Button>
      <div className="flex w-full max-w-sm flex-col gap-6">
        {NOISE_LAYERS.map(({ color, label }) => (
          <LayerFader
            key={color}
            label={label}
            value={settings.levels[color]}
            onChange={(level) => changeLevel(color, level)}
          />
        ))}
      </div>
    </section>
  )
}
