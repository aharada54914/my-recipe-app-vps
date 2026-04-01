import { prisma } from '../../db/client.js'
import { sortShoppingList } from '../../lib/shoppingSorter.js'
import { registerShoppingListToCalendar } from '../../lib/googleCalendar.js'
import type { Ingredient, ShoppingListItem, SortedShoppingList, WeeklyMenuItem } from '@kitchen/shared-types'

export function parseIngredientsFromMenu(
  items: WeeklyMenuItem[],
  recipes: Array<{ id: number; ingredients: unknown; baseServings: number }>,
): Array<{ name: string; quantity: string }> {
  const ingredientMap = new Map<string, string[]>()

  for (const item of items) {
    const mainRecipe = recipes.find(r => r.id === item.recipeId)
    if (mainRecipe) {
      const ingredients = mainRecipe.ingredients as Ingredient[]
      const ratio = (item.mainServings ?? mainRecipe.baseServings) / mainRecipe.baseServings
      for (const ing of ingredients) {
        const qty = typeof ing.quantity === 'number'
          ? `${Math.round(ing.quantity * ratio * 10) / 10}${ing.unit}`
          : `${ing.quantity}`
        const existing = ingredientMap.get(ing.name) ?? []
        ingredientMap.set(ing.name, [...existing, qty])
      }
    }

    if (item.sideRecipeId) {
      const sideRecipe = recipes.find(r => r.id === item.sideRecipeId)
      if (sideRecipe) {
        const ingredients = sideRecipe.ingredients as Ingredient[]
        const ratio = (item.sideServings ?? sideRecipe.baseServings) / sideRecipe.baseServings
        for (const ing of ingredients) {
          const qty = typeof ing.quantity === 'number'
            ? `${Math.round(ing.quantity * ratio * 10) / 10}${ing.unit}`
            : `${ing.quantity}`
          const existing = ingredientMap.get(ing.name) ?? []
          ingredientMap.set(ing.name, [...existing, qty])
        }
      }
    }
  }

  return Array.from(ingredientMap.entries()).map(([name, quantities]) => ({
    name,
    quantity: quantities.join(' + '),
  }))
}

async function loadMenuData(
  userId: string,
  weekStartDate: string,
): Promise<{
  menu: { id: number; items: unknown; shoppingList: string | null }
  sortedList: SortedShoppingList
}> {
  const menu = await prisma.weeklyMenu.findUnique({
    where: {
      userId_weekStartDate: { userId, weekStartDate },
    },
  })

  if (!menu) {
    throw new Error('Weekly menu not found for the specified week')
  }

  const menuItems = menu.items as WeeklyMenuItem[]
  const recipeIds = [
    ...menuItems.map(i => i.recipeId),
    ...menuItems.filter(i => i.sideRecipeId).map(i => i.sideRecipeId!),
  ]

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: recipeIds } },
    select: { id: true, ingredients: true, baseServings: true },
  })

  const stocks = await prisma.stock.findMany({
    where: { userId, inStock: true },
    select: { name: true },
  })
  const inStockNames = new Set(stocks.map((stock: { name: string }) => stock.name))

  const allIngredients = parseIngredientsFromMenu(menuItems, recipes)
  const neededIngredients = allIngredients.filter(ing => !inStockNames.has(ing.name))

  const sortedList = await sortShoppingList(neededIngredients, weekStartDate)

  return { menu, sortedList }
}

export async function generateShoppingList(params: {
  userId: string
  weekStartDate: string
}): Promise<SortedShoppingList> {
  const { userId, weekStartDate } = params
  const { menu, sortedList } = await loadMenuData(userId, weekStartDate)

  const shoppingListText = sortedList.categories
    .map((group: SortedShoppingList['categories'][number]) =>
      `--- ${group.category} ---\n${group.items.map((item: ShoppingListItem) => `  ${item.name} ${item.quantity}`).join('\n')}`,
    )
    .join('\n\n')

  await prisma.weeklyMenu.update({
    where: { id: menu.id },
    data: { shoppingList: shoppingListText },
  })

  return sortedList
}

export async function registerShoppingListToCalendarForUser(params: {
  userId: string
  weekStartDate: string
  scheduledDate: string
  scheduledTime?: string
}): Promise<{ eventId: string; htmlLink: string }> {
  const { userId, weekStartDate, scheduledDate, scheduledTime } = params
  const { sortedList } = await loadMenuData(userId, weekStartDate)

  return registerShoppingListToCalendar(userId, sortedList, scheduledDate, scheduledTime)
}
