import { useCallback, useEffect, useState } from 'react'
import { useDebounce } from './useDebounce'

interface SearchInputControllerOptions {
  value: string
  onCommit: (value: string) => void
  delay?: number
}

export function useSearchInputController({
  value,
  onCommit,
  delay = 150,
}: SearchInputControllerOptions) {
  const [draftValue, setDraftValue] = useState(value)
  const [isComposing, setIsComposing] = useState(false)
  const debouncedDraft = useDebounce(draftValue, delay)

  useEffect(() => {
    setDraftValue(value)
  }, [value])

  useEffect(() => {
    if (isComposing || debouncedDraft === value) return
    onCommit(debouncedDraft)
  }, [debouncedDraft, isComposing, onCommit, value])

  const commitDraft = useCallback((nextValue = draftValue) => {
    setDraftValue(nextValue)
    onCommit(nextValue)
  }, [draftValue, onCommit])

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  const handleCompositionEnd = useCallback((nextValue: string) => {
    setIsComposing(false)
    commitDraft(nextValue)
  }, [commitDraft])

  return {
    draftValue,
    setDraftValue,
    isComposing,
    commitDraft,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
