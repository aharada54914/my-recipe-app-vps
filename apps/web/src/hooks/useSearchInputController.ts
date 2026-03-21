import { useCallback, useEffect, useRef, useState } from 'react'
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
  const lastCommittedValueRef = useRef(value)

  useEffect(() => {
    // Ignore stale debounced snapshots captured before IME composition finished.
    if (isComposing || debouncedDraft !== draftValue || debouncedDraft === lastCommittedValueRef.current) return
    lastCommittedValueRef.current = debouncedDraft
    onCommit(debouncedDraft)
  }, [debouncedDraft, draftValue, isComposing, onCommit])

  useEffect(() => {
    if (isComposing || value === lastCommittedValueRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the local draft in sync when the parent value changes outside active composition.
    setDraftValue(value)
  }, [isComposing, value])

  const commitDraft = useCallback((nextValue = draftValue) => {
    setDraftValue(nextValue)
    if (nextValue === lastCommittedValueRef.current) return
    lastCommittedValueRef.current = nextValue
    onCommit(nextValue)
  }, [draftValue, onCommit])

  const handleDraftChange = useCallback((nextValue: string, composing = false) => {
    if (composing) setIsComposing(true)
    setDraftValue(nextValue)
  }, [])

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true)
  }, [])

  const handleCompositionEnd = useCallback((nextValue: string) => {
    setIsComposing(false)
    commitDraft(nextValue)
  }, [commitDraft])

  return {
    draftValue,
    isComposing,
    setDraftValue: handleDraftChange,
    commitDraft,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
