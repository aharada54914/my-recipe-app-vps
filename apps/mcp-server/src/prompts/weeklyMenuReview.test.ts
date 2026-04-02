import { describe, expect, it } from 'vitest'
import { buildWeeklyMenuReviewPrompt } from './weeklyMenuReview.js'

describe('buildWeeklyMenuReviewPrompt', () => {
  it('links weekly menu and shopping list resources for the selected week', async () => {
    const prompt = await buildWeeklyMenuReviewPrompt({
      userId: 'user-123',
      weekStartDate: '2026-03-30',
      focus: '在庫消化',
    })

    expect(prompt.messages).toHaveLength(3)
    expect(prompt.messages[1]?.content).toMatchObject({
      type: 'resource_link',
      uri: 'kitchen://menu/weekly/user-123/2026-03-30',
    })
    expect(prompt.messages[2]?.content).toMatchObject({
      type: 'resource_link',
      uri: 'kitchen://shopping-list/user-123/2026-03-30',
    })
    expect(prompt.messages[0]?.content).toMatchObject({
      type: 'text',
    })
    if (prompt.messages[0]?.content.type !== 'text') {
      throw new Error('expected text prompt content')
    }
    expect(prompt.messages[0].content.text).toContain('Read the weekly menu')
    expect(prompt.messages[0].content.text).toContain('Read the weekly shopping list')
    expect(prompt.messages[0].content.text).toContain('在庫消化')
  })
})
