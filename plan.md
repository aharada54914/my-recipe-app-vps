# Phase 4-5 リファクタリング実装計画

## 依存関係の整理

```
Phase 1-3 (実装済み)
  ├─ Supabase基盤 + Google OAuth認証 + データ同期
  ├─ AuthContext, useAuth, SyncProvider, syncManager
  └─ Dexie v6 (supabaseId付き)
      ↓
Phase 4: Googleカレンダー基本連携
  ├─ Google Calendar API アクセス基盤
  ├─ 献立予定の手動登録 (RecipeDetail → カレンダー)
  ├─ 買い物リストのカレンダー登録
  └─ 家族カレンダーの予定読み取り
      ↓
Phase 5: 個人設定・プリファレンス機能
  ├─ userPreferences テーブル (Dexie v7 + Supabase)
  ├─ SettingsPage UI拡張
  ├─ 通知時間 / 家族カレンダーID / 献立時間帯 設定
  ├─ 旬の食材優先度 / ユーザープロンプト 設定
  └─ 調理開始通知 設定
```

**Phase 5 は Phase 4 に依存**: 家族カレンダーID設定には Google Calendar API が先に必要。

---

## Phase 4: Googleカレンダー基本連携

### 4-A. Google Calendar OAuth スコープ追加

**変更ファイル**: `src/contexts/AuthContext.tsx`

**方針**:
- Supabase Google OAuth に Calendar スコープを追加
- `session.provider_token` で Google API アクセストークンを取得
- アクセストークンを AuthContext に追加で公開

```typescript
// AuthContext.tsx — 変更点
export interface AuthContextValue {
  user: User | null
  loading: boolean
  providerToken: string | null         // ← 追加
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

// signInWithOAuth に scopes を追加
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin + '/settings',
    scopes: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
  },
})

// onAuthStateChange で provider_token を保持
supabase.auth.onAuthStateChange((_event, session) => {
  setUser(session?.user ?? null)
  setProviderToken(session?.provider_token ?? null)
})
```

**注意**: Supabase Dashboard 側でも Google provider の scopes 設定が必要（手動作業）。

---

### 4-B. Google Calendar API クライアント作成

**新規ファイル**: `src/lib/googleCalendar.ts`

外部ライブラリ不要。Google Calendar REST API v3 を `fetch()` で直接呼び出す。

```typescript
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

// カレンダー一覧を取得
export async function listCalendars(token: string): Promise<CalendarListEntry[]>

// イベント作成（献立予定 or 買い物リスト）
export async function createCalendarEvent(
  token: string,
  calendarId: string,
  event: CalendarEventInput
): Promise<CalendarEvent>

// イベント削除
export async function deleteCalendarEvent(
  token: string,
  calendarId: string,
  eventId: string
): Promise<void>

// 家族カレンダーの予定を取得（指定期間）
export async function listEvents(
  token: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]>
```

**型定義**:
```typescript
export interface CalendarListEntry {
  id: string
  summary: string        // カレンダー名
  primary?: boolean
  backgroundColor?: string
}

export interface CalendarEventInput {
  summary: string        // 例: "夕食: 鶏肉のトマト煮込み"
  description?: string   // 材料リスト等
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  reminders?: {
    useDefault: boolean
    overrides?: { method: string; minutes: number }[]
  }
}

export interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
}
```

---

### 4-C. DB スキーマ拡張: calendarEvents テーブル

**変更ファイル**: `src/db/db.ts`

```typescript
// 新しい型
export interface CalendarEventRecord {
  id?: number
  recipeId: number
  googleEventId: string         // Google Calendar のイベントID
  calendarId: string            // どのカレンダーに登録したか
  eventType: 'meal' | 'shopping'  // 献立 or 買い物リスト
  startTime: Date
  endTime: Date
  createdAt: Date
  supabaseId?: string
}

// RecipeDB class — Dexie v7 追加
calendarEvents!: Table<CalendarEventRecord, number>

this.version(7).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId',
  stock: '++id, &name, inStock, supabaseId',
  favorites: '++id, &recipeId, addedAt, supabaseId',
  userNotes: '++id, &recipeId, updatedAt, supabaseId',
  viewHistory: '++id, recipeId, viewedAt, supabaseId',
  calendarEvents: '++id, recipeId, googleEventId, supabaseId',
})
```

**Supabase テーブル** (`src/lib/database.types.ts` に追加):
```typescript
calendar_events: {
  Row: {
    id: string
    user_id: string
    recipe_id: string
    google_event_id: string
    calendar_id: string
    event_type: string
    start_time: string
    end_time: string
    created_at: string
    updated_at: string
  }
  // Insert, Update, Relationships...
}
```

---

### 4-D. 献立予定の手動登録（RecipeDetail）

**変更ファイル**: `src/components/RecipeDetail.tsx`

**新規ファイル**: `src/components/CalendarRegistrationModal.tsx`

RecipeDetail のヘッダーアクションボタン列に「カレンダー登録」ボタンを追加。

```
┌─────────────────────────────────────┐
│ [← 戻る]   [⭐] [📅] [🔗]         │  ← 📅 追加
│                                     │
│  鶏肉のトマト煮込み                  │
│  ...                                │
└─────────────────────────────────────┘
```

**CalendarRegistrationModal** の機能:
- 日付選択（`<input type="date">`）
- 時間帯選択（開始・終了時間、デフォルト: 18:00-19:00）
- カレンダー選択（Google Calendar API から一覧取得）
- リマインダー設定（調理開始時刻に通知するオプション）
- 登録ボタン → `createCalendarEvent()` 呼び出し → `calendarEvents` テーブルに保存

**イベント内容**:
```
タイトル: "夕食: 鶏肉のトマト煮込み"
説明:
  材料:
  ・トマト 1個
  ・鶏もも肉 300g
  ...

  調理時間: 30分
  レシピURL: [sourceUrl]
```

---

### 4-E. 買い物リストのカレンダー登録

**変更ファイル**: `src/components/RecipeDetail.tsx`

既存のショッピングリスト（`handleCopyShoppingList`）の横に「カレンダーに登録」ボタンを追加。

**イベント内容**:
```
タイトル: "🛒 買い物リスト: 鶏肉のトマト煮込み"
時間: 5分の予定（ユーザー選択の日時）
説明:
  📋 鶏肉のトマト煮込み の買い物リスト
  ・トマト 1個
  ・鶏もも肉 300g
  ...
```

---

### 4-F. 家族カレンダーの予定読み取り

**新規ファイル**: `src/utils/familyCalendarUtils.ts`

```typescript
// 家族カレンダーから指定期間の予定を取得
export async function getFamilySchedule(
  token: string,
  calendarId: string,
  startDate: Date,
  endDate: Date
): Promise<FamilyEvent[]>

export interface FamilyEvent {
  summary: string
  date: Date
  isAllDay: boolean
  startTime?: string
  endTime?: string
}

// 家族の予定から献立提案のヒントを生成
export function analyzeFamilySchedule(events: FamilyEvent[]): MealSuggestionHint[]

export interface MealSuggestionHint {
  date: Date
  suggestion: string  // 例: "帰りが遅い日 → 時短レシピ推奨"
  reason: string
}
```

**ヒントのロジック例**:
- 夕方以降に予定あり → 「忙しい日なので時短レシピを推奨」
- 終日予定 → 「外出日なので作り置き or 翌日用レシピを推奨」
- 予定なし → 「時間があるのでじっくり料理もOK」

---

### 4-G. syncManager 拡張

**変更ファイル**: `src/utils/syncManager.ts`, `src/utils/syncConverters.ts`

`syncAll()` に `calendarEvents` テーブルの同期を追加（6番目）:

```typescript
// syncManager.ts
const calResult = await syncCalendarEvents(userId, recipeIdMap)
result.pushed += calResult.pushed
result.pulled += calResult.pulled
```

```typescript
// syncConverters.ts に追加
export function calendarEventToCloud(item: CalendarEventRecord, userId: string, recipeSupabaseId: string): ...
export function calendarEventFromCloud(row: CalendarEventRow): Omit<CalendarEventRecord, 'id'>
```

---

### Phase 4 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/contexts/AuthContext.tsx` | 変更 | providerToken追加, Calendar scopes追加 |
| `src/lib/googleCalendar.ts` | **新規** | Google Calendar REST API クライアント |
| `src/db/db.ts` | 変更 | v7 calendarEvents テーブル + CalendarEventRecord型 |
| `src/lib/database.types.ts` | 変更 | calendar_events テーブル型追加 |
| `src/components/CalendarRegistrationModal.tsx` | **新規** | カレンダー登録モーダル |
| `src/components/RecipeDetail.tsx` | 変更 | カレンダー登録ボタン追加 |
| `src/utils/familyCalendarUtils.ts` | **新規** | 家族カレンダー読み取り・分析 |
| `src/utils/syncManager.ts` | 変更 | calendarEvents 同期追加 |
| `src/utils/syncConverters.ts` | 変更 | calendarEvent 変換関数追加 |

---

## Phase 5: 個人設定・プリファレンス機能

### 5-A. userPreferences テーブル作成

**変更ファイル**: `src/db/db.ts`

```typescript
// 新しい型
export interface UserPreferences {
  id?: number
  // カレンダー設定
  familyCalendarId?: string      // 家族カレンダーID
  mealStartHour: number          // 献立登録時間帯（開始）デフォルト: 18
  mealStartMinute: number        // デフォルト: 0
  mealEndHour: number            // 献立登録時間帯（終了）デフォルト: 19
  mealEndMinute: number          // デフォルト: 0
  defaultCalendarId?: string     // デフォルト登録先カレンダー
  // 週間献立設定
  weeklyMenuGenerationDay: number     // 曜日 (0=日, 5=金) デフォルト: 5
  weeklyMenuGenerationHour: number    // デフォルト: 18
  weeklyMenuGenerationMinute: number  // デフォルト: 0
  shoppingListHour: number       // 買い物リスト登録時間 デフォルト: 19
  shoppingListMinute: number     // デフォルト: 0
  // 旬の食材優先度
  seasonalPriority: 'low' | 'medium' | 'high'  // デフォルト: 'low'
  // ユーザープロンプト
  userPrompt: string             // 例: "魚料理を多めに" デフォルト: ''
  // 通知設定
  notifyWeeklyMenuDone: boolean  // 週間献立完了通知 デフォルト: true
  notifyShoppingListDone: boolean // 買い物リスト登録完了通知 デフォルト: true
  // 調理開始通知
  cookingNotifyEnabled: boolean  // デフォルト: true
  cookingNotifyHour: number      // 通知時刻 デフォルト: 16
  cookingNotifyMinute: number    // デフォルト: 0
  // 食事開始希望時刻
  desiredMealHour: number        // デフォルト: 18
  desiredMealMinute: number      // デフォルト: 0
  // メタ
  updatedAt: Date
  supabaseId?: string
}
```

**Dexie v7 に統合** (Phase 4 の calendarEvents と同じバージョン):

```typescript
this.version(7).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId',
  stock: '++id, &name, inStock, supabaseId',
  favorites: '++id, &recipeId, addedAt, supabaseId',
  userNotes: '++id, &recipeId, updatedAt, supabaseId',
  viewHistory: '++id, recipeId, viewedAt, supabaseId',
  calendarEvents: '++id, recipeId, googleEventId, supabaseId',
  userPreferences: '++id, supabaseId',
})
```

**Supabase テーブル** (`database.types.ts` に追加):
```typescript
user_preferences: {
  Row: {
    id: string
    user_id: string
    family_calendar_id: string | null
    meal_start_hour: number
    meal_start_minute: number
    meal_end_hour: number
    meal_end_minute: number
    default_calendar_id: string | null
    weekly_menu_generation_day: number
    weekly_menu_generation_hour: number
    weekly_menu_generation_minute: number
    shopping_list_hour: number
    shopping_list_minute: number
    seasonal_priority: string
    user_prompt: string
    notify_weekly_menu_done: boolean
    notify_shopping_list_done: boolean
    cooking_notify_enabled: boolean
    cooking_notify_hour: number
    cooking_notify_minute: number
    desired_meal_hour: number
    desired_meal_minute: number
    created_at: string
    updated_at: string
  }
  // Insert, Update...
}
```

---

### 5-B. PreferencesContext + usePreferences フック

**新規ファイル**: `src/contexts/PreferencesContext.tsx`
**新規ファイル**: `src/hooks/usePreferences.ts`

```typescript
// デフォルト値
export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'id' | 'supabaseId'> = {
  familyCalendarId: undefined,
  mealStartHour: 18,
  mealStartMinute: 0,
  mealEndHour: 19,
  mealEndMinute: 0,
  defaultCalendarId: undefined,
  weeklyMenuGenerationDay: 5,
  weeklyMenuGenerationHour: 18,
  weeklyMenuGenerationMinute: 0,
  shoppingListHour: 19,
  shoppingListMinute: 0,
  seasonalPriority: 'low',
  userPrompt: '',
  notifyWeeklyMenuDone: true,
  notifyShoppingListDone: true,
  cookingNotifyEnabled: true,
  cookingNotifyHour: 16,
  cookingNotifyMinute: 0,
  desiredMealHour: 18,
  desiredMealMinute: 0,
  updatedAt: new Date(),
}

// PreferencesContext
interface PreferencesContextValue {
  preferences: UserPreferences
  updatePreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => Promise<void>
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>
  resetToDefaults: () => Promise<void>
}
```

**ロジック**:
- `useLiveQuery` で Dexie から preferences を取得（レコードは常に1つ）
- 存在しない場合は `DEFAULT_PREFERENCES` をDBに挿入
- `updatePreference()` で個別フィールドを更新（`updatedAt` も自動更新）
- PreferencesProvider を App.tsx に追加

---

### 5-C. SettingsPage UI拡張

**変更ファイル**: `src/pages/SettingsPage.tsx`

既存のセクション（アカウント → Gemini APIキー → データ管理）の間に新しいセクションを追加。

**セクション構成**（上から順）:
1. アカウント（既存）
2. **カレンダー設定** ← 新規
3. **献立設定** ← 新規
4. **通知設定** ← 新規
5. Gemini API キー（既存）
6. データ管理（既存）

---

#### 5-C-1. カレンダー設定セクション

```
┌─────────────────────────────────────┐
│ 📅 カレンダー設定                     │
│                                     │
│ デフォルト登録先カレンダー             │
│ [▼ マイカレンダー                ]    │
│                                     │
│ 家族カレンダー                       │
│ [▼ 家族のカレンダー             ]    │
│ ※ 家族の予定から献立を提案します      │
│                                     │
│ 献立の時間帯                         │
│ [18] : [00]  〜  [19] : [00]       │
└─────────────────────────────────────┘
```

- カレンダー選択は `listCalendars()` で取得した一覧を `<select>` で表示
- ログイン時のみ表示（`user && providerToken` がある場合）

---

#### 5-C-2. 献立設定セクション

```
┌─────────────────────────────────────┐
│ 🍽️ 献立設定                         │
│                                     │
│ 週間献立の自動生成                    │
│ 生成タイミング: [金曜日▼] [18]:[00]  │
│                                     │
│ 買い物リスト登録時間                  │
│ [19] : [00]                         │
│                                     │
│ 旬の食材優先度                       │
│ [低（たまに入れる）] [中] [高]       │
│                                     │
│ 献立リクエスト                       │
│ ┌─────────────────────────────────┐ │
│ │ 魚料理を多めに                   │ │
│ └─────────────────────────────────┘ │
│ ※ 週間献立生成時にAIが考慮します     │
└─────────────────────────────────────┘
```

- 曜日選択は `<select>` (日〜土)
- 時間は `<input type="number">` (0-23, 0-59)
- 旬の食材優先度は3つのトグルボタン
- 献立リクエストは `<textarea>` (16px以上のフォントサイズ)

---

#### 5-C-3. 通知設定セクション

```
┌─────────────────────────────────────┐
│ 🔔 通知設定                          │
│                                     │
│ 調理開始通知                         │
│ [● ON ○ OFF]                       │
│                                     │
│ 通知時刻                             │
│ [16] : [00]                         │
│ ※ この時刻に今日の調理開始時刻を通知  │
│                                     │
│ 食事開始希望時刻                      │
│ [18] : [00]                         │
│ ※ 逆算して調理開始時刻を計算          │
│                                     │
│ 週間献立完了通知  [● ON ○ OFF]       │
│ 買い物リスト通知  [● ON ○ OFF]       │
└─────────────────────────────────────┘
```

- ON/OFF はトグルスイッチ風ボタン
- 調理開始通知がOFFの場合、通知時刻と食事開始希望時刻はグレーアウト

---

### 5-D. App.tsx に PreferencesProvider 追加

**変更ファイル**: `src/App.tsx`

```typescript
<AuthProvider>
  <BrowserRouter>
    <SyncProvider>
      <PreferencesProvider>    {/* ← 追加 */}
        <Routes>...</Routes>
      </PreferencesProvider>
    </SyncProvider>
  </BrowserRouter>
</AuthProvider>
```

---

### 5-E. syncManager 拡張（userPreferences 同期）

**変更ファイル**: `src/utils/syncManager.ts`, `src/utils/syncConverters.ts`

`syncAll()` に `userPreferences` の同期を追加（7番目）:

```typescript
const prefResult = await syncPreferences(userId)
result.pushed += prefResult.pushed
result.pulled += prefResult.pulled
```

**特殊対応**:
- userPreferences はユーザーごとに1レコードのみ
- push/pull は単純なupsert（1レコードの比較のみ）
- `updatedAt` の比較で競合解決（last-write-wins）

---

### Phase 5 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/db/db.ts` | 変更 | UserPreferences型追加, v7にテーブル追加 |
| `src/lib/database.types.ts` | 変更 | user_preferences テーブル型追加 |
| `src/contexts/PreferencesContext.tsx` | **新規** | PreferencesProvider |
| `src/hooks/usePreferences.ts` | **新規** | usePreferences フック |
| `src/pages/SettingsPage.tsx` | 変更 | カレンダー/献立/通知設定セクション追加 |
| `src/App.tsx` | 変更 | PreferencesProvider でラップ |
| `src/utils/syncManager.ts` | 変更 | userPreferences 同期追加 |
| `src/utils/syncConverters.ts` | 変更 | preferences 変換関数追加 |

---

## 実装順序（依存関係を考慮）

```
Step 1: DB スキーマ拡張 (Phase 4 + 5 共通)
  └─ db.ts v7: calendarEvents + userPreferences テーブル追加
  └─ database.types.ts: 2テーブルの型追加
      ↓
Step 2: Google Calendar API クライアント (Phase 4-B)
  └─ src/lib/googleCalendar.ts 新規作成
      ↓
Step 3: AuthContext 拡張 (Phase 4-A)
  └─ providerToken 追加, Calendar scopes 追加
      ↓
Step 4: PreferencesContext 作成 (Phase 5-B)
  └─ src/contexts/PreferencesContext.tsx 新規
  └─ src/hooks/usePreferences.ts 新規
  └─ App.tsx に PreferencesProvider 追加
      ↓
Step 5: CalendarRegistrationModal 作成 (Phase 4-D, 4-E)
  └─ src/components/CalendarRegistrationModal.tsx 新規
  └─ RecipeDetail.tsx にカレンダー登録ボタン追加
      ↓
Step 6: 家族カレンダー連携 (Phase 4-F)
  └─ src/utils/familyCalendarUtils.ts 新規
      ↓
Step 7: SettingsPage UI拡張 (Phase 5-C)
  └─ カレンダー設定 / 献立設定 / 通知設定セクション追加
      ↓
Step 8: syncManager 拡張 (Phase 4-G + 5-E)
  └─ calendarEvents + userPreferences の同期追加
  └─ syncConverters.ts に変換関数追加
      ↓
Step 9: ビルド確認 + lint修正
```

---

## 設計上の判断ポイント

### 1. Google Calendar API アクセス方式
- **採用**: Supabase OAuth の `provider_token` を使用してREST APIを直接呼び出す
- **理由**: 追加ライブラリ不要、クライアントサイドで完結
- **制約**: provider_token は1時間で期限切れ → 再ログインが必要な場合がある
- **対策**: API呼び出し失敗時に401なら `signInWithGoogle()` を再実行して再認証を促す

### 2. カレンダーイベントの同期範囲
- Dexie にはローカルで作成したイベントのみ保存（Google Calendar 側の全イベントは保存しない）
- 家族カレンダーの予定はキャッシュしない（毎回APIで取得）

### 3. userPreferences のレコード数
- ユーザーごとに常に1レコード
- 初回アクセス時に `DEFAULT_PREFERENCES` でレコードを自動作成
- 同期時は単純な upsert（last-write-wins）

### 4. SettingsPage の肥大化対策
- 各設定セクションをサブコンポーネントに分割
  - `CalendarSettings.tsx`（カレンダー設定）
  - `MealPlanSettings.tsx`（献立設定）
  - `NotificationSettings.tsx`（通知設定）
- SettingsPage.tsx はこれらを組み立てるだけ

### 5. 未ログイン時の動作
- カレンダー設定セクション: 非表示（ログイン必要の旨を表示）
- 献立設定 / 通知設定: ローカルのみで保存・動作（ログインなしでも使用可能）
- 同期はログイン時のみ

---

## 新規ファイル一覧（Phase 4 + 5 合計）

| ファイル | Phase | 概要 |
|---------|-------|------|
| `src/lib/googleCalendar.ts` | 4 | Google Calendar REST APIクライアント |
| `src/components/CalendarRegistrationModal.tsx` | 4 | カレンダー登録モーダルUI |
| `src/utils/familyCalendarUtils.ts` | 4 | 家族カレンダー読み取り・分析 |
| `src/contexts/PreferencesContext.tsx` | 5 | 設定の状態管理Provider |
| `src/hooks/usePreferences.ts` | 5 | 設定フック |
| `src/components/CalendarSettings.tsx` | 5 | カレンダー設定UIセクション |
| `src/components/MealPlanSettings.tsx` | 5 | 献立設定UIセクション |
| `src/components/NotificationSettings.tsx` | 5 | 通知設定UIセクション |

## 変更ファイル一覧（Phase 4 + 5 合計）

| ファイル | 変更内容 |
|---------|---------|
| `src/db/db.ts` | v7スキーマ, CalendarEventRecord型, UserPreferences型 |
| `src/lib/database.types.ts` | calendar_events, user_preferences テーブル型 |
| `src/contexts/AuthContext.tsx` | providerToken追加, Calendarスコープ |
| `src/components/RecipeDetail.tsx` | カレンダー登録ボタン追加 |
| `src/pages/SettingsPage.tsx` | 3セクション追加(サブコンポーネント化) |
| `src/App.tsx` | PreferencesProvider追加 |
| `src/utils/syncManager.ts` | calendarEvents + userPreferences同期 |
| `src/utils/syncConverters.ts` | 2テーブルの変換関数追加 |
