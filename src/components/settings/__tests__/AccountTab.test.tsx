// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountTab } from '../AccountTab'

const signInWithGoogle = vi.fn()
const backupNow = vi.fn(async () => {})

vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    isOAuthAvailable: true,
    providerToken: null,
    isQaGoogleMode: false,
    signInWithGoogle,
    signOut: vi.fn(),
  }),
}))

vi.mock('../../../hooks/useGoogleDriveSync', () => ({
  useGoogleDriveSync: () => ({
    isBackingUp: false,
    isRestoring: false,
    lastBackupAt: null,
    backupNow,
    restoreNow: vi.fn(async () => {}),
    error: null,
  }),
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => ({
    stock: 3,
    favorites: 2,
    userNotes: 1,
    viewHistory: 4,
    weeklyMenus: 1,
    calendarEvents: 2,
  }),
}))

let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  signInWithGoogle.mockReset()
  backupNow.mockReset()
})

afterEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  container.remove()
})

describe('AccountTab', () => {
  it('shows the Google login status notice when signed out', () => {
    const root = createRoot(container)

    act(() => {
      root.render(createElement(AccountTab))
    })

    expect(container.textContent).toContain('Googleログインが必要です')
    expect(container.querySelector('[data-testid="account-google-status"]')?.textContent).toContain('Googleでログイン')

    act(() => {
      root.unmount()
    })
  })

  it('invokes sign-in when the status action is pressed', () => {
    const root = createRoot(container)

    act(() => {
      root.render(createElement(AccountTab))
    })

    const action = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Googleでログイン'))
    expect(action).toBeTruthy()

    act(() => {
      action!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(signInWithGoogle).toHaveBeenCalledTimes(1)

    act(() => {
      root.unmount()
    })
  })
})
