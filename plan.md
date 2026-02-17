# Phase 1: Supabase基盤構築 — 実装計画 ✅ 実装済み

> Phase 1は実装完了。詳細は git log を参照。

---

# Phase 2: Google OAuth認証 — 実装計画

## 概要

Supabase Authを使ったGoogle OAuthログイン機能を実装する。
認証状態はアプリ全体で共有する必要があるため`AuthContext`を作成し、SettingsPageにログインUIを追加する。

**重要な方針**:
- ログインは任意。未ログインでも既存機能はすべてオフラインで動作
- Supabase環境変数が未設定の場合、認証UIは非表示
- Google Cloud Console / Supabase Dashboard の設定は手動（コードでは制御しない）

---

## 前提: Supabase Dashboard での手動設定

以下はコード外の設定作業（ユーザーが実施）:

1. **Supabase Dashboard** → Authentication → Providers → Google を有効化
2. **Google Cloud Console** → OAuth 2.0 Client ID を作成
   - Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`
3. Client ID / Client Secret を Supabase Dashboard に入力
4. `.env` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定

---

## Step 1: AuthContext の作成

**新規ファイル**: `src/contexts/AuthContext.tsx`

```typescript
// 提供する値:
interface AuthContextValue {
  user: User | null          // Supabase User オブジェクト
  loading: boolean           // 初回セッション確認中
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}
```

**実装方針**:
- `supabase` が `null`（env未設定）の場合: `user` は常に `null`、ログイン関数はno-op
- `supabase.auth.getSession()` で初回セッション復元
- `supabase.auth.onAuthStateChange()` でリアルタイム状態監視
- `signInWithGoogle`: `supabase.auth.signInWithOAuth({ provider: 'google' })`
- `signOut`: `supabase.auth.signOut()`

---

## Step 2: App.tsx に AuthProvider を追加

**変更ファイル**: `src/App.tsx`

```typescript
// Before:
<BrowserRouter>
  <Routes>...</Routes>
</BrowserRouter>

// After:
<AuthProvider>
  <BrowserRouter>
    <Routes>...</Routes>
  </BrowserRouter>
</AuthProvider>
```

**ポイント**:
- `AuthProvider` は `BrowserRouter` の外側に配置（認証はルーティングと独立）
- 既存の `initDb()` 呼び出しには影響しない

---

## Step 3: useAuth フックの作成

**新規ファイル**: `src/hooks/useAuth.ts`

```typescript
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

---

## Step 4: SettingsPage にログインUI追加

**変更ファイル**: `src/pages/SettingsPage.tsx`

既存のGemini APIキーセクションの**上**に「アカウント」セクションを追加:

```
┌─────────────────────────────────────┐
│ アカウント                           │
│                                     │
│ (未ログイン時)                       │
│ [🔵 Googleでログイン]               │
│ ログインするとデータがクラウドに      │
│ 同期され、機種変更時も復元できます    │
│                                     │
│ (ログイン時)                         │
│ 📧 user@gmail.com                   │
│ ☁️ 同期: 有効                       │
│ [ログアウト]                         │
└─────────────────────────────────────┘
```

**UI要素**:
- 未ログイン: Googleログインボタン + 説明テキスト
- ログイン済み: ユーザーメール表示 + 同期ステータス + ログアウトボタン
- `supabase === null` の場合: セクション自体を非表示

---

## Step 5: OAuth コールバック処理

**方針**: Supabase JS SDKが自動的にURLハッシュからトークンを取得するため、
専用のコールバックページは不要。`AuthContext`内の`onAuthStateChange`で検知される。

ただし、OAuth後のリダイレクト先を明示するため:

```typescript
signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin + '/settings'
  }
})
```

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/contexts/AuthContext.tsx` | 新規 | AuthProvider + AuthContextValue |
| `src/hooks/useAuth.ts` | 新規 | useAuth カスタムフック |
| `src/App.tsx` | 変更 | AuthProvider でラップ |
| `src/pages/SettingsPage.tsx` | 変更 | アカウントセクション追加 |

**既存機能への影響**: なし（ログインは任意、Supabase未設定時はUI非表示）

---

# Phase 3: データ同期機能 — 実装計画

## 概要

Dexie（ローカル）とSupabase（クラウド）間の双方向データ同期を実装する。
オフラインファーストを維持し、オンライン時に自動同期する。

**同期対象テーブル**: stock, favorites, userNotes, viewHistory
（recipesのプリビルドデータは同期しない。ユーザー作成レシピのみ同期対象）

---

## 設計方針

### ID体系の統一

**課題**: Dexie = auto-increment number / Supabase = UUID string

**解決策**: Dexie v6 スキーマアップグレードで `supabaseId` フィールドを追加

```typescript
// db.ts v6
this.version(6).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device], imageUrl, supabaseId',
  stock: '++id, &name, inStock, supabaseId',
  favorites: '++id, &recipeId, addedAt, supabaseId',
  userNotes: '++id, &recipeId, updatedAt, supabaseId',
  viewHistory: '++id, recipeId, viewedAt, supabaseId',
})
```

各ローカルレコードに `supabaseId?: string` を追加:
- 未同期レコード: `supabaseId` = undefined
- 同期済みレコード: `supabaseId` = Supabase UUID

---

### camelCase ↔ snake_case 変換

**新規ファイル**: `src/utils/syncConverters.ts`

```typescript
// Dexie → Supabase: camelCase → snake_case + フィールドマッピング
export function stockToCloud(item: StockItem, userId: string): StockInsert
export function favoriteToCloud(fav: Favorite, userId: string, recipeSupabaseId: string): FavoriteInsert

// Supabase → Dexie: snake_case → camelCase
export function stockFromCloud(row: StockRow): Omit<StockItem, 'id'>
export function favoriteFromCloud(row: FavoriteRow): Omit<Favorite, 'id'>
```

---

### 同期フロー

```
1. Push (Local → Cloud)
   ├─ supabaseId が未設定のレコードを検出
   ├─ Supabase に INSERT
   ├─ 返された UUID を Dexie の supabaseId に保存
   └─ 更新されたレコード（updatedAt がクラウドより新しい）を UPSERT

2. Pull (Cloud → Local)
   ├─ Supabase から全レコードを取得（RLSで自動フィルタ）
   ├─ supabaseId でローカルレコードとマッチング
   ├─ ローカルに存在しない → 新規追加
   ├─ クラウドの updated_at がローカルより新しい → 上書き
   └─ ローカルにあるがクラウドにない → 削除済みとして削除

3. 競合解決: Last-Write-Wins (updated_at 比較)
```

---

## Step 1: Dexie スキーマ v6 アップグレード

**変更ファイル**: `src/db/db.ts`

- 全テーブルの型に `supabaseId?: string` と `updatedAt?: Date` を追加
- v6 スキーマで `supabaseId` インデックスを追加
- 既存のDexie操作はそのまま動作（新フィールドはオプショナル）

---

## Step 2: 変換ユーティリティ作成

**新規ファイル**: `src/utils/syncConverters.ts`

各テーブルごとに以下を定義:
- `toCloud()`: Dexie → Supabase Insert/Update 変換
- `fromCloud()`: Supabase Row → Dexie レコード変換

**注意**: `favorites`と`userNotes`は`recipe_id`がUUIDなので、
レシピのローカルID → supabaseId の解決が必要。

---

## Step 3: 同期マネージャー作成

**新規ファイル**: `src/utils/syncManager.ts`

```typescript
interface SyncResult {
  pushed: number
  pulled: number
  errors: string[]
}

/**
 * 全テーブルの双方向同期を実行
 */
export async function syncAll(userId: string): Promise<SyncResult>
```

**同期順序**（依存関係考慮）:
1. `recipes`（他テーブルが参照する）
2. `stock`（独立）
3. `favorites`（recipe_id に依存）
4. `userNotes`（recipe_id に依存）
5. `viewHistory`（recipe_id に依存）

**各テーブルの同期ロジック**:
```typescript
async function syncTable<TLocal, TCloud>(options: {
  localTable: Table<TLocal>
  cloudTable: string
  toCloud: (local: TLocal, userId: string) => CloudInsert
  fromCloud: (cloud: CloudRow) => Omit<TLocal, 'id'>
  getSupabaseId: (local: TLocal) => string | undefined
  setSupabaseId: (local: TLocal, uuid: string) => TLocal
}): Promise<{ pushed: number; pulled: number }>
```

---

## Step 4: useSync フック作成

**新規ファイル**: `src/hooks/useSync.ts`

```typescript
interface UseSyncReturn {
  isSyncing: boolean
  lastSyncedAt: Date | null
  syncNow: () => Promise<void>
  error: string | null
}

export function useSync(): UseSyncReturn
```

**自動同期スケジュール**:
- ログイン直後: 即時同期
- オンライン復帰時: 即時同期（`navigator.onLine` + `online` イベント）
- 定期同期: 5分ごと（`setInterval`）
- 手動同期: SettingsPageの「今すぐ同期」ボタン

**同期タイミング管理**:
- `lastSyncedAt` を `localStorage` に保存
- 同期中は `isSyncing = true`（UIにインジケーター表示）
- エラー時は `error` にメッセージをセット

---

## Step 5: SettingsPage に同期UIを追加

**変更ファイル**: `src/pages/SettingsPage.tsx`

Phase 2で追加したアカウントセクションを拡張:

```
┌─────────────────────────────────────┐
│ アカウント                           │
│ 📧 user@gmail.com                   │
│                                     │
│ ☁️ 同期ステータス                    │
│ 最終同期: 2分前                      │
│ [🔄 今すぐ同期]                     │
│                                     │
│ [ログアウト]                         │
└─────────────────────────────────────┘
```

---

## Step 6: App.tsx に SyncProvider 追加

**変更ファイル**: `src/App.tsx`

```typescript
<AuthProvider>
  <BrowserRouter>
    <SyncProvider>  {/* ログイン時のみ自動同期を開始 */}
      <Routes>...</Routes>
    </SyncProvider>
  </BrowserRouter>
</AuthProvider>
```

**SyncProviderの責務**:
- `useAuth()` から `user` を取得
- `user` が存在する場合のみ自動同期タイマーを起動
- ログアウト時にタイマーをクリア

---

## 変更ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/db/db.ts` | 変更 | v6スキーマ + supabaseId フィールド追加 |
| `src/utils/syncConverters.ts` | 新規 | camelCase ↔ snake_case 変換 |
| `src/utils/syncManager.ts` | 新規 | 双方向同期ロジック |
| `src/hooks/useSync.ts` | 新規 | 自動同期フック + SyncProvider |
| `src/pages/SettingsPage.tsx` | 変更 | 同期ステータスUI追加 |
| `src/App.tsx` | 変更 | SyncProvider でラップ |

---

## 設計上の判断ポイント

### 1. プリビルドレシピの同期
- ~1700件のプリビルドレシピはクラウドに同期**しない**
- 理由: 全ユーザー共通データであり、アプリバンドルに含まれている
- ユーザーがAI解析で追加したレシピ（`supabaseId`あり）のみ同期対象

### 2. favorites / userNotes の recipe_id 解決
- ローカルの `recipeId` (number) → Supabase の `recipe_id` (UUID) への変換が必要
- プリビルドレシピはクラウドに存在しないため、Supabaseの`recipes`テーブルにも公開レシピとしてseed投入するか、もしくはfavorites/notesはローカルIDをそのまま文字列として保持するか
- **推奨**: プリビルドレシピもSupabaseに `user_id = NULL` で投入し、ローカルIDとの対応テーブルを持つ

### 3. 削除の同期
- クラウドにあるがローカルにないレコード → クラウド側で削除された
- ローカルにあるがクラウドにないレコード → 新規作成（push対象）
- 判別: `supabaseId` が設定済みなのにクラウドに存在しない → 削除済み

### 4. オフライン時のキュー
- Phase 3初期ではキューを実装しない（シンプルさ優先）
- オフライン中の変更はDexieに保存され、次回オンライン時の同期で push される
- `supabaseId` が未設定 = 未同期という状態で自然に検出可能

### 5. 同期の粒度
- テーブル単位で全件同期（差分同期ではない）
- 理由: データ量が小さい（stock ~100件、favorites ~50件、notes ~20件）
- viewHistory のみ最新200件に制限

---

## 実装順序

```
Phase 2: Google OAuth認証
  Step 1: AuthContext.tsx 作成
  Step 2: App.tsx に AuthProvider 追加
  Step 3: useAuth.ts フック作成
  Step 4: SettingsPage.tsx にログインUI追加
  Step 5: ビルド確認
  ↓
Phase 3: データ同期機能
  Step 1: db.ts v6 スキーマアップグレード
  Step 2: syncConverters.ts 作成
  Step 3: syncManager.ts 作成
  Step 4: useSync.ts + SyncProvider 作成
  Step 5: SettingsPage.tsx に同期UI追加
  Step 6: App.tsx に SyncProvider 追加
  Step 7: ビルド確認
```
