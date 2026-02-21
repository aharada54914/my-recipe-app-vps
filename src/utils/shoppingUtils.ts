import type { Ingredient, StockItem } from '../db/db'

/**
 * T-18: Get missing ingredients by comparing recipe ingredients against stock
 */
export function getMissingIngredients(
    ingredients: Ingredient[],
    stockItems: StockItem[]
): Ingredient[] {
    const stockNames = new Set(stockItems.filter(s => s.inStock).map(s => s.name))
    return ingredients.filter(ing => !stockNames.has(ing.name))
}

/**
 * T-18: Format missing ingredients as a text list for LINE sharing
 */
export function formatShoppingListForLine(
    recipeTitle: string,
    missing: Ingredient[]
): string {
    if (missing.length === 0) return `📋 ${recipeTitle}\n全ての材料が揃っています！`
    const items = missing
        .map(ing => {
            const qty = typeof ing.quantity === 'number' && ing.quantity > 0 ? ` ${ing.quantity}${ing.unit}` : ''
            return `・${ing.name}${qty}`
        })
        .join('\n')
    return `📋 ${recipeTitle} の買い物リスト\n${items}`
}

/**
 * T-18: Copy text to clipboard (fallback for LINE share)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        return false
    }
}
