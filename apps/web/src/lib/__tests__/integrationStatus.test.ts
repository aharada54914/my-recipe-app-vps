// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import {
  getCalendarIntegrationStatus,
  getGeminiIntegrationStatus,
  getGoogleIntegrationStatus,
} from '../integrationStatus'

describe('getGoogleIntegrationStatus', () => {
  it('returns QA status with explicit action id', () => {
    const status = getGoogleIntegrationStatus({
      isOAuthAvailable: true,
      userPresent: true,
      providerTokenPresent: true,
      isQaMode: true,
    })

    expect(status.tone).toBe('success')
    expect(status.actionId).toBe('qa-backup')
  })

  it('returns sign-in action when login is required', () => {
    const status = getGoogleIntegrationStatus({
      isOAuthAvailable: true,
      userPresent: false,
      providerTokenPresent: false,
    })

    expect(status.actionId).toBe('sign-in-google')
    expect(status.actionLabel).toBe('Googleでログイン')
  })
})

describe('getGeminiIntegrationStatus', () => {
  it('returns setup action when no key is configured', () => {
    localStorage.clear()

    const status = getGeminiIntegrationStatus(20)

    expect(status.tone).toBe('warning')
    expect(status.actionId).toBe('open-gemini-settings')
  })
})

describe('getCalendarIntegrationStatus', () => {
  it('returns retry action when calendar loading failed', () => {
    const status = getCalendarIntegrationStatus({
      isOAuthAvailable: true,
      userPresent: true,
      providerTokenPresent: true,
      error: '取得に失敗しました',
      calendarCount: 0,
    })

    expect(status.tone).toBe('error')
    expect(status.actionId).toBe('retry-calendar')
  })

  it('returns QA calendar state when mock mode is enabled', () => {
    const status = getCalendarIntegrationStatus({
      isOAuthAvailable: true,
      userPresent: true,
      providerTokenPresent: true,
      isQaMode: true,
      calendarCount: 2,
      selectedCalendarIdPresent: true,
    })

    expect(status.tone).toBe('success')
    expect(status.actionId).toBe('qa-calendar')
  })
})
