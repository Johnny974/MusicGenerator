import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { startAudio, stopAudio } from '@/audio/engine'

export function AmbiencePage() {
  const [playing, setPlaying] = useState(false)

  // Stop sound when the user navigates away from this page.
  useEffect(() => stopAudio, [])

  async function toggle() {
    if (playing) {
      stopAudio()
      setPlaying(false)
    } else {
      await startAudio()
      setPlaying(true)
    }
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
    </section>
  )
}
