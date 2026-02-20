# リファクタリング計画 v8.0

> **ベース**: `master-refactoring-plan.md` (12ステップ)
> **改訂方針**: 工数削減より「UXの最善」と「メンテしやすさ」を最優先
> **作成日**: 2026-02-20

---

## 改訂ポイントのまとめ

| 論点 | v7 (誤り) | v8 (改訂) |
|------|----------|----------|
| BottomNav タブ名 | "AI" | **"Gemini"** (公式アイコン風カスタム SVG) |
| クラウドバックアップ | Supabase 継続（工数優先） | **Google Drive に移行**（UX 優先） |
| グローバル状態管理 | Zustand（工数削減が理由） | **Zustand**（メンテしやすさが理由 ← 理由を修正） |

---

## 前提：現状分析

### Supabase を外す理由（UX 観点）

現状のアーキテクチャ:
```
ユーザー → "Googleでログイン" → Supabase OAuth → Supabase DB に同期
```

問題: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を Vercel に設定するだけでなく、
Supabase 側でもプロジェクト作成・テーブル定義・RLS ポリシー・Google OAuth 設定が必要。
複数人が使う PWA で「自分のデータを自分のアカウントにバックアップしたい」という要件に対し、
共有 Supabase インスタンスはデータ分離に RLS が必要で構造的に複雑。

置き換え後:
```
ユーザー → "Googleでログイン" (GIS) → 自分の Google Drive に JSON 保存
```

- ユーザーがボタン1つで完結（UX 最善）
- 各自のデータは各自の Drive に格納（プライバシー自然に担保）
- 開発者は Google Cloud Console で OAuth クライアント ID を取得し Vercel に設定するだけ
- Supabase プロジェクト・テーブル・RLS が不要になる

### Zustand を使う理由（メンテしやすさ観点）

現状の問題点:
- `PreferencesContext` が巨大 → Context の value が変わると全消費コンポーネントが再レンダリング
- ページをまたぐ UI 状態（モーダル開閉・選択アイテム）が `useState` で各コンポーネントに散在
- `WeeklyMenuPage` の状態が 1 コンポーネントに詰め込まれていて可読性が低い

Zustand が解決する点:
- **細粒度サブスクリプション**: `useStore(s => s.modalOpen)` のように必要な値だけ購読 → 無駄な再レンダリングがない
- **stores/ ディレクトリ** でドメインごとに分割 → どこに何があるか明確
- **DevTools 対応** → Chrome 拡張で状態変化が追跡できる
- **Context と共存可能** → AuthContext（頻度低・アプリ全体）は Context のまま残す

> NOTE: DB の読み取り（`useLiveQuery`）はそのまま Dexie に任せる。
> Zustand は DB に永続化しない「画面の状態」のみ管理する。

---

## フェーズ A：基盤強化（優先度 🔴）

### ステップ 1 — Supabase → Google Drive バックアップへ移行

**工数: 4h**
**UX 優先度: 最高** — ユーザー体験に最も直結する変更

#### 1-1. Google Identity Services (GIS) の導入

```bash
npm install @react-oauth/google
```

```typescript
// src/lib/googleAuth.ts — 新規
// Google Identity Services 直接統合
// Supabase を経由せず Google OAuth を処理する

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',      // App-specific Drive folder
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')
```

`drive.appdata` スコープ: ユーザーの Drive に隠し appdata フォルダを作成 → アプリ専用領域でありユーザーの通常ファイルと混在しない。

#### 1-2. AuthContext の置き換え

```
src/contexts/AuthContext.tsx   ← Supabase → GIS に書き換え
src/lib/supabase.ts            ← 削除
src/lib/database.types.ts      ← 削除
src/utils/syncConverters.ts    ← 削除
src/utils/syncManager.ts       ← 削除（Drive バックアップに置換）
src/hooks/useSync.ts           ← useGoogleDriveSync.ts に置換
```

提供するインターフェース（後続コードへの影響最小化）:

```typescript
// AuthContext が提供する値（変更後も同じ形を維持）
interface AuthContextValue {
  user: GoogleUser | null          // email, name, picture
  loading: boolean
  providerToken: string | null     // Google access token（Calendar API 用）
  signInWithGoogle: () => void
  signOut: () => void
}
```

#### 1-3. Google Drive バックアップ実装

```
src/lib/googleDrive.ts   ← 新規
```

```typescript
// バックアップ対象データ
interface BackupData {
  version: number
  exportedAt: string
  stock: StockItem[]
  favorites: Favorite[]
  userNotes: UserNote[]
  viewHistory: ViewHistory[]
  weeklyMenus: WeeklyMenu[]
  preferences: UserPreferences
}

// 主要関数
export async function backupToGoogleDrive(token: string, data: BackupData): Promise<void>
export async function restoreFromGoogleDrive(token: string): Promise<BackupData | null>
```

バックアップ戦略:
- ファイル名: `my-recipe-app-backup.json`（`appdata` フォルダ内）
- 起動時: ログイン済みなら Drive から読み込み → IndexedDB にリストア
- 変更時: 変更後 30 秒デバウンスで自動バックアップ（`useGoogleDriveSync`）

#### 1-4. Settings UI の簡略化

変更前（アカウントタブ）:
- Supabase 設定状況表示
- 同期ステータス・最終同期時刻
- 複雑な状態表示

変更後（アカウントタブ）:
```
[Googleでログイン] / [ログアウト]
ユーザー名・アイコン
最終バックアップ: ○月○日 ○時○分
[今すぐバックアップ]
[Google Driveからリストア]
```

ユーザーに見せる情報を最小化。バックアップ状況のみシンプルに表示。

---

### ステップ 2 — Zustand によるグローバル状態管理

**工数: 3h**

```bash
npm install zustand
```

#### 作成するストア

```
src/stores/
├── preferencesStore.ts   ← PreferencesContext を置き換え
├── weeklyMenuStore.ts    ← WeeklyMenuPage の状態を抽出
└── uiStore.ts            ← モーダル・ローディング・選択状態
```

**preferencesStore.ts** — なぜ Context ではなくストアか:
```typescript
// Context: preferences が変わると <PreferencesContext.Provider> 以下が全部再レンダリング
// Zustand: usePreferencesStore(s => s.saltPreset) のように
//          saltPreset だけを購読するコンポーネントは他の変更で再レンダリングしない

const usePreferencesStore = create<PreferencesState>((set) => ({
  saltPreset: '標準' as SaltPreset,
  servings: 4,
  mealHour: 18,
  mealMinute: 30,
  geminiApiKey: '',
  // ...
  setSaltPreset: (preset) => set({ saltPreset: preset }),
  // 初期値は IndexedDB から loadPreferences() で読み込む（App.tsx 起動時）
}))
```

**weeklyMenuStore.ts** — WeeklyMenuPage から抽出する状態:
```typescript
interface WeeklyMenuStore {
  menuItems: Record<string, Recipe | null>  // 曜日 → レシピ
  isGenerating: boolean
  selectedDay: string | null
  alternativeModalOpen: boolean
  alternativeSearchQuery: string
  shoppingListOpen: boolean
  setMenuItem: (day: string, recipe: Recipe | null) => void
  // ...
}
```

**uiStore.ts** — 横断的 UI 状態:
```typescript
interface UIStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}
```

#### 移行対象（段階的）

| 移行元 | 移行先 | 理由 |
|--------|--------|------|
| `PreferencesContext` | `preferencesStore` | 全体再レンダリング防止 |
| `WeeklyMenuPage` の多数の `useState` | `weeklyMenuStore` | コンポーネント分割を可能にする |
| 各所の toast/loading 状態 | `uiStore` | 共通インフラ化 |
| `AuthContext` | **そのまま Context 維持** | 認証状態は変化頻度が低く全体提供が適切 |
| `useLiveQuery` | **そのまま維持** | DB 反応性は Dexie が最適 |

---

### ステップ 3 — ルーティング整理（MainLayout）

**工数: 1.5h**

現状: `AppLayout` が Header + BottomNav を持つ。このまま活用。
変更: `AppLayout.tsx` → `MainLayout.tsx` にリネームし責務を明文化。

追加ルート:
```typescript
<Route path="/gemini" element={<AskGeminiPage />} />
```

---

### ステップ 4 — テストカバレッジ向上

**工数: 2h**

| ファイル | テスト内容 |
|---------|-----------|
| `weeklyMenuSelector.ts` | スコアリング、副菜選択ロジック |
| `googleDrive.ts`（新規） | バックアップ/リストアのデータ変換 |
| `weeklyShoppingUtils.ts` | 食材マージ・同一名集約 |

---

## フェーズ B：機能改善（優先度 🟡）

### ステップ 5 — BottomNav: 在庫 → Gemini タブ

**工数: 2h（アイコン実装含む）**

#### Gemini アイコン（公式ロゴをイメージ）

Gemini の公式ロゴは「4方向に伸びる流線形の星」——上下方向に長く左右に短い、やわらかい曲線の四芒星。

```typescript
// src/components/GeminiIcon.tsx — 新規作成
interface GeminiIconProps {
  className?: string
}

export function GeminiIcon({ className }: GeminiIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 公式 Gemini ロゴ: 上下に長い四芒星 */}
      <path d="M12 2C12 8.8 15.2 12 22 12C15.2 12 12 15.2 12 22C12 15.2 8.8 12 2 12C8.8 12 12 8.8 12 2Z" />
    </svg>
  )
}
```

BottomNav の変更:
```typescript
// 変更前
{ id: 'stock', path: '/stock', icon: Package, label: '在庫' }

// 変更後
{ id: 'gemini', path: '/gemini', icon: GeminiIcon, label: 'Gemini' }
```

アクティブ時のカラー: 既存の accent orange `#F97316` → Gemini ブランドカラー (`#4285F4` / `#8A7EDF`) も選択肢として検討。ただし、アプリ全体のデザインシステム（accent orange）と統一するなら orange のままが自然。

在庫管理へのアクセス:
- ホームページの「在庫を管理」セクションから引き続きアクセス可能
- `Header` の ... メニューからもアクセス

---

### ステップ 6 — AskGeminiPage の新規作成

**工数: 3h**

```
src/pages/AskGeminiPage.tsx  ← 新規
```

3タブ構成:

```
[レシピをインポート] [在庫から提案] [レシピを質問]
```

**タブ 1: URL からレシピインポート**
- 既存 `AiRecipeParser.tsx` のロジックを移植
- URL 入力 → Gemini で解析 → レシピ保存

**タブ 2: 在庫から献立を提案**
- `db.stock.filter(s => s.quantity > 0)` → 在庫食材一覧取得
- 「献立を提案してもらう」ボタン → Gemini API に在庫リストを渡す
- レスポンスをカード形式で表示（既存 `geminiRecommender.ts` を活用/拡張）

**タブ 3: レシピを自由に質問**
- テキスト入力 → Gemini に送信 → 回答表示
- API キー未設定の場合: SettingsPage へ誘導

---

### ステップ 7 — 代替レシピモーダルに検索機能追加

**工数: 2h**

`WeeklyMenuPage.tsx` の代替レシピ選択モーダル:
- `Fuse.js`（インストール済み）+ `synonyms.ts` で検索バーを追加
- `weeklyMenuStore.alternativeSearchQuery` で検索状態を管理

---

### ステップ 8 — 買い物リストの改善

**工数: 1.5h**

```
src/components/EditableShoppingList.tsx  ← 新規
```

- チェックオフで購入済み管理（`localStorage` に保存）
- 調味料グループを分離表示
- LINE シェアボタン（既存 `shoppingUtils.ts` 活用）

---

### ステップ 9 — `selectWeeklyMenu` の改善

**工数: 1h**

ランダムオフセットによる偏りのないサンプリング:
```typescript
const count = await db.recipes.count()
const offset = Math.floor(Math.random() * Math.max(0, count - 200))
return db.recipes.offset(offset).limit(200).toArray()
```

---

### ステップ 10 — `MultiScheduleView` 検索を Fuse.js に統一

**工数: 1h**

ホーム検索と同じ検索体験に統一（部分一致・表記ゆれ対応）。

---

### ステップ 11 — お気に入りメニュー機能

**工数: 2.5h**

`WeeklyMenuPage.tsx` に「お気に入りから選ぶ」横スクロールセクションを追加。
お気に入りレシピ → タップで曜日に割り当て。

---

## フェーズ C：開発体験向上（優先度 🟢）

### ステップ 12 — テスト & CI/CD

**工数: 2h**

```yaml
# .github/workflows/ci.yml
- npm run lint
- npm run test
- npm run build
```

---

## 実装順序と依存関係

```
[ステップ1: Google Drive 移行]
        ↓
[ステップ2: Zustand 導入]
        ↓
[ステップ3: ルーティング整理]
        ↓
[ステップ4: テスト]        ← 並行可
        ↓
[ステップ5: Gemini タブ + アイコン]
        ↓
[ステップ6: AskGeminiPage]
        ↓
[ステップ7-11: 各機能改善]  ← 独立して並行可
        ↓
[ステップ12: CI/CD]
```

---

## 工数サマリー

| フェーズ | ステップ | 内容 | 工数 |
|---------|---------|------|------|
| A | 1 | Google Drive 移行（Supabase 廃止） | 4h |
| A | 2 | Zustand 導入 | 3h |
| A | 3 | ルーティング整理 | 1.5h |
| A | 4 | テストカバレッジ向上 | 2h |
| B | 5 | Gemini タブ + GeminiIcon | 2h |
| B | 6 | AskGeminiPage 新規作成 | 3h |
| B | 7 | 代替レシピ検索強化 | 2h |
| B | 8 | 買い物リスト改善 | 1.5h |
| B | 9 | selectWeeklyMenu 改善 | 1h |
| B | 10 | MultiScheduleView 検索統一 | 1h |
| B | 11 | お気に入りメニュー | 2.5h |
| C | 12 | CI/CD | 2h |
| **合計** | | | **約 25.5h** |

---

## 削除されるファイル（Supabase 廃止に伴う）

```
src/lib/supabase.ts
src/lib/database.types.ts
src/utils/syncConverters.ts
src/utils/syncManager.ts
src/hooks/useSync.ts
```

## 追加されるファイル

```
src/lib/googleAuth.ts          (GIS 統合)
src/lib/googleDrive.ts         (Drive API)
src/hooks/useGoogleDriveSync.ts
src/stores/preferencesStore.ts
src/stores/weeklyMenuStore.ts
src/stores/uiStore.ts
src/components/GeminiIcon.tsx
src/pages/AskGeminiPage.tsx
src/components/EditableShoppingList.tsx
```
