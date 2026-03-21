import cron from 'node-cron'
import { prisma } from '../db/client.js'
import { sendWeeklyMenuEmail } from '../lib/mailer.js'
import type { WeeklyMenuEmailData } from '../lib/mailer.js'
import { format, startOfWeek } from 'date-fns'
import { ja } from 'date-fns/locale'

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'] as const

async function sendWeeklyEmails(): Promise<void> {
  console.info('[WeeklyEmailJob] Starting weekly email dispatch...')

  try {
    // Get current week's start date (Sunday)
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
    const weekStartDate = format(weekStart, 'yyyy-MM-dd')

    // Find all users with confirmed weekly menus for this week
    const menus = await prisma.weeklyMenu.findMany({
      where: {
        weekStartDate,
        status: { in: ['confirmed', 'registered'] },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, preferences: true },
        },
      },
    })

    if (menus.length === 0) {
      console.info('[WeeklyEmailJob] No confirmed menus found for this week. Skipping.')
      return
    }

    let successCount = 0
    let failCount = 0

    for (const menu of menus) {
      try {
        // Check if user has notifications enabled
        const preferences = menu.user.preferences as Record<string, unknown> | null
        const notifyEnabled = preferences?.['notifyWeeklyMenuDone'] !== false

        if (!notifyEnabled) {
          console.info(`[WeeklyEmailJob] Skipping user ${menu.user.email} (notifications disabled)`)
          continue
        }

        const menuItems = menu.items as Array<{
          recipeId: number
          sideRecipeId?: number
          date: string
        }>

        // Fetch recipe titles
        const recipeIds = [
          ...menuItems.map(i => i.recipeId),
          ...menuItems.filter(i => i.sideRecipeId).map(i => i.sideRecipeId!),
        ]
        const recipes = await prisma.recipe.findMany({
          where: { id: { in: recipeIds } },
          select: { id: true, title: true },
        })
        const recipeMap = new Map<number, string>(
          recipes.map((recipe: { id: number; title: string }) => [recipe.id, recipe.title]),
        )

        const items: WeeklyMenuEmailData['items'] = menuItems.map((item) => {
          const date = new Date(item.date)
          const dayIndex = date.getDay()
          return {
            date: format(date, 'M/d'),
            dayOfWeek: DAY_NAMES[dayIndex] ?? '',
            mainTitle: recipeMap.get(item.recipeId) ?? '(不明)',
            sideTitle: item.sideRecipeId
              ? recipeMap.get(item.sideRecipeId)
              : undefined,
          }
        })

        // Sort by date
        const sortedItems = [...items].sort((a, b) => a.date.localeCompare(b.date))

        const emailData: WeeklyMenuEmailData = {
          userName: menu.user.name ?? menu.user.email,
          weekStartDate: format(weekStart, 'M月d日', { locale: ja }),
          items: sortedItems,
          shoppingList: menu.shoppingList ?? undefined,
        }

        await sendWeeklyMenuEmail(menu.user.email, emailData)
        successCount++
        console.info(`[WeeklyEmailJob] Sent email to ${menu.user.email}`)
      } catch (err) {
        failCount++
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[WeeklyEmailJob] Failed to send email to ${menu.user.email}: ${message}`)
      }
    }

    console.info(`[WeeklyEmailJob] Completed: ${successCount} sent, ${failCount} failed`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[WeeklyEmailJob] Fatal error: ${message}`)
  }
}

export function startWeeklyEmailJob(): void {
  // Every Monday at 8:00 AM JST
  // cron uses server timezone; for JST set TZ=Asia/Tokyo in environment
  const schedule = process.env['WEEKLY_EMAIL_CRON'] ?? '0 8 * * 1'

  cron.schedule(schedule, () => {
    sendWeeklyEmails()
  })

  console.info(`[WeeklyEmailJob] Scheduled: "${schedule}"`)
}

// Export for CLI manual trigger
export { sendWeeklyEmails }
