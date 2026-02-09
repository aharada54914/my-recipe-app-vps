import { useState } from 'react'
import type { SaltMode } from '../db/db'
import { calculateSalt } from '../utils/recipeUtils'

interface SaltCalculatorProps {
  totalWeightG: number
}

const modes: { mode: SaltMode; label: string }[] = [
  { mode: 0.6, label: '薄味' },
  { mode: 0.8, label: '標準' },
  { mode: 1.2, label: '濃いめ' },
]

export function SaltCalculator({ totalWeightG }: SaltCalculatorProps) {
  const [activeMode, setActiveMode] = useState<SaltMode>(0.8)
  const result = calculateSalt(totalWeightG, activeMode)

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-bold text-text-secondary">塩分計算</h4>
      <div className="mb-4 flex gap-2">
        {modes.map(({ mode, label }) => (
          <button
            key={mode}
            onClick={() => setActiveMode(mode)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              activeMode === mode
                ? 'bg-accent text-white'
                : 'bg-bg-card-hover text-text-secondary hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-2xl font-bold text-accent">{result.saltG}</div>
          <div className="text-xs text-text-secondary">塩 (g)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-accent">{result.soySauceMl}</div>
          <div className="text-xs text-text-secondary">醤油 (ml)</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-accent">{result.misoG}</div>
          <div className="text-xs text-text-secondary">味噌 (g)</div>
        </div>
      </div>
    </div>
  )
}
