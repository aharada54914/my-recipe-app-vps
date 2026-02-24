import { describe, expect, it } from 'vitest'
import { toUserFriendlyGeminiError } from '../geminiError'

describe('toUserFriendlyGeminiError', () => {
  it('formats quota exceeded errors with wait time', () => {
    const error = new Error('[GoogleGenerativeAI Error]: [429] You exceeded your current quota. Please retry in 58.678187154s.')

    const message = toUserFriendlyGeminiError(error)

    expect(message).toContain('利用上限に達しました（429）')
    expect(message).toContain('約59秒待って再実行')
    expect(message).toContain('2.0 Flash Lite推奨')
  })

  it('returns generic message when error is empty', () => {
    expect(toUserFriendlyGeminiError(null)).toBe('解析に失敗しました。時間をおいて再試行してください。')
  })
})
