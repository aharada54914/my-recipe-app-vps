import { describe, expect, it } from 'vitest'
import { buildKitchenAdvicePrompt } from './kitchenAdvice.js'

describe('buildKitchenAdvicePrompt', () => {
  it('returns linked resources plus a structured text instruction', () => {
    const prompt = buildKitchenAdvicePrompt({
      userId: 'user-123',
      question: '今夜なにを作るべき？',
    })

    expect(prompt.messages).toHaveLength(3)
    expect(prompt.messages[1]?.content).toMatchObject({
      type: 'resource_link',
      uri: 'kitchen://stock/user-123',
    })
    expect(prompt.messages[2]?.content).toMatchObject({
      type: 'resource_link',
      uri: 'kitchen://menu/today/user-123',
    })
    expect(prompt.messages[0]?.content).toMatchObject({
      type: 'text',
    })
    if (prompt.messages[0]?.content.type !== 'text') {
      throw new Error('expected text prompt content')
    }
    expect(prompt.messages[0].content.text).toContain('Context')
    expect(prompt.messages[0].content.text).toContain('Task')
    expect(prompt.messages[0].content.text).toContain('Output Format')
    expect(prompt.messages[0].content.text).toContain('Constraints')
  })
})
