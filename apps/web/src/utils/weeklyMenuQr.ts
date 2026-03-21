/**
 * Weekly Menu QR Encoding / Decoding (Hybrid)
 *
 * 公式レシピ (recipeNumber が存在 → CSV由来) → IDのみ
 * カスタムレシピ (recipeNumber が空 → Web/Gemini由来) → フルデータ埋め込み
 *
 * エンコードした base64url を URL パラメータ ?import-menu=<data> として共有する。
 */

import type { Recipe, WeeklyMenuItem } from '../db/db'

export const WEEKLY_MENU_IMPORT_PARAM = 'import-menu'

// ------ Payload shape ------

interface CustomRecipeData {
    title: string
    device: string
    category: string
    baseServings: number
    totalTimeMinutes: number
    totalWeightG: number
    ingredients: { name: string; quantity: number | string; unit: string; category: string; optional?: boolean }[]
    steps: { name: string; durationMinutes: number; isDeviceStep?: boolean }[]
    rawSteps?: string[]
    sourceUrl?: string
    calories?: string
    saltContent?: string
}

interface QrMenuItemOfficial {
    d: string       // date 'YYYY-MM-DD'
    r: number       // recipeId (main)
    s?: number      // sideRecipeId
}

interface QrMenuItemCustom {
    d: string
    r: null
    rd?: CustomRecipeData   // main recipe full data (when main is custom)
    sd?: CustomRecipeData   // side recipe full data (when side is custom)
    rId?: number            // official main id (when main is official)
    sId?: number            // official side id (when side is official)
}


type QrMenuItem = QrMenuItemOfficial | QrMenuItemCustom

export interface WeeklyMenuQrPayload {
    v: 1
    w: string          // weekStartDate
    i: QrMenuItem[]
}

// ------ Helpers ------

function isCustomRecipe(recipe: Recipe): boolean {
    return !recipe.recipeNumber || recipe.recipeNumber.trim() === ''
}

function toCustomData(recipe: Recipe): CustomRecipeData {
    return {
        title: recipe.title,
        device: recipe.device,
        category: recipe.category,
        baseServings: recipe.baseServings,
        totalTimeMinutes: recipe.totalTimeMinutes,
        totalWeightG: recipe.totalWeightG,
        ingredients: recipe.ingredients.map(i => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            category: i.category,
            optional: i.optional,
        })),
        steps: recipe.steps.map(s => ({
            name: s.name,
            durationMinutes: s.durationMinutes,
            isDeviceStep: s.isDeviceStep,
        })),
        rawSteps: recipe.rawSteps,
        sourceUrl: recipe.sourceUrl,
        calories: recipe.calories,
        saltContent: recipe.saltContent,
    }
}

// ------ Encode ------

export function encodeWeeklyMenuQr(
    weekStartDate: string,
    items: WeeklyMenuItem[],
    recipeMap: Map<number, Recipe>,
): string {
    const qrItems: QrMenuItem[] = items
        .filter(item => recipeMap.has(item.recipeId))
        .map(item => {
            const main = recipeMap.get(item.recipeId)!
            const side = item.sideRecipeId != null ? recipeMap.get(item.sideRecipeId) : undefined

            const mainCustom = isCustomRecipe(main)
            const sideCustom = side ? isCustomRecipe(side) : false

            // Both official → compact form
            if (!mainCustom && (!side || !sideCustom)) {
                const entry: QrMenuItemOfficial = { d: item.date, r: main.id! }
                if (side) entry.s = side.id!
                return entry
            }

            // At least one custom → expanded form
            const entry: QrMenuItemCustom = { d: item.date, r: null }
            if (mainCustom) {
                entry.rd = toCustomData(main)
            } else {
                entry.rId = main.id!
            }
            if (side) {
                if (sideCustom) {
                    entry.sd = toCustomData(side)
                } else {
                    entry.sId = side.id!
                }
            }
            return entry
        })

    const payload: WeeklyMenuQrPayload = { v: 1, w: weekStartDate, i: qrItems }
    const json = JSON.stringify(payload)
    return btoa(encodeURIComponent(json))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// ------ Decode ------

export interface DecodedMenuEntry {
    date: string
    mainRecipeId: number | null
    mainRecipeData: CustomRecipeData | null
    sideRecipeId: number | null
    sideRecipeData: CustomRecipeData | null
}

export interface DecodedWeeklyMenu {
    weekStartDate: string
    entries: DecodedMenuEntry[]
}

export function decodeWeeklyMenuQr(encoded: string): DecodedWeeklyMenu {
    // base64url → base64 → JSON
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(base64))
    const payload = JSON.parse(json) as WeeklyMenuQrPayload

    if (payload.v !== 1) throw new Error('未対応のQRバージョンです')

    const entries: DecodedMenuEntry[] = payload.i.map(item => {
        if (item.r !== null) {
            // Official only
            const off = item as QrMenuItemOfficial
            return {
                date: off.d,
                mainRecipeId: off.r,
                mainRecipeData: null,
                sideRecipeId: off.s ?? null,
                sideRecipeData: null,
            }
        }
        // Mixed / custom
        const mix = item as QrMenuItemCustom
        return {
            date: mix.d,
            mainRecipeId: mix.rId ?? null,
            mainRecipeData: mix.rd ?? null,
            sideRecipeId: mix.sId ?? null,
            sideRecipeData: mix.sd ?? null,
        }
    })

    return { weekStartDate: payload.w, entries }
}

// ------ Build import URL ------

export function buildMenuImportUrl(encoded: string): string {
    const base = window.location.origin + window.location.pathname
    return `${base}?${WEEKLY_MENU_IMPORT_PARAM}=${encoded}`
}
