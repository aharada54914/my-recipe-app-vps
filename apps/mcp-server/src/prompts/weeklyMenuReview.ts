import { z } from 'zod'
import {
  buildShoppingListResourceUri,
  buildWeeklyMenuResourceUri,
} from '../contract.js'
import { getCurrentWeekMonday } from '../lib/date.js'

export const weeklyMenuReviewPromptArgs = {
  userId: z.string().trim().min(1).describe('対象ユーザーの ID'),
  weekStartDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .describe('レビュー対象週の月曜日 (YYYY-MM-DD)。省略時は当週。'),
  focus: z.string().trim().optional()
    .describe('特に見てほしい観点。例: 栄養バランス、在庫消化、時短'),
} as const

export async function buildWeeklyMenuReviewPrompt(args: {
  userId: string
  weekStartDate?: string
  focus?: string
}) {
  const weekStartDate = args.weekStartDate ?? getCurrentWeekMonday()
  const weeklyMenuUri = buildWeeklyMenuResourceUri(args.userId, weekStartDate)
  const shoppingListUri = buildShoppingListResourceUri(args.userId, weekStartDate)

  return {
    description: '週間献立をレビューし、在庫・構成・実用性の観点から改善案を返すプロンプトです。',
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            'Context',
            `- Read the weekly menu from ${weeklyMenuUri}`,
            `- Read the weekly shopping list from ${shoppingListUri}`,
            args.focus ? `- Focus area requested by the user: ${args.focus}` : '- No extra focus area was specified.',
            '',
            'Task',
            '- Review the weekly menu and identify practical improvements in Japanese.',
            '- Consider balance, repetition, workload, and stock usage.',
            '',
            'Output Format',
            '- A short summary of the overall assessment.',
            '- Then 3-5 concrete improvements as bullet points.',
            '',
            'Constraints',
            '- Base the review on the linked resources.',
            '- Do not assume recipes or data that are not present.',
            '- If the menu is missing, explain what is unavailable.',
          ].join('\n'),
        },
      },
      {
        role: 'user' as const,
        content: {
          type: 'resource_link' as const,
          uri: weeklyMenuUri,
          name: 'weekly-menu',
          title: 'Weekly Menu',
          description: 'Weekly menu resource for the selected user and week.',
          mimeType: 'application/json',
        },
      },
      {
        role: 'user' as const,
        content: {
          type: 'resource_link' as const,
          uri: shoppingListUri,
          name: 'shopping-list',
          title: 'Shopping List',
          description: 'Shopping list resource for the selected user and week.',
          mimeType: 'application/json',
        },
      },
    ],
  }
}
