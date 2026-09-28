import { LabelledSlider } from '@/components/LabelledSlider'
import { EQ_BANDS, EQ_RANGE_DB, type EqBand, type MasterSettings } from '@/lib/settings'

interface MasterSectionProps {
  value: MasterSettings
  onEqChange: (band: EqBand, db: number) => void
  onVolumeChange: (position: number) => void
}

/**
 * Master EQ (Low / Mid / High) and master volume. Knows nothing about which
 * page it sits on, so the Lofi page can reuse it as-is.
 */
export function MasterSection({ value, onEqChange, onVolumeChange }: MasterSectionProps) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">Master</h2>
      {EQ_BANDS.map(({ band, label }) => (
        <LabelledSlider
          key={band}
          label={label}
          // 0 dB sits in the middle of the track and is flat.
          min={-EQ_RANGE_DB}
          max={EQ_RANGE_DB}
          step={0.5}
          readout={formatDb(value.eq[band])}
          value={value.eq[band]}
          onChange={(db) => onEqChange(band, db)}
        />
      ))}
      <LabelledSlider label="Master volume" value={value.volume} onChange={onVolumeChange} />
    </div>
  )
}

function formatDb(db: number): string {
  return `${db > 0 ? '+' : ''}${db} dB`
}
