import { describe, expect, it } from 'vitest'
import { getStartupNotice, shouldShowBlockingSplash } from '../startupUi'

describe('shouldShowBlockingSplash', () => {
  it('keeps splash visible until minimum splash duration finishes', () => {
    expect(shouldShowBlockingSplash(false, 'ready')).toBe(true)
  })

  it('keeps splash visible while startup is still loading', () => {
    expect(shouldShowBlockingSplash(true, 'loading')).toBe(true)
  })

  it('allows app render once startup degraded after splash duration', () => {
    expect(shouldShowBlockingSplash(true, 'degraded')).toBe(false)
  })
})

describe('getStartupNotice', () => {
  it('returns timeout notice when startup degraded due to slow init', () => {
    expect(getStartupNotice('degraded', true)).toContain('時間がかかっている')
  })

  it('returns failure notice when startup degraded due to init error', () => {
    expect(getStartupNotice('degraded', false)).toContain('失敗')
  })

  it('returns no notice when startup is healthy', () => {
    expect(getStartupNotice('ready', false)).toBeNull()
  })
})
