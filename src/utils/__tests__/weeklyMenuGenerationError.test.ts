import { describe, expect, it } from 'vitest'
import { getWeeklyMenuGenerationErrorMessage } from '../weeklyMenuGenerationError'

describe('weeklyMenuGenerationError', () => {
  it('hides internal IndexedDB details from the user', () => {
    const message = getWeeklyMenuGenerationErrorMessage(
      new Error("recipeFeatureMatrix.bulkPut(): ConstraintError: Unable to add key to index 'recipeId'"),
    )

    expect(message).toBe('内部データの準備に失敗しました。アプリを再読み込みしてから、もう一度お試しください。')
    expect(message).not.toContain('ConstraintError')
    expect(message).not.toContain('recipeFeatureMatrix')
  })

  it('keeps domain-level messages intact', () => {
    expect(getWeeklyMenuGenerationErrorMessage(new Error('条件に合うレシピが見つかりません'))).toBe(
      '条件に合うレシピが見つかりません',
    )
  })
})
