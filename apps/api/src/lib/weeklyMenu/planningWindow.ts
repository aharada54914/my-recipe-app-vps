import type { MenuPlanningMode } from '@kitchen/shared-types'

export interface PlanningWindow {
  planningMode: MenuPlanningMode
  startDate: Date
  endDate: Date
  startDateString: string
  endDateString: string
  dayCount: number
}

function toDateOnly(date: Date): Date {
  const out = new Date(date)
  out.setHours(0, 0, 0, 0)
  return out
}

function addDays(base: Date, days: number): Date {
  const out = new Date(base)
  out.setDate(out.getDate() + days)
  return out
}

function toDateString(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function getPlanningWindow(
  planningMode: MenuPlanningMode,
  referenceDate = new Date(),
): PlanningWindow {
  const startDate = toDateOnly(referenceDate)
  const dayOfWeek = startDate.getDay()
  const daysUntilSunday = planningMode === 'day'
    ? 0
    : (dayOfWeek === 0 ? 0 : 7 - dayOfWeek)
  const endDate = addDays(startDate, daysUntilSunday)

  return {
    planningMode,
    startDate,
    endDate,
    startDateString: toDateString(startDate),
    endDateString: toDateString(endDate),
    dayCount: daysUntilSunday + 1,
  }
}

export function buildPlanningWindowDates(window: PlanningWindow): string[] {
  return Array.from({ length: window.dayCount }, (_, index) =>
    toDateString(addDays(window.startDate, index)),
  )
}

