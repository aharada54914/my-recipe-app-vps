import { Minus, Plus } from 'lucide-react'

interface ServingsStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (next: number) => void
  ariaLabel: string
}

export function ServingsStepper({
  value,
  min = 1,
  max = 10,
  onChange,
  ariaLabel,
}: ServingsStepperProps) {
  const canDecrease = value > min
  const canIncrease = value < max

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl bg-white/10 p-1 normal-case"
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        aria-label={`${ariaLabel}を1人減らす`}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-white/10 disabled:opacity-35"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="flex min-h-[44px] min-w-[56px] items-center justify-center px-2 text-sm font-bold text-text-primary">
        {value}人
      </div>

      <button
        type="button"
        onClick={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        aria-label={`${ariaLabel}を1人増やす`}
        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-primary transition-colors hover:bg-white/10 disabled:opacity-35"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
