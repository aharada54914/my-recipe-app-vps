// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearQaGoogleCalendarEvents,
  clearQaGoogleDriveBackup,
  getQaGoogleSummary,
  isQaGoogleModeEnabled,
  setQaGoogleDriveBackup,
  setQaGoogleModeEnabled,
  setQaGoogleModeUrl,
  syncQaGoogleModeFromUrl,
  writeQaGoogleCalendarEvents,
} from '../qaGoogleMode'

describe('qaGoogleMode', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/settings/data')
  })

  it('syncs mode from the URL query parameter', () => {
    window.history.replaceState({}, '', '/settings/data?qa-google=1')

    expect(syncQaGoogleModeFromUrl()).toBe(true)
    expect(isQaGoogleModeEnabled()).toBe(true)
  })

  it('updates the current URL when toggled on and off', () => {
    setQaGoogleModeUrl(true)
    expect(window.location.search).toContain('qa-google=1')

    setQaGoogleModeUrl(false)
    expect(window.location.search).not.toContain('qa-google=1')
  })

  it('summarizes mock backup and calendar event counts', () => {
    setQaGoogleModeEnabled(true)
    setQaGoogleDriveBackup('{"ok":true}')
    writeQaGoogleCalendarEvents(JSON.stringify([{ id: 'a' }, { id: 'b' }]))

    expect(getQaGoogleSummary()).toEqual({
      hasMockBackup: true,
      calendarEventCount: 2,
    })

    clearQaGoogleDriveBackup()
    clearQaGoogleCalendarEvents()

    expect(getQaGoogleSummary()).toEqual({
      hasMockBackup: false,
      calendarEventCount: 0,
    })
  })
})
