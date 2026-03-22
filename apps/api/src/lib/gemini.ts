import { GoogleGenerativeAI } from '@google/generative-ai'

let genAI: GoogleGenerativeAI | null = null

function getGenAI(): GoogleGenerativeAI {
  if (genAI) return genAI

  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required')
  }

  genAI = new GoogleGenerativeAI(apiKey)
  return genAI
}

export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

export function extractJsonObjectText(text: string): string {
  const stripped = stripCodeFences(text)
  const match = stripped.match(/\{[\s\S]*\}/)
  return match ? match[0] : stripped
}

export async function generateGeminiText(prompt: string, modelName = 'gemini-2.0-flash-lite'): Promise<string> {
  const ai = getGenAI()
  const model = ai.getGenerativeModel({ model: modelName })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

export interface ConsultationContext {
  todayMenuTitle?: string
  sideMenuTitle?: string
  stockItems?: Array<{ name: string; inStock: boolean }>
  userPrompt?: string
}

export async function askGeminiConsultation(
  message: string,
  context: ConsultationContext,
): Promise<string> {
  const ai = getGenAI()
  const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const systemParts: string[] = [
    'あなたは家庭料理のアドバイザーです。ホットクックやヘルシオを使った料理について相談を受けます。',
    '回答は簡潔に、日本語で、実用的なアドバイスを心がけてください。',
    '食材の代替案や調理のコツも積極的に提案してください。',
  ]

  if (context.todayMenuTitle) {
    systemParts.push(`今日の献立（主菜）: ${context.todayMenuTitle}`)
  }
  if (context.sideMenuTitle) {
    systemParts.push(`今日の献立（副菜）: ${context.sideMenuTitle}`)
  }
  if (context.stockItems && context.stockItems.length > 0) {
    const inStock = context.stockItems
      .filter(item => item.inStock)
      .map(item => item.name)
    if (inStock.length > 0) {
      systemParts.push(`在庫がある食材: ${inStock.join('、')}`)
    }
  }
  if (context.userPrompt) {
    systemParts.push(`ユーザーの食の好み・制限: ${context.userPrompt}`)
  }

  const systemPrompt = systemParts.join('\n')
  const fullPrompt = `${systemPrompt}\n\nユーザーの質問: ${message}`

  const result = await model.generateContent(fullPrompt)
  const response = result.response
  return response.text()
}
