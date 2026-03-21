import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/client.js'
import { sortShoppingList } from '../lib/shoppingSorter.js'
import { registerShoppingListToCalendar } from '../lib/googleCalendar.js'
import { RegisterToCalendarRequestSchema } from '@kitchen/shared-types'
import type { Ingredient, ShoppingListItem, SortedShoppingList, WeeklyMenuItem } from '@kitchen/shared-types'

const GenerateShoppingListSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function parseIngredientsFromMenu(
  items: unknown,
  recipes: Array<{ id: number; ingredients: unknown; baseServings: number }>,
): Array<{ name: string; quantity: string }> {
  const menuItems = items as WeeklyMenuItem[]

  const ingredientMap = new Map<string, string[]>()

  for (const item of menuItems) {
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

export async function registerShoppingRoutes(app: FastifyInstance): Promise<void> {
  // Generate sorted shopping list from weekly menu
  app.post('/api/shopping/generate', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const { weekStartDate } = GenerateShoppingListSchema.parse(request.body)

      const menu = await prisma.weeklyMenu.findUnique({
        where: {
          userId_weekStartDate: { userId, weekStartDate },
        },
      })

      if (!menu) {
        reply.status(404).send({
          success: false,
          error: 'Weekly menu not found for the specified week',
        })
        return
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

      // Get user's stock to exclude items already in stock
      const stocks = await prisma.stock.findMany({
        where: { userId, inStock: true },
        select: { name: true },
      })
      const inStockNames = new Set(stocks.map((stock: { name: string }) => stock.name))

      const allIngredients = parseIngredientsFromMenu(menu.items, recipes)
      const neededIngredients = allIngredients.filter(
        ing => !inStockNames.has(ing.name),
      )

      const sortedList = await sortShoppingList(neededIngredients, weekStartDate)

      // Save shopping list text to weekly menu
      const shoppingListText = sortedList.categories
        .map((group: SortedShoppingList['categories'][number]) =>
          `--- ${group.category} ---\n${group.items.map((item: ShoppingListItem) => `  ${item.name} ${item.quantity}`).join('\n')}`,
        )
        .join('\n\n')

      await prisma.weeklyMenu.update({
        where: { id: menu.id },
        data: { shoppingList: shoppingListText },
      })

      reply.send({ success: true, data: sortedList })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.issues,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Shopping list generation error')
      reply.status(500).send({
        success: false,
        error: `買い物リスト生成に失敗しました: ${message}`,
      })
    }
  })

  // Register shopping list to Google Calendar
  app.post('/api/shopping/register-to-calendar', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const userId = request.user.sub
      const body = RegisterToCalendarRequestSchema.parse(request.body)

      const menu = await prisma.weeklyMenu.findUnique({
        where: {
          userId_weekStartDate: {
            userId,
            weekStartDate: body.weekStartDate,
          },
        },
      })

      if (!menu) {
        reply.status(404).send({
          success: false,
          error: 'Weekly menu not found',
        })
        return
      }

      // Re-generate sorted list for calendar description
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

      const allIngredients = parseIngredientsFromMenu(menu.items, recipes)
      const neededIngredients = allIngredients.filter(
        ing => !inStockNames.has(ing.name),
      )

      const sortedList = await sortShoppingList(neededIngredients, body.weekStartDate)

      const result = await registerShoppingListToCalendar(
        userId,
        sortedList,
        body.scheduledDate,
        body.scheduledTime,
      )

      reply.send({
        success: true,
        data: {
          eventId: result.eventId,
          htmlLink: result.htmlLink,
        },
      })
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.status(400).send({
          success: false,
          error: 'Validation error',
          data: err.issues,
        })
        return
      }
      const message = err instanceof Error ? err.message : String(err)
      app.log.error({ err }, 'Calendar registration error')
      reply.status(500).send({
        success: false,
        error: `カレンダー登録に失敗しました: ${message}`,
      })
    }
  })
}
