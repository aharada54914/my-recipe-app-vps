// @vitest-environment jsdom

import { act } from 'react'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CalendarRegistrationModal } from '../CalendarRegistrationModal'

const signInWithGoogle = vi.fn()

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    providerToken: null,
    googleConnection: null,
    isQaGoogleMode: false,
    signInWithGoogle,
  }),
}))

vi.mock('../../hooks/usePreferences', () => ({
  usePreferences: () => ({
    preferences: {
      defaultCalendarId: undefined,
      mealStartHour: 19,
      mealStartMinute: 0,
      mealEndHour: 20,
      mealEndMinute: 0,
    },
  }),
}))

let container: HTMLDivElement

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  signInWithGoogle.mockReset()
})

afterEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  container.remove()
  document.body.innerHTML = ''
})

describe('CalendarRegistrationModal', () => {
  it('shows login guidance when no Google token is available', () => {
    const root = createRoot(container)

    act(() => {
      root.render(createElement(CalendarRegistrationModal, {
        recipe: {
          id: 1,
          title: 'テストレシピ',
          recipeNumber: 'T-1',
          device: 'hotcook',
          category: '主菜',
          baseServings: 2,
          totalWeightG: 400,
          ingredients: [],
          steps: [],
          totalTimeMinutes: 20,
        },
        stockItems: [],
        onClose: vi.fn(),
      }))
    })

    expect(document.body.textContent).toContain('Googleでログイン')
    expect(document.body.textContent).toContain('カレンダー連携には Google ログインが必要です')

    const loginButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Googleでログイン'))
    expect(loginButton).toBeTruthy()

    act(() => {
      loginButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(signInWithGoogle).toHaveBeenCalledTimes(1)

    act(() => {
      root.unmount()
    })
  })
})
