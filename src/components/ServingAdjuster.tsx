import { Minus, Plus } from 'lucide-react'

interface ServingAdjusterProps {
  servings: number
  onChange: (servings: number) => void
}

export function ServingAdjuster({ servings, onChange }: ServingAdjusterProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(1, servings - 1))}
        disabled={servings <= 1}
        className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover disabled:opacity-30"
      >
        <Minus className="h-5 w-5" />
      </button>
      <span className="min-w-[4rem] text-center text-lg font-bold">
        {servings}人分
      </span>
      <button
        onClick={() => onChange(Math.min(10, servings + 1))}
        disabled={servings >= 10}
        className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover disabled:opacity-30"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  )
}
