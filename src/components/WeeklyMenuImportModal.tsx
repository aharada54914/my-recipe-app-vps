/**
 * WeeklyMenuImportModal
 *
 * URLパラメータ ?import-menu=<base64> を検知して表示されるモーダル。
 * 週間献立の内容をプレビューし、「取り込む」または「キャンセル」を選べる。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, CalendarCheck, AlertCircle, Loader2 } from 'lucide-react'
import { format, parse } from 'date-fns'
import { ja } from 'date-fns/locale'
import { db } from '../db/db'
import type { Recipe, WeeklyMenu, WeeklyMenuItem } from '../db/db'
import { decodeWeeklyMenuQr, type DecodedWeeklyMenu, type DecodedMenuEntry } from '../utils/weeklyMenuQr'

interface Props {
    encoded: string
    onClose: () => void
    onImported: (weekStartDate: string) => void
}

async function saveCustomRecipe(data: DecodedMenuEntry['mainRecipeData']): Promise<number> {
    if (!data) throw new Error('No recipe data')
    const id = await db.recipes.add({
        title: data.title,
        device: data.device as 'hotcook' | 'healsio' | 'manual',
        category: data.category as Recipe['category'],
        baseServings: data.baseServings,
        totalTimeMinutes: data.totalTimeMinutes,
        totalWeightG: data.totalWeightG,
        ingredients: data.ingredients.map(i => ({
            ...i,
            category: i.category as import('../db/db').IngredientCategory,
        })),
        steps: data.steps,
        rawSteps: data.rawSteps,
        sourceUrl: data.sourceUrl,
        calories: data.calories,
        saltContent: data.saltContent,
        recipeNumber: '',
        updatedAt: new Date(),
        isUserAdded: true,
    })
    return id
}

export function WeeklyMenuImportModal({ encoded, onClose, onImported }: Props) {
    const [decoded, setDecoded] = useState<DecodedWeeklyMenu | null>(null)
    const [error, setError] = useState('')
    const [importing, setImporting] = useState(false)
    const [previewRecipes, setPreviewRecipes] = useState<Map<number, string>>(new Map())

    // デコード
    useEffect(() => {
        try {
            const result = decodeWeeklyMenuQr(encoded)
            setDecoded(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'QRデータの読み取りに失敗しました')
        }
    }, [encoded])

    // 公式レシピ名を解決してプレビュー表示用マップ作成
    useEffect(() => {
        if (!decoded) return
        const officialIds = new Set<number>()
        for (const e of decoded.entries) {
            if (e.mainRecipeId != null) officialIds.add(e.mainRecipeId)
            if (e.sideRecipeId != null) officialIds.add(e.sideRecipeId)
        }
        if (officialIds.size === 0) return

        db.recipes.bulkGet(Array.from(officialIds)).then(recipes => {
            const map = new Map<number, string>()
            for (const r of recipes) {
                if (r?.id != null) map.set(r.id, r.title)
            }
            setPreviewRecipes(map)
        })
    }, [decoded])

    const getRecipeName = useCallback((entry: DecodedMenuEntry, type: 'main' | 'side') => {
        const id = type === 'main' ? entry.mainRecipeId : entry.sideRecipeId
        const data = type === 'main' ? entry.mainRecipeData : entry.sideRecipeData
        if (data) return `${data.title}（カスタム）`
        if (id != null) return previewRecipes.get(id) ?? `レシピ#${id}`
        return null
    }, [previewRecipes])

    const weekLabel = useMemo(() => {
        if (!decoded) return ''
        try {
            const d = parse(decoded.weekStartDate, 'yyyy-MM-dd', new Date())
            return format(d, 'M/d', { locale: ja })
        } catch {
            return decoded.weekStartDate
        }
    }, [decoded])

    const handleImport = useCallback(async () => {
        if (!decoded) return
        setImporting(true)
        try {
            const items: WeeklyMenuItem[] = []

            for (const entry of decoded.entries) {
                let mainRecipeId = entry.mainRecipeId
                let sideRecipeId = entry.sideRecipeId

                // カスタムレシピを保存
                if (entry.mainRecipeData) {
                    mainRecipeId = await saveCustomRecipe(entry.mainRecipeData)
                }
                if (entry.sideRecipeData) {
                    sideRecipeId = await saveCustomRecipe(entry.sideRecipeData)
                }

                if (mainRecipeId == null) continue

                items.push({
                    date: entry.date,
                    recipeId: mainRecipeId,
                    sideRecipeId: sideRecipeId ?? undefined,
                    mealType: 'dinner',
                    locked: false,
                })
            }

            const weekStartDate = decoded.weekStartDate
            const existing = await db.weeklyMenus.where('weekStartDate').equals(weekStartDate).first()

            const nextMenu: WeeklyMenu = {
                id: existing?.id,
                weekStartDate,
                items,
                status: 'draft',
                createdAt: existing?.createdAt ?? new Date(),
                updatedAt: new Date(),
            }

            if (existing?.id != null) {
                await db.weeklyMenus.update(existing.id, { items, status: 'draft', updatedAt: new Date() })
            } else {
                const id = await db.weeklyMenus.add(nextMenu)
                nextMenu.id = id
            }

            onImported(weekStartDate)
        } catch (err) {
            setError(err instanceof Error ? err.message : '取り込みに失敗しました')
        } finally {
            setImporting(false)
        }
    }, [decoded, onImported])

    return (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
            <div className="mx-auto mt-16 w-full max-w-sm rounded-2xl bg-bg-card p-5 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="h-5 w-5 text-accent" />
                        <h3 className="text-base font-bold">週間献立を受け取る</h3>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {error ? (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                ) : !decoded ? (
                    <div className="flex h-32 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    </div>
                ) : (
                    <>
                        <p className="mb-3 text-sm text-text-secondary">
                            <span className="font-bold text-accent">{weekLabel}</span>〜の週間献立をアプリに取り込みます。
                        </p>

                        <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-white/5 p-3">
                            {decoded.entries.map(entry => {
                                const mainName = getRecipeName(entry, 'main')
                                const sideName = getRecipeName(entry, 'side')
                                const d = parse(entry.date, 'yyyy-MM-dd', new Date())
                                return (
                                    <div key={entry.date} className="text-xs">
                                        <span className="font-semibold text-text-primary">
                                            {format(d, 'M/d (E)', { locale: ja })}
                                        </span>
                                        <span className="ml-2 text-text-secondary">
                                            {mainName ?? '（不明）'}{sideName ? ` / ${sideName}` : ''}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>

                        <p className="mb-4 text-[11px] text-text-secondary">
                            ※ 現在のこの週の献立は上書きされます。
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={onClose}
                                className="rounded-xl bg-white/5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/10"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={importing}
                                className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                            >
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                                取り込む
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
