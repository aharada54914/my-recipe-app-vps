export interface WeeklyMenuComponentWeights {
  baseMultiplier: number
  balanceMultiplier: number
  weatherMultiplier: number
  savingCostPenaltyPerYen: number
  luxuryExperienceMultiplier: number
  luxurySelectionMultiplier: number
}

export const WEEKLY_MENU_WEIGHT_PROFILE_VERSION = 'default-v1'
export const WEEKLY_MENU_SELECTOR_STRATEGY = 'beam-v1'

export const DEFAULT_WEEKLY_MENU_COMPONENT_WEIGHTS: WeeklyMenuComponentWeights = {
  baseMultiplier: 1,
  balanceMultiplier: 1,
  weatherMultiplier: 10,
  savingCostPenaltyPerYen: 1 / 80,
  luxuryExperienceMultiplier: 8,
  luxurySelectionMultiplier: 1,
}
