import { useId } from 'react'
import { Slider } from '@/components/ui/slider'

interface LabelledSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  /** Defaults give a 0–1 fader, the shape every mixer level uses. */
  min?: number
  max?: number
  step?: number
  /** Optional text shown to the right of the label, e.g. "+3 dB". */
  readout?: string
}

/** A slider with a visible label that also names it for screen readers (and tests). */
export function LabelledSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  readout,
}: LabelledSliderProps) {
  // useId gives each instance a unique DOM id, so several sliders on one page
  // can each point aria-labelledby at their own label.
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-3">
      <div className="flex justify-between text-sm">
        <span id={labelId} className="font-medium">
          {label}
        </span>
        {readout && <span className="text-muted-foreground tabular-nums">{readout}</span>}
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
    </div>
  )
}
