/**
 * Normalize Japanese text for search matching.
 * - Unicode NFKC normalization
 * - lower-case latin chars
 * - convert katakana to hiragana
 * - collapse spaces and trim
 */
export function normalizeJaText(input: string): string {
    const nfkc = input.normalize('NFKC').toLowerCase()
    const hira = katakanaToHiragana(nfkc)
    return hira.replace(/[\s\u3000]+/g, ' ').trim()
}

/**
 * Convert Katakana chars in the basic block to Hiragana.
 */
export function katakanaToHiragana(input: string): string {
    return input.replace(/[\u30a1-\u30f6]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0x60),
    )
}
