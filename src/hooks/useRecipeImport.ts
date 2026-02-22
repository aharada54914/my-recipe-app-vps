import { useState } from 'react'
import type { Recipe, ParseStatus } from '../db/db'
import { db } from '../db/db'
import { parseRecipeText, parseRecipeFromUrl } from '../utils/geminiParser'

export interface UseRecipeImportOptions {
    /** Called when a duplicate title is detected. Should resolve to true to confirm overwrite, false to cancel.
     *  Defaults to window.confirm when not provided (preserves existing behaviour). */
    onDuplicateFound?: (title: string) => Promise<boolean>
}

export function useRecipeImport(options?: UseRecipeImportOptions) {
    const [inputText, setInputText] = useState('')
    const [inputUrl, setInputUrl] = useState('')
    const [status, setStatus] = useState<ParseStatus>('idle')
    const [parsed, setParsed] = useState<Omit<Recipe, 'id'> | null>(null)
    const [error, setError] = useState<string | null>(null)

    const canParse = !!(inputText.trim() || inputUrl.trim())

    const handleParse = async () => {
        setStatus('parsing')
        setError(null)
        try {
            const result = inputUrl.trim()
                ? await parseRecipeFromUrl(inputUrl.trim())
                : await parseRecipeText(inputText)
            setParsed(result)
            setStatus('previewing')
        } catch (e) {
            setError(e instanceof Error ? e.message : '解析に失敗しました')
            setStatus('error')
        }
    }

    const handleSave = async (onSuccess?: () => void) => {
        if (!parsed) return

        const existing = await db.recipes.where('title').equals(parsed.title).first()
        if (existing) {
            // M2: Delegate confirmation to caller when possible (enables testability)
            const confirmed = options?.onDuplicateFound
                ? await options.onDuplicateFound(parsed.title)
                : window.confirm(`「${parsed.title}」は既に登録されています。重複して保存しますか？`)
            if (!confirmed) return
        }

        setStatus('saving')
        await db.recipes.add(parsed as Recipe)
        if (onSuccess) onSuccess()
    }

    const handleReset = () => {
        setParsed(null)
        setError(null)
        setStatus('idle')
    }

    return {
        inputText,
        setInputText,
        inputUrl,
        setInputUrl,
        status,
        parsed,
        error,
        canParse,
        handleParse,
        handleSave,
        handleReset,
    }
}
