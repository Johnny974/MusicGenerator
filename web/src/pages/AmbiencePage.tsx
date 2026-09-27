import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { setLayerLevel, startAudio, stopAudio } from '@/audio/engine'
import { DEFAULT_AMBIENCE_SETTINGS, type AmbienceSettings } from '@/lib/settings'

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

  function changeBrownLevel(level: number) {
    // React state drives the slider UI; the engine gets the new level directly so
    // the sound follows the thumb without waiting for a re-render.
    setSettings((s) => ({ ...s, brownLevel: level }))
    setLayerLevel('brown', level)
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
      <div
        role="group"
        aria-labelledby="brown-label"
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <span id="brown-label" className="text-sm font-medium">
          Brown
        </span>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[settings.brownLevel]}
          onValueChange={([level]) => changeBrownLevel(level)}
        />
      </div>
    </section>
  )
}
