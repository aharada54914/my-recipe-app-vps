# QA評価レポート: my-recipe-app

## 総合評価: B+ (実用可能だが改善点あり)

ビルド成功・lint errorゼロ。基本機能は一通り実装されているが、テスト不在・セキュリティ懸念・データ整合性のエッジケースなど、品質保証の観点で複数の指摘事項がある。

---

## 1. ビルド・静的解析

| 項目 | 結果 |
|------|------|
| `tsc -b` | **PASS** (エラー0) |
| `vite build` | **PASS** (8.96s) |
| `eslint` | **WARNING x2** (error 0) |
| バンドルサイズ | JS 473KB (gzip 151KB) — やや大きい |

**lint警告の詳細:**
- `RecipeList.tsx:42` — `stockNames` が毎レンダーで再生成されるため `useMemo` の依存関係が不安定。**パフォーマンスに影響する実質的なバグ**。`stockNames` を `useMemo` でラップすべき。
- `RecipeList.tsx:58` — `useVirtualizer` の返り値がメモ化不可。TanStack Virtual の既知制約で、実害は軽微。

---

## 2. テスト (CRITICAL)

**テストが一切存在しない。** `package.json` にテストフレームワーク (vitest, jest等) の依存もなく、テストスクリプトもない。

**影響範囲:**
- `recipeUtils.ts` の `formatQuantityVibe`, `calculateSalt`, `calculateSchedule` — ビジネスロジックの正確性が検証不能
- `csvParser.ts` の RFC4180パーサー — エッジケース (未閉じ引用符、空行等) の保証なし
- `searchUtils.ts` のファジー検索 — シノニム展開の網羅性未検証
- リファクタリング時のリグレッション検知手段なし

**重要度: 🔴 Critical**

---

## 3. セキュリティ

### 3-1. APIキーのlocalStorage保存 (`SettingsPage.tsx:36`)

```ts
localStorage.setItem(STORAGE_KEY, apiKey.trim())
```

- localStorageはXSS攻撃に対して脆弱。悪意のあるスクリプトが `localStorage.getItem('gemini_api_key')` で即座に取得可能。
- 対策案: サーバーサイドプロキシ経由にするか、暗号化して保存する。ただし個人用PWAであれば許容範囲。
- **重要度: 🟡 Medium** (個人利用前提なら)

### 3-2. AI Parser の URL フェッチ (`geminiParser.ts:84-89`)

```ts
const res = await fetch(url)
```

- ユーザーが入力した任意のURLを直接 `fetch` する。SSRF的な懸念はブラウザ環境では限定的だが、CORSで多くのサイトはブロックされるため、実質的にほとんどのURL取得は失敗する。
- **重要度: 🟢 Low** (ブラウザサンドボックス内)

### 3-3. JSON.parse の無検証 (`geminiParser.ts:60`)

```ts
const parsed = JSON.parse(json)
```

- AIの返り値を直接 `JSON.parse` しているが、構造の型安全性チェックが `title`, `ingredients`, `steps` の存在確認のみ。`ingredients[].quantity` が文字列だった場合など、ランタイムエラーの可能性あり。
- **重要度: 🟡 Medium**

---

## 4. データ・ロジックの正確性

### 4-1. 塩分計算 (`recipeUtils.ts:111-116`)

```ts
const saltG = Math.round((totalWeightG * mode) / 100 * 10) / 10
```

- 検証: 800g × 0.8% = 6.4g → 正しい
- CLAUDE.md の「10g単位の丸め」は**重量表示**に関する記述。塩分計算は小数点1桁丸めで正しい。
- **PASS**

### 4-2. formatQuantityVibe (`recipeUtils.ts:11-34`)

- `value === 0` かつ `unit !== '適量'` の場合 `"0g"` 等を返すが、最初の `if (unit === '適量') return '適量'` で適量は先にハンドリングされている。**ロジックは正しいが、`value === 0 && unit === '適量'` の分岐が重複** (2行目のチェックは到達不能コード)。
- **重要度: 🟢 Low** (動作に影響なし)

### 4-3. 逆算スケジュール — 日跨ぎ (`recipeUtils.ts:121-141`)

- `date-fns` の `subMinutes` を使用。深夜0時をまたぐ計算は `Date` オブジェクトが自動処理するため問題なし。
- **PASS**

### 4-4. マルチスケジュールのデバイス競合検出 (`recipeUtils.ts:156-227`)

- 競合チェックで `totalShift` を差し引いた再計算を行っているが、**シフト後の再チェックをしていない**。3つ以上のレシピが同一デバイスを使う場合、シフト後に別のスロットとさらに競合する可能性がある。
- **重要度: 🟡 Medium** (5レシピ制限があるため発生頻度は低い)

### 4-5. CSVパーサー — 重複チェック (`csvParser.ts:222-223`)

```ts
const existingTitles = new Set((await db.recipes.toArray()).map((r) => r.title))
```

- **CLAUDE.md 違反**: `db.recipes.toArray()` で全レシピをメモリにロードしている。2000件規模では問題だが、インポート時の1回限りなので実害は軽微。ただし、タイトルだけ取得する方法にすべき。
- **重要度: 🟡 Medium**

### 4-6. MultiScheduleView の全件ロード

```ts
db.recipes.toArray().then(rs => rs.map(...))
```

- 全レシピを一度に取得してセレクターリストを作成。**CLAUDE.md の「全レシピ一括ロード禁止」に違反**。2000件規模では問題。
- **重要度: 🔴 High**

---

## 5. パフォーマンス

### 5-1. RecipeList — stockNames のメモ化漏れ

`RecipeList.tsx:42`:

```ts
const stockNames = new Set(data.stockItems.map((s) => s.name))
```

毎レンダーで `new Set()` が再生成され、下流の `useMemo` (line 45-55) の依存配列 `stockNames` が常に新しいオブジェクトとなるため、**メモ化が機能していない**。全レシピの `matchRate` 再計算とソートが毎レンダー走る。

**重要度: 🔴 High**

### 5-2. カテゴリ「すべて」時の全件取得

`RecipeList.tsx:33`:

```ts
db.recipes.toArray()
```

カテゴリ「すべて」選択時は全レシピをロード。CLAUDE.mdのページネーション要件に違反。ただし仮想スクロールは実装済みなので、レンダリング負荷は抑えられている。メモリ負荷のみ問題。

**重要度: 🟡 Medium**

### 5-3. Web Worker が未使用

`search.worker.ts` は実装されているが、実際の検索は `searchUtils.ts` をメインスレッドで直接呼び出している (`RecipeList.tsx:47`)。Worker への委譲は未実装。

**重要度: 🟡 Medium** (2000件規模では体感可能なフリーズの可能性)

### 5-4. FavoritesPage — 仮想スクロール未適用

`FavoritesPage.tsx:41-49` で `recipes.map()` により全件を直接DOMレンダリング。お気に入りが数百件になると問題。

**重要度: 🟢 Low** (お気に入りは通常少数)

### 5-5. バンドルサイズ

メインチャンク 473KB (gzip 151KB)。`@google/generative-ai` が静的インポートされており、AI機能不使用時もロードされる。`SettingsPage.tsx` はdynamic importしているが、`geminiParser.ts` が静的インポートのためチャンク分割が効いていない。

**重要度: 🟡 Medium**

---

## 6. UX / アクセシビリティ

### 6-1. ボタンのaria-label欠如

`Header.tsx`, `BottomNav.tsx` などのアイコンのみのボタンに `aria-label` がない。スクリーンリーダーでは「ボタン」としか読み上げられない。

**重要度: 🟡 Medium**

### 6-2. BottomNav の safe-area 未考慮

`BottomNav.tsx:19`: `fixed bottom-0` でsafe-area paddingが適用されない。iPhone X以降のホームバー領域とナビゲーションが重なる可能性。`body` にsafe-area paddingはあるが、fixed要素には効かない。

**重要度: 🟡 Medium**

### 6-3. homeタブとsearchタブが同じURLにナビゲート

`App.tsx:50-51`:

```ts
case 'home': navigate('/'); break
case 'search': navigate('/'); break
```

URL上の区別がないため、ブラウザバックで意図しないタブ状態になる。Deep linkやURL共有もできない。

**重要度: 🟡 Medium**

### 6-4. RecipeDetailPage の initDb 二重呼び出し

`App.tsx:106-107`: `RecipeDetailPage`, `AiParsePage`, `MultiSchedulePage`, `ImportPageWrapper` がそれぞれ独自に `initDb()` を呼ぶ。`AppShell` と合わせて最大5回。`initDb` は冪等 (`count > 0` でスキップ) だが、不要なDB呼び出し。

**重要度: 🟢 Low**

### 6-5. useWakeLock のリソースリーク

`useWakeLock.ts:19-21`: `wakeLock.request` 成功時にクリーンアップ関数を返しているが、`enable` は async 関数で `useEffect` のクリーンアップには組み込まれていない。ネイティブ Wake Lock API 使用時、アンマウントでロックが解放されない。

**重要度: 🟡 Medium**

---

## 7. PWA

### 7-1. Service Worker 未実装

`manifest.json` は存在するが、Service Worker が登録されていない。オフライン動作不可。CLAUDE.mdで「PWA: Offline support, installable app」と言及あり。

**重要度: 🟡 Medium** (PWA要件として)

### 7-2. manifest.json のアイコン不足

`vite.svg` 1つのみ。`sizes: "any"` で、192x192, 512x512 のPNGアイコンがない。多くのブラウザでインストールバナーが表示されない。

**重要度: 🟡 Medium**

---

## 8. エラーハンドリング

### 8-1. initDb 失敗時のハンドリング欠如

`App.tsx:22`: `initDb().then(() => setReady(true))` — `.catch` がなく、IndexedDB初期化失敗 (プライベートブラウジング等) 時に永遠にローディング状態。

**重要度: 🟡 Medium**

### 8-2. AiRecipeParser のエラーリカバリ

`AiRecipeParser.tsx:42-45`: `handleSave` でDB保存失敗時のcatchがない。ネットワーク復帰後のリトライUXもない。

**重要度: 🟢 Low**

---

## 指摘事項サマリー

| 重要度 | 件数 | 主な内容 |
|--------|------|----------|
| 🔴 Critical | 1 | テスト完全不在 |
| 🔴 High | 2 | stockNames メモ化漏れ、MultiScheduleView 全件ロード |
| 🟡 Medium | 11 | APIキー保存、AI応答バリデーション、CSV全件ロード、Worker未使用、aria-label欠如、BottomNav safe-area、URL未分離、バンドルサイズ、Wake Lock リーク、Service Worker未実装、initDb エラー未処理 |
| 🟢 Low | 4 | 到達不能コード、FavoritesPage仮想スクロール無し、initDb重複呼出、AI保存エラー未処理 |

---

## 優先対応推奨 (Top 5)

1. **テストフレームワーク導入** — vitest + `recipeUtils`, `csvParser`, `searchUtils` のユニットテスト
2. **`stockNames` の `useMemo` ラップ** — `RecipeList.tsx:42` (1行修正で大幅改善)
3. **`MultiScheduleView` のレシピセレクター軽量化** — `toArray()` → ページネーションまたはタイトルのみの軽量クエリ
4. **`useWakeLock` の Wake Lock 解放修正** — ネイティブAPI使用時のクリーンアップ実装
5. **`initDb()` のエラーハンドリング追加** — catch + ユーザー向けエラー表示
