import fs from 'node:fs/promises'
import path from 'node:path'
import type { WeeklyMenuSelectionLog } from '../src/db/db'

interface TunableWeights {
  balanceMultiplier: number
  weatherMultiplier: number
  costMultiplier: number
  luxuryMultiplier: number
}

const SEARCH_GRID = [0.5, 0.75, 1, 1.25, 1.5]

function recomputeScore(
  candidate: NonNullable<WeeklyMenuSelectionLog['dailyCandidates']>[number]['candidates'][number],
  weights: TunableWeights,
): number {
  return candidate.baseScore +
    candidate.balanceAdjustment * weights.balanceMultiplier +
    candidate.weatherAdjustment * weights.weatherMultiplier +
    candidate.costAdjustment * weights.costMultiplier +
    candidate.luxuryAdjustment * weights.luxuryMultiplier
}

function evaluateWeights(logs: WeeklyMenuSelectionLog[], weights: TunableWeights) {
  let totalDays = 0
  let correctTop1 = 0
  let marginSum = 0

  for (const log of logs) {
    if (log.eventType !== 'generation' || !log.dailyCandidates) continue
    for (const day of log.dailyCandidates) {
      if (day.candidates.length === 0) continue
      totalDays += 1
      const rescored = day.candidates
        .map((candidate) => ({ ...candidate, tunedScore: recomputeScore(candidate, weights) }))
        .sort((a, b) => b.tunedScore - a.tunedScore)

      if (rescored[0]?.recipeId === day.selectedRecipeId) correctTop1 += 1
      const selected = rescored.find((candidate) => candidate.recipeId === day.selectedRecipeId)
      const runnerUp = rescored.find((candidate) => candidate.recipeId !== day.selectedRecipeId)
      if (selected) {
        marginSum += selected.tunedScore - (runnerUp?.tunedScore ?? 0)
      }
    }
  }

  return {
    totalDays,
    top1Accuracy: totalDays > 0 ? correctTop1 / totalDays : 0,
    averageMargin: totalDays > 0 ? marginSum / totalDays : 0,
  }
}

function findBestWeights(logs: WeeklyMenuSelectionLog[]) {
  let bestWeights: TunableWeights = {
    balanceMultiplier: 1,
    weatherMultiplier: 1,
    costMultiplier: 1,
    luxuryMultiplier: 1,
  }
  let bestEval = evaluateWeights(logs, bestWeights)

  for (const balanceMultiplier of SEARCH_GRID) {
    for (const weatherMultiplier of SEARCH_GRID) {
      for (const costMultiplier of SEARCH_GRID) {
        for (const luxuryMultiplier of SEARCH_GRID) {
          const weights = { balanceMultiplier, weatherMultiplier, costMultiplier, luxuryMultiplier }
          const evaluation = evaluateWeights(logs, weights)
          if (
            evaluation.top1Accuracy > bestEval.top1Accuracy ||
            (evaluation.top1Accuracy === bestEval.top1Accuracy && evaluation.averageMargin > bestEval.averageMargin)
          ) {
            bestWeights = weights
            bestEval = evaluation
          }
        }
      }
    }
  }

  return { bestWeights, bestEval }
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    console.error('Usage: tsx scripts/tune-weekly-menu-weights.ts <selection-logs.json>')
    process.exit(1)
  }

  const absolutePath = path.resolve(process.cwd(), inputPath)
  const raw = await fs.readFile(absolutePath, 'utf8')
  const logs = JSON.parse(raw) as WeeklyMenuSelectionLog[]

  const baseline = evaluateWeights(logs, {
    balanceMultiplier: 1,
    weatherMultiplier: 1,
    costMultiplier: 1,
    luxuryMultiplier: 1,
  })
  const tuned = findBestWeights(logs)

  console.log(JSON.stringify({
    inputPath: absolutePath,
    generationLogs: logs.filter((log) => log.eventType === 'generation').length,
    baseline,
    tuned,
  }, null, 2))
}

void main()
