# Gemini API活用機能の実装ガイド

この文書は初期導入時の実装メモです。  
現在の実装はすでに本ガイドの範囲を超えており、ここは履歴資料として扱ってください。

現行の正:
- [docs/FEATURES.md](/Users/jrmag/my-recipe-app/docs/FEATURES.md)
- [docs/ARCHITECTURE.md](/Users/jrmag/my-recipe-app/docs/ARCHITECTURE.md)
- [docs/SETUP.md](/Users/jrmag/my-recipe-app/docs/SETUP.md)
- [docs/TESTING.md](/Users/jrmag/my-recipe-app/docs/TESTING.md)

## 📚 関連ドキュメント

- **docs/plans/RECIPE_FEATURES_PLAN.md**: 不足機能の詳細分析レポート
- **このファイル**: すぐに実装を始められるクイックスタートガイド

---

## 🎯 実装する機能

### 1. レシピ提案機能（最優先）
AIが在庫や条件からレシピを能動的に提案する機能

### 2. URL取得の改善
レシピサイトから構造化データを取得し、画像も保存する機能

---

## 🚀 実装順序

```
Phase 1: レシピ提案機能
├── ① geminiRecommender.ts 作成
├── ② RecipeRecommender.tsx 作成  
├── ③ App.tsx にルート追加
└── ④ Header.tsx にボタン追加

Phase 2: URL取得の改善
├── ① recipeExtractor.ts 作成
├── ② geminiParser.ts 改善
└── ③ AiRecipeParser.tsx 改善
```

---

## 📝 Phase 1: レシピ提案機能の実装

### ステップ1: geminiRecommender.ts の作成

**ファイル**: `src/utils/geminiRecommender.ts`

<details>
<summary>完全なコードを表示</summary>

\`\`\`typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Recipe, RecipeCategory } from '../db/db'

function getApiKey(): string {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string
  if (envKey) return envKey
  
  const storedKey = localStorage.getItem('gemini_api_key')
  if (storedKey) return storedKey
  
  throw new Error('APIキーが設定されていません')
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
}

function generateRecipeNumber(index: number): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return \`AI-REC-\${now.getFullYear()}\${pad(now.getMonth() + 1)}\${pad(now.getDate())}-\${pad(now.getHours())}\${pad(now.getMinutes())}-\${index}\`
}

export interface RecommendationParams {
  stockItems?: string[]
  maxCalories?: number
  maxTimeMinutes?: number
  category?: RecipeCategory
  servings?: number
  count?: number
}

function buildRecommendationPrompt(params: RecommendationParams): string {
  const count = params.count || 3
  
  let prompt = \`あなたはレシピ提案AIです。以下の条件に基づいて、\${count}つのレシピを提案してください。\n\n\`
  
  if (params.stockItems && params.stockItems.length > 0) {
    prompt += \`【在庫の食材】\n\${params.stockItems.join(', ')}\n\n\`
    prompt += \`これらの食材を中心に使ったレシピを提案してください。\n\n\`
  }
  
  if (params.maxCalories) {
    prompt += \`【条件】\n- 最大カロリー: \${params.maxCalories}kcal以下\n\`
  }
  
  if (params.maxTimeMinutes) {
    prompt += \`- 最大調理時間: \${params.maxTimeMinutes}分以内\n\`
  }
  
  if (params.category) {
    prompt += \`- カテゴリ: \${params.category}\n\`
  }
  
  if (params.servings) {
    prompt += \`- 人数: \${params.servings}人分\n\`
  }
  
  prompt += \`\n【出力フォーマット】\nJSON配列で、各レシピは以下の形式:\n\n\`
  prompt += \`[\n  {\n    "title": "レシピ名",\n    "device": "manual",\n    "category": "主菜",\n    "baseServings": 2,\n    "totalWeightG": 500,\n    "ingredients": [{"name": "食材名", "quantity": 100, "unit": "g", "category": "main"}],\n    "steps": [{"name": "工程名", "durationMinutes": 5, "isDeviceStep": false}],\n    "totalTimeMinutes": 30\n  }\n]\n\n**JSONのみを出力してください。**\`
  
  return prompt
}

function parseRecommendationResponse(response: string): Omit<Recipe, 'id'>[] {
  const json = stripCodeFences(response)
  const parsed = JSON.parse(json)
  
  if (!Array.isArray(parsed)) {
    throw new Error('レスポンスが配列ではありません')
  }
  
  return parsed.map((item, index) => ({
    title: item.title || 'Untitled Recipe',
    recipeNumber: generateRecipeNumber(index),
    device: item.device ?? 'manual',
    category: item.category ?? '主菜',
    baseServings: item.baseServings ?? 2,
    totalWeightG: item.totalWeightG ?? 500,
    ingredients: item.ingredients || [],
    steps: item.steps || [],
    totalTimeMinutes: item.totalTimeMinutes ?? 30,
  }))
}

export async function recommendRecipes(
  params: RecommendationParams
): Promise<Omit<Recipe, 'id'>[]> {
  const genAI = new GoogleGenerativeAI(getApiKey())
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  
  const prompt = buildRecommendationPrompt(params)
  const result = await model.generateContent(prompt)
  const response = result.response.text()
  
  const recipes = parseRecommendationResponse(response)
  return recipes
}
\`\`\`

</details>

---

### ステップ2: RecipeRecommender.tsx の作成

**ファイル**: `src/components/RecipeRecommender.tsx`

<details>
<summary>完全なコードを表示（長いため省略可）</summary>

コードは QUICKSTART.md の「タスク2」を参照してください。

</details>

---

### ステップ3: App.tsx の修正

**追加する内容**:

\`\`\`typescript
// インポートに追加
import { RecipeRecommender } from './components/RecipeRecommender'

// 新しいページコンポーネント
function RecommendPage() {
  const navigate = useNavigate()
  return <RecipeRecommender onBack={() => navigate(-1)} />
}

// AppShell内のHeaderに追加
<Header
  onAiParse={() => navigate('/ai-parse')}
  onRecommend={() => navigate('/recommend')}  // 追加
  onMultiSchedule={() => navigate('/multi-schedule')}
  onSettings={() => navigate('/settings')}
/>

// Routesに追加
<Route path="/recommend" element={<RecommendPage />} />
\`\`\`

---

### ステップ4: Header.tsx の修正

**追加する内容**:

\`\`\`typescript
// インポートに追加
import { Lightbulb } from 'lucide-react'

// インターフェースに追加
interface HeaderProps {
  onRecommend?: () => void  // 追加
  // ... 既存のプロパティ
}

// ボタンを追加
{onRecommend && (
  <button
    onClick={onRecommend}
    className="rounded-xl bg-bg-card p-2 transition-colors hover:bg-bg-card-hover"
  >
    <Lightbulb className="h-5 w-5 text-text-secondary" />
  </button>
)}
\`\`\`

---

## 📝 Phase 2: URL取得の改善

### ステップ1: recipeExtractor.ts の作成

**ファイル**: `src/utils/recipeExtractor.ts`

<details>
<summary>完全なコードを表示</summary>

\`\`\`typescript
export async function extractStructuredData(url: string): Promise<any | null> {
  try {
    const response = await fetch(url)
    const html = await response.text()
    
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
    
    for (const script of scripts) {
      const data = JSON.parse(script.textContent || '{}')
      if (data['@type'] === 'Recipe') {
        return data
      }
    }
    
    return null
  } catch (error) {
    console.error('Failed to extract structured data:', error)
    return null
  }
}

export function extractImageUrl(html: string): string | undefined {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  const ogImage = doc.querySelector('meta[property="og:image"]')
  if (ogImage) {
    return ogImage.getAttribute('content') || undefined
  }
  
  const twitterImage = doc.querySelector('meta[name="twitter:image"]')
  if (twitterImage) {
    return twitterImage.getAttribute('content') || undefined
  }
  
  return undefined
}
\`\`\`

</details>

---

### ステップ2: geminiParser.ts の改善

**修正内容**:

\`\`\`typescript
import { extractStructuredData, extractImageUrl } from './recipeExtractor'

export async function parseRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  // 1. 構造化データを優先的に取得
  const structuredData = await extractStructuredData(url)
  if (structuredData) {
    // 構造化データからRecipeを生成
    // （実装は docs/plans/RECIPE_FEATURES_PLAN.md 参照）
  }
  
  // 2. フォールバック: HTMLからテキスト抽出
  let text: string
  let imageUrl: string | undefined
  
  try {
    const res = await fetch(url)
    const html = await res.text()
    
    imageUrl = extractImageUrl(html)
    
    const doc = new DOMParser().parseFromString(html, 'text/html')
    text = doc.body.textContent ?? ''
  } catch (error) {
    throw new Error('URLの取得に失敗しました')
  }
  
  const recipe = await parseRecipeText(text)
  
  return {
    ...recipe,
    imageUrl,
    sourceUrl: url
  }
}
\`\`\`

---

## ✅ 完了チェックリスト

### Phase 1: レシピ提案機能
- [ ] `src/utils/geminiRecommender.ts` を作成
- [ ] `src/components/RecipeRecommender.tsx` を作成
- [ ] `src/App.tsx` にルートを追加
- [ ] `src/components/Header.tsx` にボタンを追加
- [ ] 在庫モードで提案が動作することを確認
- [ ] 条件モードで提案が動作することを確認
- [ ] 提案されたレシピを保存できることを確認

### Phase 2: URL取得の改善
- [ ] `src/utils/recipeExtractor.ts` を作成
- [ ] `src/utils/geminiParser.ts` を改善
- [ ] 構造化データ対応を確認
- [ ] 画像URL取得を確認

---

## 🐛 トラブルシューティング

### エラー: "APIキーが設定されていません"
→ 設定画面でGemini APIキーを入力してください

### エラー: "在庫が登録されていません"
→ 「在庫管理」タブから食材を追加してください

### 提案結果が空
→ Gemini APIのレスポンスを開発者コンソールで確認してください

---

## 📚 参考資料

- **docs/plans/RECIPE_FEATURES_PLAN.md**: 詳細な機能分析と実装計画
- **CLAUDE.md**: プロジェクト全体のガイドライン
- **docs/plans/PLAN.md**: 既存のバグ修正とリファクタリング計画

---

このガイドに従って実装を進めてください。各ステップは独立しているため、順番に実装できます。
