import TinySegmenter from 'tiny-segmenter'
import { normalizeJaText } from './jaText'

const segmenter = new TinySegmenter()

/**
 * Lightweight Japanese tokenization for browser-side PoC.
 */
export function tokenizeJa(input: string): string[] {
    const normalized = normalizeJaText(input)
    if (!normalized) return []

    return segmenter
        .segment(normalized)
        .map((token: string) => token.trim())
        .filter((token: string) => token.length >= 2)
}
