const INTERNAL_DATA_ERROR_PATTERN = /recipeFeatureMatrix|ConstraintError|BulkError|bulkPut|IndexedDB|AbortError|transaction/i

export function getWeeklyMenuGenerationErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : ''

  if (!message) {
    return '内部データの準備に失敗しました。少し待ってから、もう一度お試しください。'
  }

  if (INTERNAL_DATA_ERROR_PATTERN.test(message)) {
    return '内部データの準備に失敗しました。アプリを再読み込みしてから、もう一度お試しください。'
  }

  return message
}
