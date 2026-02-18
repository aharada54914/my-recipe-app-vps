# Phase 6-12 リファクタリング実装計画

## 対象フェーズ

| Phase | 機能 | 状態 | 依存 |
|-------|------|------|------|
| 6 | 週間献立自動選択 | 未実装 | Phase 5 ✅ |
| 7 | ホーム画面改善 | **実装済み** ✅ | - |
| 8 | 週間献立タイムライン表示 | 未実装 | Phase 6 |
| 9 | PWA自動更新 | **スキップ** (指示により) | - |
| 10 | トップページ統合 + カテゴリ8種 | 未実装 | 独立 |
| 11 | 材料/手順タブ切り替え | 未実装 | 独立 |
| 12 | 逆算スケジュール計算ロジック変更 | 未実装 | 独立 |

---

## 依存関係グラフ

```
Phase 5 (実装済み: userPreferences, PreferencesContext)
    ↓
Phase 6: 週間献立自動選択 ─────┐
    ├─ weeklyMenus テーブル    │
    ├─ 選択アルゴリズム        │
    ├─ Geminiリファイン (任意) │
    ├─ プレビュー/編集ページ   │
    ├─ カレンダー一括登録      │
    └─ 買い物リスト集約        │
         ↓                    │
Phase 8: 週間献立タイムライン   ←┘
    ├─ WeeklyMenuTimeline.tsx
    ├─ HomePage統合 (today+2日コンパクト)
    └─ 専用ページ (/weekly-menu)

Phase 10: トップページ統合 (独立)
    ├─ 検索 + ホーム統合
    ├─ 4タブ構成
    └─ カテゴリ8種グリッド

Phase 11: 材料/手順タブ切り替え (独立)

Phase 12: 調理時間計算ロジック変更 (独立)
```

**実装順序**: Phase 6 → Phase 8 → Phase 11 → Phase 12 → Phase 10

理由:
- Phase 6 は Phase 8 の前提（献立データが必要）
- Phase 10 は最も影響範囲が大きい（ルーティング・BottomNav変更）ため最後に実施
- Phase 11, 12 は独立のため Phase 8 の後に並行可能

---

## Phase 6: 週間献立自動選択機能

### 6-A. DB スキーマ拡張 (Dexie v8)

**変更ファイル**: `src/db/db.ts`

```typescript
// 新しい型
export interface WeeklyMenuItem {
  recipeId: number
  date: string            // 'YYYY-MM-DD' 形式
  mealType: 'dinner'      // 将来拡張用 (breakfast, lunch, dinner)
  locked: boolean          // ユーザーが固定済みか
}

export interface WeeklyMenu {
  id?: number
  weekStartDate: string    // 週の開始日 'YYYY-MM-DD' (日曜始まり)
  items: WeeklyMenuItem[]  // 7日分の献立
  shoppingList?: string    // 買い物リスト文字列（生成済み）
  status: 'draft' | 'confirmed' | 'registered'  // draft→プレビュー中, confirmed→確定, registered→カレンダー登録済
  createdAt: Date
  updatedAt: Date
  supabaseId?: string
}

// RecipeDB class
weeklyMenus!: Table<WeeklyMenu, number>

// v8
this.version(8).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId',
  stock: '++id, &name, inStock, supabaseId',
  favorites: '++id, &recipeId, addedAt, supabaseId',
  userNotes: '++id, &recipeId, updatedAt, supabaseId',
  viewHistory: '++id, recipeId, viewedAt, supabaseId',
  calendarEvents: '++id, recipeId, googleEventId, supabaseId',
  userPreferences: '++id, supabaseId',
  weeklyMenus: '++id, weekStartDate, supabaseId',
})
```

**TabId 更新**: `'home' | 'search' | 'favorites' | 'stock' | 'history' | 'menu'`
（Phase 10 でタブ構成が変わるため、この時点では BottomNav はまだ変更しない → Phase 8 でルート追加のみ）

---

### 6-B. 週間献立選択アルゴリズム

**新規ファイル**: `src/utils/weeklyMenuSelector.ts`

完全ローカル動作（Gemini API 不要）。スコアリングベースで7日分を選択。

```typescript
export interface MenuSelectionConfig {
  seasonalPriority: SeasonalPriority  // 'low' | 'medium' | 'high'
  userPrompt: string                   // Phase 5で設定済み
  desiredMealHour: number
  desiredMealMinute: number
}

export async function selectWeeklyMenu(
  weekStartDate: Date,
  config: MenuSelectionConfig
): Promise<WeeklyMenuItem[]>
```

**スコアリングロジック**:

```
スコア = (在庫マッチ率 × 3.0)
       + (旬ボーナス × seasonalWeight)
       + (カテゴリ多様性ボーナス × 1.0)
       + (デバイス多様性ボーナス × 0.5)
       - (最近の閲覧履歴ペナルティ × 1.0)
       - (過去の週間献立で使用済みペナルティ × 2.0)
```

- `seasonalWeight`: low=0.5, medium=1.5, high=3.0
- カテゴリ多様性: 7日間で同じカテゴリが3回以上 → -1.0/回
- デバイス多様性: hotcook/healsio を交互に
- ヘルシオデリは除外

**アルゴリズム手順**:
1. recipes (limit 200) + stock + 直近2週のweeklyMenus + 直近viewHistory(30件) を取得
2. 各レシピにスコアを計算
3. 7日分を貪欲法で選択（1日ずつ最高スコアのレシピを選び、選択済みは除外）
4. `WeeklyMenuItem[]` を返す

---

### 6-C. Gemini API リファインメント（オプション）

**新規ファイル**: `src/utils/geminiWeeklyMenu.ts`

既存の `getApiKey()` パターンを使用。API キーがない場合は6-Bのローカル結果をそのまま使用。

```typescript
export async function refineWeeklyMenu(
  selectedRecipes: { recipeId: number; title: string; date: string }[],
  config: { userPrompt: string; seasonalIngredients: string[] }
): Promise<{ recipeId: number; date: string }[] | null>
```

- Gemini に「この7日分の献立を改善してください」とプロンプト
- レスポンスは JSON でレシピIDの入れ替え提案
- null を返した場合はローカル結果をそのまま使用
- **非必須**: API キーがなくてもローカル選択で十分に動作

---

### 6-D. 週間献立プレビュー/編集ページ

**新規ファイル**: `src/pages/WeeklyMenuPage.tsx`

**ルート**: `/weekly-menu`

**レイアウト**:
```
┌─────────────────────────────────────┐
│ [← 戻る]  週間献立                    │
│                                     │
│ 2/16 (日) 〜 2/22 (土)              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 2/16 (日)                  [🔒] │ │  ← ロック/アンロック
│ │ RecipeCard                      │ │
│ │ [変更]                          │ │  ← タップで差し替え
│ │───────────────────────────────│ │
│ │ 2/17 (月)                  [🔓] │ │
│ │ RecipeCard                      │ │
│ │ [変更]                          │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [🔄 再生成]  [📅 カレンダー登録]     │
│ [🛒 買い物リスト]                    │
└─────────────────────────────────────┘
```

**機能**:
- 日付ごとに RecipeCard を表示
- 🔒 ロックボタン: ロックされたレシピは再生成時に固定
- [変更] ボタン: 代替レシピ候補をモーダルで表示（上位10件から選択）
- [🔄 再生成]: ロックされていないレシピのみ再選択
- [📅 カレンダー登録]: Phase 4 の `createCalendarEvent()` を7回呼び出し
- [🛒 買い物リスト]: 7日分の材料をまとめて不足分を計算

---

### 6-E. 買い物リスト集約

**新規ファイル**: `src/utils/weeklyShoppingUtils.ts`

```typescript
export interface AggregatedIngredient {
  name: string
  totalQuantity: number
  unit: string
  inStock: boolean
}

// 7レシピの材料を集約 (同名同単位はマージ)
export function aggregateIngredients(
  recipes: Recipe[],
  stockItems: StockItem[]
): AggregatedIngredient[]

// LINE形式でテキスト生成
export function formatWeeklyShoppingList(
  weekStart: string,
  ingredients: AggregatedIngredient[]
): string
```

**ロジック**:
- 同じ材料名+同じ単位 → 数量を合算
- 在庫にある材料は `inStock: true` でマーク（表示時に取り消し線）
- 適量 は数量集計せず、1件のみ表示
- 調味料（category: 'sub'）は優先度を下げて後方表示

---

### 6-F. カレンダー一括登録 + 調理リマインダー

**新規ファイル**: `src/utils/weeklyMenuCalendar.ts`

```typescript
export async function registerWeeklyMenuToCalendar(
  token: string,
  menu: WeeklyMenu,
  recipes: Recipe[],
  preferences: UserPreferences
): Promise<{ registered: number; errors: string[] }>
```

**処理内容**:
1. 7日分の献立を `createCalendarEvent()` でカレンダー登録
   - イベントタイトル: `"夕食: {レシピ名}"`
   - 時間帯: preferences の `mealStartHour:Minute` 〜 `mealEndHour:Minute`
2. 調理開始リマインダー（`cookingNotifyEnabled` がONの場合）
   - 計算: `desiredMealHour:Minute - レシピの totalTimeMinutes = 調理開始時刻`
   - Google Calendar の `reminders.overrides` で通知設定
3. 各登録結果を `calendarEvents` テーブルに保存
4. `weeklyMenu.status` を `'registered'` に更新

---

### 6-G. syncManager 拡張 (weeklyMenus)

**変更ファイル**: `src/utils/syncManager.ts`, `src/utils/syncConverters.ts`, `src/lib/database.types.ts`

```typescript
// syncConverters.ts に追加
export function weeklyMenuToCloud(menu: WeeklyMenu, userId: string): ...
export function weeklyMenuFromCloud(row: WeeklyMenuRow): Omit<WeeklyMenu, 'id'>

// syncManager.ts — syncAll() に追加 (8番目)
const menuResult = await syncWeeklyMenus(userId)
```

**database.types.ts に追加**:
```typescript
weekly_menus: {
  Row: {
    id: string
    user_id: string
    week_start_date: string
    items: string  // JSON serialized WeeklyMenuItem[]
    shopping_list: string | null
    status: string
    created_at: string
    updated_at: string
  }
}
```

---

### Phase 6 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/db/db.ts` | 変更 | v8 weeklyMenus テーブル + 型定義 |
| `src/lib/database.types.ts` | 変更 | weekly_menus テーブル型 |
| `src/utils/weeklyMenuSelector.ts` | **新規** | ローカル選択アルゴリズム |
| `src/utils/geminiWeeklyMenu.ts` | **新規** | Gemini API リファイン |
| `src/pages/WeeklyMenuPage.tsx` | **新規** | プレビュー/編集ページ |
| `src/utils/weeklyShoppingUtils.ts` | **新規** | 買い物リスト集約 |
| `src/utils/weeklyMenuCalendar.ts` | **新規** | カレンダー一括登録 |
| `src/utils/syncConverters.ts` | 変更 | weeklyMenu 変換関数 |
| `src/utils/syncManager.ts` | 変更 | weeklyMenus 同期追加 |
| `src/App.tsx` | 変更 | `/weekly-menu` ルート追加 |

---

## Phase 8: 週間献立タイムライン表示

### 8-A. WeeklyMenuTimeline コンポーネント

**新規ファイル**: `src/components/WeeklyMenuTimeline.tsx`

ScheduleGantt.tsx のデザインを踏襲した縦タイムライン。

```typescript
interface WeeklyMenuTimelineProps {
  compact?: boolean     // true: today+2日のコンパクト表示 (HomePage用)
  // fullは専用ページ用: 7日表示 + 前後の週切り替え
}
```

**フルモードレイアウト** (専用ページ):
```
┌─────────────────────────────────────┐
│ 週間献立                             │
│ [< 前の週]  2/16-2/22  [次の週 >]   │
├─────────────────────────────────────┤
│ 2/16 ⚫━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ (日) │ ┌─────────────────────────┐ │
│ 今日 │ │ RecipeCard              │ │
│      │ └─────────────────────────┘ │
│      │                             │
│ 2/17 ●━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ (月) │ ┌─────────────────────────┐ │
│      │ │ RecipeCard              │ │
│      │ └─────────────────────────┘ │
│      ...                           │
│ 2/22 ●━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│ (土) │ ┌─────────────────────────┐ │
│      │ │ RecipeCard              │ │
│      │ └─────────────────────────┘ │
└─────────────────────────────────────┘
```

**コンパクトモードレイアウト** (HomePage用):
```
┌─────────────────────────────────────┐
│ 📋 今週の献立                        │
│ 2/18 (火) 鶏肉のトマト煮込み ⏱30分   │
│ 2/19 (水) 豚肉の生姜焼き    ⏱20分   │
│ 2/20 (木) サバの味噌煮      ⏱40分   │
│                      [すべて見る →]  │
└─────────────────────────────────────┘
```

**デザイン要素** (ScheduleGantt準拠):
- 左側にドット (`bg-accent` for today, `bg-white/30` for others)
- タイムラインライン (`border-l-2 border-white/10`)
- 今日のハイライト: ドットが大きく、背景に `bg-accent/10`
- タップで `/recipe/:id` に遷移

**データ取得**:
- `useLiveQuery` で `weeklyMenus` テーブルから該当週を取得
- `items[].recipeId` からレシピ情報を `db.recipes.bulkGet()` で取得
- 在庫マッチ率もRecipeCardに渡す

---

### 8-B. HomePage統合

**変更ファイル**: `src/pages/HomePage.tsx`

```
ようこそ
┌─────────────────────────────────────┐
│ 📋 今週の献立 (compact timeline)      │  ← 新規追加
│ 2/18 (火) 鶏肉のトマト煮込み ...     │
│ 2/19 (水) 豚肉の生姜焼き ...        │
│                      [すべて見る →]  │
└─────────────────────────────────────┘

✨ 在庫でつくれるレシピ (既存)

🍃 旬のおすすめ (既存)
```

- `WeeklyMenuTimeline compact` を「在庫でつくれるレシピ」の上に挿入
- `[すべて見る →]` は `/weekly-menu` に遷移

---

### 8-C. ルーティング追加

**変更ファイル**: `src/App.tsx`

```typescript
// AppLayout 内に追加
<Route path="weekly-menu" element={<WeeklyMenuPage />} />

// またはフルスクリーンページとして
<Route path="/weekly-menu" element={<WeeklyMenuPageWrapper />} />
```

→ フルスクリーンモーダルスタイル（RecipeDetail と同じパターン）を推奨。
  BottomNav は Phase 10 でタブ変更時にまとめて修正。

---

### Phase 8 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/components/WeeklyMenuTimeline.tsx` | **新規** | タイムラインコンポーネント |
| `src/pages/HomePage.tsx` | 変更 | compact timeline 追加 |
| `src/App.tsx` | 変更 | `/weekly-menu` ルート追加 (6-Dでも変更あり) |

---

## Phase 11: 材料/手順タブ切り替え

### 11-A. RecipeDetail タブUI追加

**変更ファイル**: `src/components/RecipeDetail.tsx`

現在の構成:
```
材料セクション (常に表示)
塩分計算
逆算スケジュール
調理手順 (常に表示)
メモ
```

変更後:
```
[材料] [手順]  ← タブ切り替え
├── 材料タブ: 材料テーブル + 買い物リスト
└── 手順タブ: 調理手順 (rawSteps)

塩分計算 (タブ外、常に表示)
逆算スケジュール (タブ外、常に表示)
メモ (タブ外、常に表示)
```

**実装**:
```typescript
const [activeTab, setActiveTab] = useState<'ingredients' | 'steps'>('ingredients')
```

**タブUIデザイン** (既存 CategoryTags スタイル準拠):
```
┌───────────────────────────────┐
│ [材料]  [手順]                 │  ← 選択中はbg-accent, 非選択はbg-bg-card
└───────────────────────────────┘
```

**注意**:
- `rawSteps` がない場合（steps のみのレシピ）はタブを表示しない（従来通りの一体表示）
- 塩分計算・逆算スケジュール・メモは材料/手順タブの外に残す
- タブ切り替え時はアニメーションなし（シンプルに切り替え）

---

### Phase 11 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/components/RecipeDetail.tsx` | 変更 | タブ切り替えUI + 表示分岐 |

---

## Phase 12: 逆算スケジュール計算ロジック変更

### 12-A. 下ごしらえ時間計算関数

**変更ファイル**: `src/utils/recipeUtils.ts`

```typescript
/**
 * 品目数に応じた下ごしらえ時間を計算
 * 基本時間: 5分 + (品目数 - 1) × 2分
 */
export function calculatePrepTime(ingredientCount: number): number {
  if (ingredientCount <= 0) return 5
  return 5 + Math.max(0, ingredientCount - 1) * 2
}
```

---

### 12-B. 新しいスケジュール計算関数

**変更ファイル**: `src/utils/recipeUtils.ts`

```typescript
/**
 * レシピから自動で3ステップ（下ごしらえ→調理→盛り付け）のスケジュールを生成
 */
export function calculateAutoSchedule(
  targetTime: Date,
  recipe: Recipe
): ScheduleEntry[] {
  const prepTime = calculatePrepTime(recipe.ingredients.length)
  const cookingTime = parseCookingTime(recipe.cookingTime, recipe.totalTimeMinutes)
  const plateTime = 3  // 盛り付け固定3分

  const steps: CookingStep[] = [
    { name: '下ごしらえ', durationMinutes: prepTime, isDeviceStep: false },
    { name: `${deviceLabels[recipe.device]}調理`, durationMinutes: cookingTime, isDeviceStep: true },
    { name: '盛り付け', durationMinutes: plateTime, isDeviceStep: false },
  ]

  return calculateSchedule(targetTime, steps)
}

/**
 * cookingTime文字列からデバイス調理時間(分)を抽出
 * 例: "約30分" → 30, "1時間10分" → 70
 */
function parseCookingTime(cookingTime: string | undefined, fallback: number): number {
  if (!cookingTime) return Math.max(fallback - 8, 10)  // fallbackから下ごしらえ+盛り付け分を引く

  const hourMatch = cookingTime.match(/(\d+)時間/)
  const minMatch = cookingTime.match(/(\d+)分/)
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0
  const mins = minMatch ? parseInt(minMatch[1]) : 0

  return hours * 60 + mins || 30  // パース失敗時は30分
}
```

---

### 12-C. ScheduleGantt 変更

**変更ファイル**: `src/components/ScheduleGantt.tsx`

**変更点**:
- props に `recipe: Recipe` を追加（オプション）
- `recipe` が渡された場合: `calculateAutoSchedule()` を使用（新ロジック）
- `recipe` が渡されない場合（既存の steps のみ）: 従来通り `calculateSchedule()` を使用
- 後方互換性を維持

```typescript
interface ScheduleGanttProps {
  steps: CookingStep[]
  recipe?: Recipe          // ← 追加（オプション）
}
```

RecipeDetail.tsx 側で `recipe` を渡すよう変更:
```typescript
<ScheduleGantt steps={recipe.steps} recipe={recipe} />
```

---

### Phase 12 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/utils/recipeUtils.ts` | 変更 | `calculatePrepTime`, `calculateAutoSchedule`, `parseCookingTime` 追加 |
| `src/components/ScheduleGantt.tsx` | 変更 | `recipe` prop 追加、自動スケジュール計算 |
| `src/components/RecipeDetail.tsx` | 変更 | ScheduleGantt に `recipe` を渡す |

---

## Phase 10: トップページ統合と改善

### 10-A. BottomNav 4タブ構成

**変更ファイル**: `src/components/BottomNav.tsx`, `src/db/db.ts`

```typescript
// db.ts — TabId 更新
export type TabId = 'home' | 'menu' | 'stock' | 'settings'

// BottomNav.tsx
const tabs = [
  { id: 'home', path: '/', icon: Home, label: 'ホーム' },
  { id: 'menu', path: '/weekly-menu', icon: CalendarDays, label: '献立' },
  { id: 'stock', path: '/stock', icon: Package, label: '在庫' },
  { id: 'settings', path: '/settings', icon: Settings, label: '設定' },
]
```

**削除タブ**: 検索(→ホームに統合), お気に入り(→ホーム内セクション), 履歴(→設定ページ内リンク)

---

### 10-B. HomePage 大幅改修

**変更ファイル**: `src/pages/HomePage.tsx`

**新規ファイル**: `src/components/CategoryGrid.tsx`

**レイアウト**:
```
┌─────────────────────────────────────┐
│ recipy                          ♡   │
│ 今日は何つくる？                     │
│                                     │
│ 🔍 食材・料理名で検索                │  ← SearchBar 統合
│                                     │
│ カテゴリ                             │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│ │ 🍙 │ │ 🍛 │ │ 🥟 │ │ 🌶️ │      │
│ │和食│ │洋食│ │中華│ │韓国│      │
│ └────┘ └────┘ └────┘ └────┘      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│ │ 🥗 │ │ 🍰 │ │ 🍜 │ │ ⚡ │      │
│ │サラダ│ │スイーツ│ │スープ│ │時短│      │
│ └────┘ └────┘ └────┘ └────┘      │
│                                     │
│ 📋 今週の献立 (compact timeline)     │  ← Phase 8 で追加済み
│                                     │
│ ⚡ 時短レシピ (30分以下)              │  ← 新規
│ ← [RecipeCard] [RecipeCard] →      │  ← 横スクロール
│                                     │
│ 🍃 旬のレシピ                        │  ← 既存を改修
│ ← [RecipeCard] [RecipeCard] →      │  ← 横スクロール
│                                     │
│ ✨ 在庫に基づいたおすすめ             │  ← 既存
│ ← [RecipeCard] [RecipeCard] →      │  ← 横スクロール
└─────────────────────────────────────┘
```

**CategoryGrid コンポーネント**:
```typescript
const categories = [
  { label: '和食', emoji: '🍙', filter: '和食' },
  { label: '洋食', emoji: '🍛', filter: '洋食' },
  { label: '中華', emoji: '🥟', filter: '中華' },
  { label: '韓国', emoji: '🌶️', filter: '韓国' },
  { label: 'サラダ', emoji: '🥗', filter: 'サラダ' },
  { label: 'スイーツ', emoji: '🍰', filter: 'デザート' },
  { label: 'スープ', emoji: '🍜', filter: 'スープ' },
  { label: '時短', emoji: '⚡', filter: 'quick' },   // 特殊フィルタ: totalTimeMinutes <= 30
]
```

- カテゴリタップ → `/search?category=和食` にナビゲート（RecipeList をフィルタ付きで表示）
- ただし `/search` ルートは AppLayout 内に維持（BottomNav には表示しない、直リンクのみ）

**レシピセクション横スクロール**:
- `overflow-x-auto flex gap-3` で横スクロール（カード幅: `w-64 shrink-0`）
- RecipeCard を横長バリエーションで表示（コンパクト版）

---

### 10-C. お気に入り・履歴のアクセス手段

**変更ファイル**: `src/pages/HomePage.tsx`, `src/pages/SettingsPage.tsx`

- ホーム画面のヘッダー右に ♡ アイコン → `/favorites` に遷移
- 設定ページ内に「閲覧履歴」リンクを追加

---

### 10-D. App.tsx ルーティング変更

**変更ファイル**: `src/App.tsx`

```typescript
<Route element={<AppLayout />}>
  <Route index element={<HomePage />} />
  <Route path="search" element={<SearchPage />} />     // 維持（カテゴリ直リンク用）
  <Route path="stock" element={<StockManager />} />
  <Route path="history" element={<HistoryPage />} />    // 維持（設定からのリンク用）
  <Route path="favorites" element={<FavoritesPage />} /> // 維持（ヘッダーからのリンク用）
  <Route path="weekly-menu" element={<WeeklyMenuPage />} /> // AppLayout内に移動
</Route>

// 設定はフルスクリーンから AppLayout内に移動
<Route path="settings" element={<SettingsPage />} /> // AppLayout内に移動
```

---

### Phase 10 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/db/db.ts` | 変更 | TabId 更新 |
| `src/components/BottomNav.tsx` | 変更 | 4タブ構成 |
| `src/pages/HomePage.tsx` | 変更 | 検索バー + カテゴリグリッド + 横スクロールセクション |
| `src/components/CategoryGrid.tsx` | **新規** | 8カテゴリグリッド |
| `src/App.tsx` | 変更 | ルーティング再構成 |
| `src/pages/SettingsPage.tsx` | 変更 | 閲覧履歴リンク追加 |
| `src/components/Header.tsx` | 変更 | お気に入りアイコン追加 |

---

## 全体の実装ステップ

```
Step 1:  [Phase 6-A]  DB v8 + WeeklyMenu型 + database.types.ts
Step 2:  [Phase 6-B]  weeklyMenuSelector.ts (ローカル選択アルゴリズム)
Step 3:  [Phase 6-C]  geminiWeeklyMenu.ts (オプション・Geminiリファイン)
Step 4:  [Phase 6-E]  weeklyShoppingUtils.ts (買い物リスト集約)
Step 5:  [Phase 6-F]  weeklyMenuCalendar.ts (カレンダー一括登録)
Step 6:  [Phase 6-D]  WeeklyMenuPage.tsx (プレビュー/編集)
Step 7:  [Phase 6-G]  syncManager + syncConverters拡張
Step 8:  [Phase 6]    App.tsx ルート追加 + ビルド確認
         ↓
Step 9:  [Phase 8-A]  WeeklyMenuTimeline.tsx
Step 10: [Phase 8-B]  HomePage.tsx に compact timeline 追加
Step 11: [Phase 8]    ビルド確認
         ↓
Step 12: [Phase 11]   RecipeDetail.tsx タブ切り替え
Step 13: [Phase 11]   ビルド確認
         ↓
Step 14: [Phase 12-A] recipeUtils.ts に新関数追加
Step 15: [Phase 12-B] ScheduleGantt.tsx + RecipeDetail.tsx 変更
Step 16: [Phase 12]   ビルド確認
         ↓
Step 17: [Phase 10-A] BottomNav 4タブ + TabId変更
Step 18: [Phase 10-B] CategoryGrid.tsx + HomePage大幅改修
Step 19: [Phase 10-C] App.tsx ルーティング再構成
Step 20: [Phase 10]   ビルド確認 + lint修正
         ↓
Step 21: 最終ビルド + コミット + プッシュ
```

---

## 新規ファイル一覧（Phase 6-12 合計）

| ファイル | Phase | 概要 |
|---------|-------|------|
| `src/utils/weeklyMenuSelector.ts` | 6 | ローカル献立選択アルゴリズム |
| `src/utils/geminiWeeklyMenu.ts` | 6 | Gemini APIリファインメント |
| `src/pages/WeeklyMenuPage.tsx` | 6 | 週間献立プレビュー/編集ページ |
| `src/utils/weeklyShoppingUtils.ts` | 6 | 買い物リスト集約ユーティリティ |
| `src/utils/weeklyMenuCalendar.ts` | 6 | カレンダー一括登録ユーティリティ |
| `src/components/WeeklyMenuTimeline.tsx` | 8 | 週間献立タイムラインコンポーネント |
| `src/components/CategoryGrid.tsx` | 10 | 8カテゴリグリッドコンポーネント |

## 変更ファイル一覧（Phase 6-12 合計）

| ファイル | 変更内容 |
|---------|---------|
| `src/db/db.ts` | v8 weeklyMenus, TabId更新 |
| `src/lib/database.types.ts` | weekly_menus テーブル型 |
| `src/utils/syncConverters.ts` | weeklyMenu変換関数 |
| `src/utils/syncManager.ts` | weeklyMenus同期 |
| `src/utils/recipeUtils.ts` | calculatePrepTime, calculateAutoSchedule, parseCookingTime |
| `src/components/ScheduleGantt.tsx` | recipe prop追加, 自動スケジュール |
| `src/components/RecipeDetail.tsx` | タブ切り替え + ScheduleGanttにrecipe渡し |
| `src/pages/HomePage.tsx` | compact timeline + 検索バー + カテゴリ + 横スクロール |
| `src/components/BottomNav.tsx` | 4タブ構成 |
| `src/App.tsx` | ルーティング再構成 |
| `src/pages/SettingsPage.tsx` | 閲覧履歴リンク |
| `src/components/Header.tsx` | お気に入りアイコン |
