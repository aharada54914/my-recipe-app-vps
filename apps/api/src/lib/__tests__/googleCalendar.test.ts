import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  userFindUniqueMock: vi.fn(),
  userFindManyMock: vi.fn(),
  userUpdateMock: vi.fn(),
  recipeFindManyMock: vi.fn(),
  eventInsertMock: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUniqueMock,
      findMany: mocks.userFindManyMock,
      update: mocks.userUpdateMock,
    },
    recipe: {
      findMany: mocks.recipeFindManyMock,
    },
  },
}))

vi.mock('googleapis', () => {
  class OAuth2 {
    setCredentials() {}
    on() {}
  }

  return {
    google: {
      auth: {
        OAuth2,
      },
      calendar: () => ({
        events: {
          insert: mocks.eventInsertMock,
        },
      }),
    },
  }
})

import { registerWeeklyMenuToFamilyCalendar } from '../googleCalendar.js'

describe('registerWeeklyMenuToFamilyCalendar', () => {
  beforeEach(() => {
    mocks.userFindUniqueMock.mockReset()
    mocks.userFindManyMock.mockReset()
    mocks.userUpdateMock.mockReset()
    mocks.recipeFindManyMock.mockReset()
    mocks.eventInsertMock.mockReset()

    process.env['GOOGLE_CLIENT_ID'] = 'client-id'
    process.env['GOOGLE_CLIENT_SECRET'] = 'client-secret'
    process.env['GOOGLE_REDIRECT_URI'] = 'http://localhost:3000'
  })

  it('registers weekly menu events to the configured family calendar', async () => {
    mocks.userFindUniqueMock.mockResolvedValue({
      googleAccessToken: 'google-access-token',
      googleRefreshToken: 'google-refresh-token',
      preferences: {
        familyCalendarId: 'family@example.com',
        mealStartHour: 18,
        mealStartMinute: 30,
        mealEndHour: 19,
        mealEndMinute: 30,
      },
    })
    mocks.recipeFindManyMock.mockResolvedValue([
      {
        id: 10,
        title: '鶏もも肉のトマト煮込み',
        category: '主菜',
        baseServings: 2,
        totalTimeMinutes: 30,
        ingredients: [{ name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' }],
        sourceUrl: 'https://example.com/r1',
      },
      {
        id: 11,
        title: '青菜のあえ物',
        category: '副菜',
        baseServings: 2,
        totalTimeMinutes: 10,
        ingredients: [{ name: '青菜', quantity: 1, unit: '束', category: 'sub' }],
        sourceUrl: null,
      },
    ])
    mocks.eventInsertMock
      .mockResolvedValueOnce({ data: { id: 'event-1' } })
      .mockResolvedValueOnce({ data: { id: 'event-2' } })

    const result = await registerWeeklyMenuToFamilyCalendar({
      userId: 'google-user-1',
      weekStartDate: '2026-03-23',
      items: [
        {
          recipeId: 10,
          sideRecipeId: 11,
          mainServings: 3,
          sideServings: 3,
          date: '2026-03-23',
          mealType: 'dinner',
          locked: true,
        },
        {
          recipeId: 10,
          date: '2026-03-24',
          mainServings: 4,
          mealType: 'dinner',
          locked: true,
        },
      ],
    })

    expect(result).toEqual({
      calendarId: 'family@example.com',
      registeredCount: 2,
      eventIds: ['event-1', 'event-2'],
      errors: [],
    })
    expect(mocks.eventInsertMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      calendarId: 'family@example.com',
      requestBody: expect.objectContaining({
        summary: '夕食: 鶏もも肉のトマト煮込み + 青菜のあえ物',
        start: expect.objectContaining({
          dateTime: '2026-03-23T18:30:00+09:00',
        }),
      }),
    }))
  })

  it('throws when family calendar is not configured', async () => {
    mocks.userFindUniqueMock.mockResolvedValue({
      googleAccessToken: 'google-access-token',
      googleRefreshToken: null,
      preferences: {},
    })

    await expect(registerWeeklyMenuToFamilyCalendar({
      userId: 'google-user-1',
      weekStartDate: '2026-03-23',
      items: [],
    })).rejects.toThrow(/家族カレンダーが未設定/)
  })

  it('falls back to the sole Google-authenticated user for small Discord-only deployments', async () => {
    mocks.userFindUniqueMock
      .mockResolvedValueOnce({
        id: 'discord:guild:user',
        googleAccessToken: null,
        googleRefreshToken: null,
        preferences: {},
      })
    mocks.userFindManyMock.mockResolvedValue([
      {
        id: 'google-user-1',
        googleAccessToken: 'google-access-token',
        googleRefreshToken: null,
        preferences: {
          familyCalendarId: 'family@example.com',
          mealStartHour: 18,
          mealStartMinute: 0,
          mealEndHour: 19,
          mealEndMinute: 0,
        },
      },
    ])
    mocks.recipeFindManyMock.mockResolvedValue([
      {
        id: 10,
        title: '筑前煮',
        category: '主菜',
        baseServings: 2,
        totalTimeMinutes: 30,
        ingredients: [],
        sourceUrl: null,
      },
    ])
    mocks.eventInsertMock.mockResolvedValue({ data: { id: 'event-1' } })

    const result = await registerWeeklyMenuToFamilyCalendar({
      userId: 'discord:guild:user',
      weekStartDate: '2026-03-23',
      items: [{
        recipeId: 10,
        date: '2026-03-23',
        mainServings: 3,
        mealType: 'dinner',
        locked: true,
      }],
    })

    expect(result.registeredCount).toBe(1)
    expect(mocks.userFindManyMock).toHaveBeenCalledOnce()
    expect(mocks.eventInsertMock).toHaveBeenCalledWith(expect.objectContaining({
      calendarId: 'family@example.com',
    }))
  })
})
