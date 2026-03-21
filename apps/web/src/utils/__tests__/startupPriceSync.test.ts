import { describe, expect, it } from 'vitest'
import { shouldSyncMonthly } from '../cost/startupPriceSync'

describe('shouldSyncMonthly', () => {
  it('returns true when no previous sync', () => {
    expect(shouldSyncMonthly(undefined, new Date('2026-03-01T00:00:00Z'))).toBe(true)
  })

  it('returns false within 30 days', () => {
    expect(shouldSyncMonthly(new Date('2026-02-10T00:00:00Z'), new Date('2026-03-01T00:00:00Z'))).toBe(false)
  })

  it('returns true after 30 days', () => {
    expect(shouldSyncMonthly(new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:01Z'))).toBe(true)
  })
})
