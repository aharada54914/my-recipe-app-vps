import { getCurrentWeekMonday } from '../lib/date.js'

export function readCurrentWeekResource(): string {
  return JSON.stringify({ currentWeekMonday: getCurrentWeekMonday() }, null, 2)
}
