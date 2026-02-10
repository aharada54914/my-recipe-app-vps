## CSV Data Import Guide

Guide for importing recipe data from SHARP appliance CSV files (Hotcook, Healsio).

---

## Data Structure Analysis

### CSV Files Overview

| File | Device | Rows | Has Menu Number | Columns |
|------|--------|------|-----------------|---------|
| `KN-HW24H_5final.csv` | Hotcook | 69 | Some (1/5 in sample) | 9 columns (includes menu number) |
| `AX-XA20_FINAL.csv` | Healsio | 68 | No | 9 columns (no menu number column) |

### Column Structure

**Hotcook (KN-HW24H)**:
- メニュー名 (Recipe name)
- メニュー番号 (Menu number) - **Optional, may be empty**
- 分量 (Serving size)
- カロリー (Calories)
- 調理時間 (Cooking time)
- 画像URL (Image URL)
- 材料 (Ingredients) - **Multi-line text in single cell**
- 作り方 (Steps) - **Multi-line text in single cell**
- URL (Recipe page URL)

**Healsio (AX-XA20)**:
- メニュー名 (Recipe name)
- 分量 (Serving size)
- カロリー (Calories)
- 塩分 (Salt content)
- 調理時間 (Cooking time)
- 画像URL (Image URL)
- 材料 (Ingredients) - **Multi-line text in single cell**
- 作り方 (Steps) - **Multi-line text in single cell**
- URL (Recipe page URL)

---

## Data Processing Requirements

### 1. Parse Multi-Line Ingredients

**Raw format** (single cell with newlines):
```
ごぼう: 1/4本(50g)
にんじん(細切り): 1/8本(25g)
酒: 大さじ1/2
みりん: 大さじ1/2
しょうゆ: 大さじ1/2
```

**Target format** (array of objects):
```typescript
[
  { name: 'ごぼう', quantity: 1/4, unit: '本', note: '50g', category: 'main' },
  { name: 'にんじん', quantity: 1/8, unit: '本', note: '細切り', category: 'main' },
  { name: '酒', quantity: 1/2, unit: '大さじ', note: '', category: 'seasoning' },
  { name: 'みりん', quantity: 1/2, unit: '大さじ', note: '', category: 'seasoning' },
  { name: 'しょうゆ', quantity: 1/2, unit: '大さじ', note: '', category: 'seasoning' },
]
```

### 2. Parse Multi-Line Steps

**Raw format** (single cell with numbered steps):
```
1 もっとクック(別売まぜ技ユニット)を本体にセットする。
2 ごぼうは皮をむき、マッチ棒サイズの細切りにして水にさらしてアクを抜く。
3 内鍋に2、にんじん、[A]を入れ、本体にセットする。
```

**Target format** (array of strings):
```typescript
[
  'もっとクック(別売まぜ技ユニット)を本体にセットする。',
  'ごぼうは皮をむき、マッチ棒サイズの細切りにして水にさらしてアクを抜く。',
  '内鍋に2、にんじん、[A]を入れ、本体にセットする。',
]
```

### 3. Handle Optional Menu Number

- **If present**: Store as `recipeNumber` (e.g., "0395")
- **If empty**: Set to `null` or generate a unique identifier

### 4. URL Handling

- Store URL in database
- Display as clickable icon in RecipeDetail view
- Icon: External link icon (lucide-react `ExternalLink`)

---

## Implementation

### 1. CSV Parser Utility

**Implementation** (`src/utils/csvParser.ts`):

```typescript
import type { Recipe, Ingredient } from '../db/db'

/**
 * Parse ingredient line: "ごぼう: 1/4本(50g)" → { name, quantity, unit, note }
 */
export function parseIngredientLine(line: string): Ingredient | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  
  // Split by colon
  const parts = trimmed.split(':')
  if (parts.length < 2) return null
  
  const name = parts[0].trim()
  const rest = parts.slice(1).join(':').trim()
  
  // Extract quantity and unit (e.g., "1/4本(50g)")
  const quantityMatch = rest.match(/^([\d./]+)\s*([^\d(]+)/)
  
  let quantity = 0
  let unit = ''
  let note = ''
  
  if (quantityMatch) {
    const quantityStr = quantityMatch[1]
    // Handle fractions like "1/4"
    if (quantityStr.includes('/')) {
      const [num, den] = quantityStr.split('/').map(Number)
      quantity = num / den
    } else {
      quantity = parseFloat(quantityStr)
    }
    
    unit = quantityMatch[2].trim()
    
    // Extract note in parentheses
    const noteMatch = rest.match(/\(([^)]+)\)/)
    if (noteMatch) {
      note = noteMatch[1]
    }
  } else {
    // No quantity (e.g., "バニラエッセンス: 適量")
    unit = rest
  }
  
  // Determine category
  const seasonings = ['酒', 'みりん', 'しょうゆ', '砂糖', '塩', '酢', 'ごま油', 'サラダ油', '味噌', 'だし']
  const category = seasonings.some(s => name.includes(s)) ? 'seasoning' : 'main'
  
  return {
    name,
    quantity,
    unit,
    note,
    category,
  }
}

/**
 * Parse multi-line ingredients text
 */
export function parseIngredients(ingredientsText: string): Ingredient[] {
  const lines = ingredientsText.split('\n')
  return lines
    .map(parseIngredientLine)
    .filter((ing): ing is Ingredient => ing !== null)
}

/**
 * Parse multi-line steps text
 */
export function parseSteps(stepsText: string): string[] {
  const lines = stepsText.split('\n')
  return lines
    .map(line => {
      // Remove leading number and space (e.g., "1 " → "")
      const trimmed = line.trim()
      const match = trimmed.match(/^(\d+)\s+(.+)$/)
      return match ? match[2] : trimmed
    })
    .filter(step => step.length > 0)
}

/**
 * Import recipe from CSV row
 */
export function importRecipeFromCSV(row: Record<string, string>, device: 'hotcook' | 'healsio'): Recipe {
  const ingredients = parseIngredients(row['材料'] || '')
  const steps = parseSteps(row['作り方'] || '')
  
  return {
    title: row['メニュー名'],
    device,
    category: '主菜', // Default, can be updated later
    recipeNumber: row['メニュー番号']?.trim() || null,
    servings: row['分量'] || '',
    calories: row['カロリー'] || '',
    cookingTime: row['調理時間'] || '',
    imageUrl: row['画像URL'] || undefined,
    ingredients,
    steps,
    sourceUrl: row['URL'] || undefined,
  }
}
```

---

### 2. CSV Import Page

**Implementation** (`src/pages/ImportPage.tsx`):

```typescript
import { useState } from 'react'
import { Upload, FileText, Check, AlertCircle } from 'lucide-react'
import { db } from '../db/db'
import { importRecipeFromCSV } from '../utils/csvParser'

export function ImportPage() {
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null)
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setImporting(true)
    setResult(null)
    
    try {
      const text = await file.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',')
      
      // Detect device type
      const device = headers.includes('メニュー番号') ? 'hotcook' : 'healsio'
      
      let success = 0
      let errors = 0
      
      // Parse CSV (simple implementation, use proper CSV library for production)
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',')
          const row: Record<string, string> = {}
          headers.forEach((header, index) => {
            row[header.trim()] = values[index]?.trim() || ''
          })
          
          const recipe = importRecipeFromCSV(row, device)
          await db.recipes.add(recipe)
          success++
        } catch (err) {
          console.error(`Error importing row ${i}:`, err)
          errors++
        }
      }
      
      setResult({ success, errors })
    } catch (err) {
      console.error('Import failed:', err)
      setResult({ success: 0, errors: 1 })
    } finally {
      setImporting(false)
    }
  }
  
  return (
    <div className="min-h-dvh bg-bg-primary p-4">
      <header className="mb-6">
        <h1 className="text-xl font-bold">CSVインポート</h1>
        <p className="mt-1 text-sm text-text-secondary">
          ホットクックまたはヘルシオのレシピCSVをインポート
        </p>
      </header>
      
      <div className="rounded-2xl bg-bg-card p-6">
        <label className="flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed border-white/20 p-8 transition-colors hover:border-accent">
          <Upload className="h-12 w-12 text-accent" />
          <div className="text-center">
            <p className="font-medium">CSVファイルを選択</p>
            <p className="mt-1 text-xs text-text-secondary">
              KN-HW24H_5final.csv または AX-XA20_FINAL.csv
            </p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            disabled={importing}
            className="hidden"
          />
        </label>
        
        {importing && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-text-secondary">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            インポート中...
          </div>
        )}
        
        {result && (
          <div className="mt-4 rounded-xl bg-white/5 p-4">
            <div className="flex items-center gap-2">
              {result.errors === 0 ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-400" />
              )}
              <div>
                <p className="font-medium">
                  {result.success}件のレシピをインポートしました
                </p>
                {result.errors > 0 && (
                  <p className="text-sm text-yellow-400">
                    {result.errors}件のエラーがありました
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 rounded-2xl bg-bg-card p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <FileText className="h-4 w-4 text-accent" />
          対応フォーマット
        </h3>
        <ul className="space-y-1 text-xs text-text-secondary">
          <li>• ホットクック: KN-HW24H (メニュー番号あり)</li>
          <li>• ヘルシオ: AX-XA20 (メニュー番号なし)</li>
          <li>• 材料と作り方は自動で分割されます</li>
          <li>• 画像URLとレシピURLも保存されます</li>
        </ul>
      </div>
    </div>
  )
}
```

---

### 3. Display Source URL in RecipeDetail

**Update RecipeDetail.tsx** to show external link icon:

```typescript
import { ExternalLink } from 'lucide-react'

export function RecipeDetail({ recipeId, onBack }: RecipeDetailProps) {
  const recipe = useLiveQuery(() => db.recipes.get(recipeId), [recipeId])
  
  if (!recipe) return <div>Loading...</div>
  
  return (
    <div className="min-h-dvh bg-bg-primary">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={onBack}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        
        {/* External Link Icon */}
        {recipe.sourceUrl && (
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-2 text-sm transition-colors hover:bg-bg-card-hover"
          >
            <ExternalLink className="h-4 w-4 text-accent" />
            <span>公式レシピ</span>
          </a>
        )}
      </header>
      
      {/* ... rest of component ... */}
    </div>
  )
}
```

---

## Database Schema Update

**Add fields to Recipe interface** (`src/db/db.ts`):

```typescript
export interface Recipe {
  id?: number
  title: string
  device: 'hotcook' | 'healsio'
  category: RecipeCategory
  recipeNumber?: string | null // Optional menu number
  servings?: string
  calories?: string
  cookingTime?: string
  imageUrl?: string // Image URL from CSV
  sourceUrl?: string // Recipe page URL (clickable)
  ingredients: Ingredient[]
  steps: string[]
}
```

---

## Testing Checklist

- [ ] Test CSV import with both Hotcook and Healsio files
- [ ] Verify ingredients are correctly parsed (name, quantity, unit, note)
- [ ] Verify steps are correctly split and numbered
- [ ] Test recipes with and without menu numbers
- [ ] Verify external link icon opens correct URL
- [ ] Test with 2000+ recipes (performance)
- [ ] Handle malformed CSV gracefully (error handling)

---

## Recommendation: Separate Documentation

**Should this be in CLAUDE.md or separate?**

**Recommendation: Create separate `CSV_IMPORT.md` file**

**Reasons**:
1. **Different audience**: CLAUDE.md is for general development guidance. CSV import is a specific data migration task.
2. **One-time operation**: CSV import is typically done once or infrequently, not part of daily development.
3. **Detailed parsing logic**: The parsing code is complex and would clutter CLAUDE.md.
4. **Easier maintenance**: Separate file makes it easier to update import logic without affecting main docs.

**What to include in CLAUDE.md**:
- Brief mention of CSV import feature
- Link to `CSV_IMPORT.md` for details
- Database schema fields (`sourceUrl`, `imageUrl`, `recipeNumber`)

**What to keep in `CSV_IMPORT.md`**:
- Full CSV structure analysis
- Parsing logic implementation
- Import page UI
- Testing checklist
