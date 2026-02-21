import { useState, useCallback, useMemo, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Recipe, type WeeklyMenu } from '../db/db'
import { usePreferences } from './usePreferences'
import { getNotificationPermission, showLocalNotification } from '../utils/notifications'
import { selectWeeklyMenu, getWeekStartDate } from '../utils/weeklyMenuSelector'
import { createWeeklyMenuShareCode, parseWeeklyMenuShareCode } from '../utils/weeklyMenuShare'

export function useWeeklyMenu() {
    const { preferences } = usePreferences()
    const [weekStart, setWeekStart] = useState(() => getWeekStartDate(new Date()))
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')

    const existingMenu = useLiveQuery(
        () => db.weeklyMenus.where('weekStartDate').equals(weekStartStr).first(),
        [weekStartStr]
    )

    const [menu, setMenu] = useState<WeeklyMenu | null>(null)
    const [recipes, setRecipes] = useState<Map<number, Recipe>>(new Map())
    const [generating, setGenerating] = useState(false)

    const loadRecipes = useCallback(async (recipeIds: number[]) => {
        const loaded = await db.recipes.bulkGet(recipeIds)
        const map = new Map<number, Recipe>()
        for (const r of loaded) {
            if (r?.id != null) map.set(r.id, r)
        }
        setRecipes(map)
    }, [])

    useEffect(() => {
        if (existingMenu) {
            setMenu(existingMenu)
            const ids: number[] = []
            for (const item of existingMenu.items) {
                ids.push(item.recipeId)
                if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
            }
            loadRecipes(ids)
        }
    }, [existingMenu, loadRecipes])

    const handleGenerate = useCallback(async () => {
        setGenerating(true)
        try {
            const items = await selectWeeklyMenu(weekStart, preferences, menu?.items)

            const newMenu: WeeklyMenu = {
                id: menu?.id,
                weekStartDate: weekStartStr,
                items,
                status: 'draft',
                createdAt: menu?.createdAt ?? new Date(),
                updatedAt: new Date(),
            }

            if (menu?.id != null) {
                await db.weeklyMenus.update(menu.id, {
                    items,
                    status: 'draft',
                    updatedAt: new Date(),
                })
            } else {
                const id = await db.weeklyMenus.add(newMenu)
                newMenu.id = id
            }

            setMenu(newMenu)
            const ids: number[] = []
            for (const item of items) {
                ids.push(item.recipeId)
                if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
            }
            await loadRecipes(ids)

            if (preferences.notifyWeeklyMenuDone && getNotificationPermission() === 'granted') {
                await showLocalNotification({
                    title: '週間献立を作成しました',
                    body: `${format(weekStart, 'M/d')}開始の献立を更新しました。`,
                    tag: `weekly_menu_${weekStartStr}`,
                })
            }
        } finally {
            setGenerating(false)
        }
    }, [weekStart, weekStartStr, preferences, menu, loadRecipes])

    const handleToggleLock = useCallback((dayIndex: number) => {
        if (!menu) return
        const newItems = [...menu.items]
        newItems[dayIndex] = { ...newItems[dayIndex], locked: !newItems[dayIndex].locked }
        const updated = { ...menu, items: newItems, updatedAt: new Date() }
        setMenu(updated)
        if (menu.id != null) {
            db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
        }
    }, [menu])

    const handleUpdateItem = useCallback((dayIndex: number, newRecipeId: number, type: 'main' | 'side') => {
        if (!menu) return
        const newItems = [...menu.items]
        if (type === 'main') {
            newItems[dayIndex] = { ...newItems[dayIndex], recipeId: newRecipeId }
        } else {
            newItems[dayIndex] = { ...newItems[dayIndex], sideRecipeId: newRecipeId }
        }
        const updated = { ...menu, items: newItems, updatedAt: new Date() }
        setMenu(updated)
        if (menu.id != null) {
            db.weeklyMenus.update(menu.id, { items: newItems, updatedAt: new Date() })
        }
    }, [menu])

    const adjustWeek = useCallback((delta: number) => {
        setWeekStart(prev => addDays(prev, delta * 7))
        setMenu(null)
    }, [])

    const applySharedMenu = useCallback(async (code: string) => {
        const shared = parseWeeklyMenuShareCode(code)
        const existing = await db.weeklyMenus.where('weekStartDate').equals(shared.weekStartDate).first()

        const nextMenu: WeeklyMenu = {
            id: existing?.id,
            weekStartDate: shared.weekStartDate,
            items: shared.items,
            status: 'draft',
            createdAt: existing?.createdAt ?? new Date(),
            updatedAt: new Date(),
        }

        if (existing?.id != null) {
            await db.weeklyMenus.update(existing.id, {
                items: shared.items,
                status: 'draft',
                updatedAt: new Date(),
            })
        } else {
            const id = await db.weeklyMenus.add(nextMenu)
            nextMenu.id = id
        }

        const importedWeek = new Date(`${shared.weekStartDate}T00:00:00`)
        setWeekStart(importedWeek)
        setMenu(nextMenu)
        const ids: number[] = []
        for (const item of shared.items) {
            ids.push(item.recipeId)
            if (item.sideRecipeId != null) ids.push(item.sideRecipeId)
        }
        await loadRecipes(ids)
    }, [loadRecipes])

    const selectedRecipes = useMemo(() => {
        if (!menu) return [] as Recipe[]
        return menu.items.flatMap((item) => {
            const out: Recipe[] = []
            const main = recipes.get(item.recipeId)
            if (main) out.push(main)
            if (item.sideRecipeId != null) {
                const side = recipes.get(item.sideRecipeId)
                if (side) out.push(side)
            }
            return out
        })
    }, [menu, recipes])

    const shareCode = useMemo(() => {
        if (!menu) return ''
        return createWeeklyMenuShareCode(weekStartStr, menu.items)
    }, [menu, weekStartStr])

    return {
        weekStart,
        weekStartStr,
        menu,
        recipes,
        generating,
        selectedRecipes,
        shareCode,
        handleGenerate,
        handleToggleLock,
        handleUpdateItem,
        adjustWeek,
        applySharedMenu,
        setRecipes,
    }
}
