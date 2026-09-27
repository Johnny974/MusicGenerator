import { useId } from 'react'
import { Slider } from '@/components/ui/slider'

interface LayerFaderProps {
  label: string
  /** Fader position in [0, 1]. */
  value: number
  onChange: (value: number) => void
}

/** A labelled 0–1 level slider for one mixer layer. */
export function LayerFader({ label, value, onChange }: LayerFaderProps) {
  // useId gives each instance a unique DOM id, so several faders on one page
  // can each point aria-labelledby at their own label.
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <Slider
        min={0}
        max={1}
        step={0.01}
        value={[value]}
        onValueChange={([level]) => onChange(level)}
      />
    </div>
  )
}
