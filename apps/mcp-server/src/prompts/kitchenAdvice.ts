import { z } from 'zod'
import { buildStockResourceUri, buildTodayMenuResourceUri } from '../contract.js'

export const kitchenAdvicePromptArgs = {
  userId: z.string().trim().min(1).describe('対象ユーザーの ID'),
  question: z.string().trim().min(1).describe('料理や在庫活用について AI に相談したい内容'),
} as const

export function buildKitchenAdvicePrompt(args: { userId: string; question: string }) {
  const stockUri = buildStockResourceUri(args.userId)
  const todayMenuUri = buildTodayMenuResourceUri(args.userId)

  return {
    description: '在庫と今日の献立を参照しながら、日本語で実用的な料理アドバイスを返すプロンプトです。',
    messages: [
      {
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: [
            'Context',
            `- Read the current stock from ${stockUri}`,
            `- Read today\'s planned menu from ${todayMenuUri}`,
            '',
            'Task',
            `- Answer this kitchen question in Japanese: ${args.question}`,
            '- Use the resource contents as the primary source of truth.',
            '',
            'Output Format',
            '- A concise Japanese answer with 2-4 actionable suggestions.',
            '- If a recommendation depends on missing information, state the assumption.',
            '',
            'Constraints',
            '- Do not invent ingredients or menu items that are not present in the resources.',
            '- Prefer suggestions that reuse current stock first.',
            '- Keep the answer practical and specific.',
          ].join('\n'),
        },
      },
      {
        role: 'user' as const,
        content: {
          type: 'resource_link' as const,
          uri: stockUri,
          name: 'current-stock',
          title: 'Current Stock',
          description: 'Current in-stock ingredients for this user.',
          mimeType: 'application/json',
        },
      },
      {
        role: 'user' as const,
        content: {
          type: 'resource_link' as const,
          uri: todayMenuUri,
          name: 'today-menu',
          title: 'Today Menu',
          description: 'Today menu entry for this user.',
          mimeType: 'application/json',
        },
      },
    ],
  }
}
