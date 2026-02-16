# PWAアプリでのGemini API活用とレシピ保存機能の不足機能分析

## 現在の実装状況

### 既に実装されている機能

1. **Gemini APIの基本統合**
   - `@google/generative-ai` パッケージ導入済み
   - `src/utils/geminiParser.ts` でGemini API呼び出しを実装
   - モデル: `gemini-2.0-flash` を使用
   - APIキー管理: 環境変数 (`VITE_GEMINI_API_KEY`) とlocalStorage対応

2. **テキストベースのレシピ解析**
   - `parseRecipeText()`: テキストからレシピをJSON形式に解析
   - 構造化されたレシピデータへの変換（材料、工程、時間など）
   - AI生成レシピ番号の自動付与

3. **URLからのレシピ取得（基本実装）**
   - `parseRecipeFromUrl()`: URLからHTMLを取得してテキスト抽出
   - DOMParserを使用したHTMLタグの除去
   - 抽出したテキストをGemini APIで解析

4. **UIコンポーネント**
   - `AiRecipeParser.tsx`: AIレシピ解析画面
   - テキスト入力とURL入力の両対応
   - プレビュー機能と保存機能
   - エラーハンドリングとローディング状態表示

5. **データベース統合**
   - Dexie (IndexedDB) を使用したローカルストレージ
   - レシピの保存と管理機能
   - お気に入り、ユーザーノート、閲覧履歴の管理

6. **設定画面**
   - APIキーの保存・編集・テスト機能
   - セキュアな表示（マスキング機能）

## 不足している機能

### 1. レシピ提案機能（完全に未実装）

現在のアプリには、Gemini APIを使った**能動的なレシピ提案機能**が実装されていません。

#### 不足している要素：

- **在庫ベースの提案**: 現在の在庫から作れるレシピを提案
- **条件指定の提案**: カロリー、調理時間、カテゴリなどの条件に基づく提案
- **旬の食材を使った提案**: 季節に応じたレシピ提案
- **過去の履歴ベースの提案**: ユーザーの好みに基づくパーソナライズされた提案
- **提案結果の表示UI**: 複数のレシピ候補を表示するインターフェース
- **提案からの保存フロー**: 提案されたレシピをワンクリックで保存

### 2. URL先からのレシピ取得の高度化

現在の実装は基本的なHTML取得のみで、実用性に課題があります。

#### 不足している要素：

- **構造化データの抽出**: 
  - Schema.org (JSON-LD) のレシピデータ対応
  - Open Graph メタデータの活用
  - 専用のレシピサイト（クックパッド、楽天レシピなど）への最適化

- **画像の自動取得と保存**:
  - レシピ画像のURLを抽出
  - 画像のダウンロードとローカル保存
  - サムネイル生成
  - BlurHash生成（既存のスキーマに対応）

- **エラーハンドリングの強化**:
  - CORS制約への対応（現在はブラウザから直接fetchするため失敗しやすい）
  - リダイレクトやJavaScript動的レンダリングへの対応
  - タイムアウト処理

- **プロキシサーバー/バックエンドの必要性**:
  - CORSを回避するためのサーバーサイド実装
  - より確実なスクレイピング（Selenium/Puppeteer）
  - recipe-scraper skillの活用

### 3. レシピ保存機能の拡張

基本的な保存機能は実装済みですが、以下が不足しています。

#### 不足している要素：

- **重複チェック**: 同じレシピを複数回保存しないための検証
- **編集機能**: 保存後のレシピを編集する機能
- **タグ付け**: カスタムタグによる分類
- **インポート/エクスポート**: レシピデータのバックアップと復元
- **共有機能**: レシピを他のユーザーと共有

### 4. Gemini APIの活用拡張

現在はレシピ解析のみですが、以下の活用が可能です。

#### 不足している要素：

- **レシピの改善提案**: 既存レシピの健康的なアレンジ提案
- **代替材料の提案**: 不足している材料の代替案
- **質問応答機能**: レシピに関する質問に回答
- **調理アドバイス**: 工程ごとの詳細なアドバイス
- **栄養情報の推定**: カロリーや栄養素の自動計算

### 5. PWA機能の強化

#### 不足している要素：

- **オフライン対応の完全化**: 
  - Gemini API呼び出しのオフライン時のキュー管理
  - オフライン時の代替機能提供

- **プッシュ通知**:
  - 新しいレシピ提案の通知
  - 在庫切れアラート

### 6. バックエンド連携

現在は完全にクライアントサイドで動作していますが、以下の機能にはバックエンドが必要です。

#### 不足している要素：

- **サーバーサイドスクレイピング**: CORS制約を回避したURL取得
- **データ同期**: 複数デバイス間でのデータ共有
- **ユーザー認証**: アカウントベースの機能
- **API使用量の管理**: Gemini APIの使用量制限と監視

## 優先度付き実装推奨順序

### 高優先度（即座に実装すべき）

1. **レシピ提案機能の基本実装**
   - 在庫ベースの提案
   - 条件指定の提案
   - 提案結果表示UI

2. **URL取得の改善**
   - Schema.org対応
   - 画像URL抽出
   - エラーハンドリング強化

### 中優先度（機能拡張として有用）

3. **レシピ編集機能**
4. **重複チェック機能**
5. **代替材料提案**
6. **画像の自動保存**

### 低優先度（将来的な拡張）

7. **バックエンド構築**
8. **プッシュ通知**
9. **データ同期**
10. **高度なパーソナライズ**

## 技術的な実装アプローチ

### レシピ提案機能の実装案

```typescript
// src/utils/geminiRecommender.ts
export async function recommendRecipes(params: {
  stockItems?: string[]
  maxCalories?: number
  maxTime?: number
  category?: RecipeCategory
  count?: number
}): Promise<Recipe[]> {
  const genAI = new GoogleGenerativeAI(getApiKey())
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  
  const prompt = buildRecommendationPrompt(params)
  const result = await model.generateContent(prompt)
  const recipes = parseRecommendationResponse(result.response.text())
  
  return recipes
}
```

### URL取得の改善案

```typescript
// src/utils/recipeExtractor.ts
export async function extractRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  // 1. Try structured data (JSON-LD)
  const structuredData = await fetchStructuredData(url)
  if (structuredData) {
    return parseStructuredRecipe(structuredData)
  }
  
  // 2. Fallback to Gemini parsing
  const html = await fetchHtml(url)
  const text = extractTextFromHtml(html)
  const imageUrl = extractImageUrl(html)
  
  const recipe = await parseRecipeText(text)
  return { ...recipe, imageUrl, sourceUrl: url }
}
```

### バックエンドプロキシの実装案（Vercel Functions）

```typescript
// api/scrape-recipe.ts
export default async function handler(req, res) {
  const { url } = req.query
  
  const response = await fetch(url)
  const html = await response.text()
  
  // Extract structured data
  const recipe = extractRecipeData(html)
  
  res.json(recipe)
}
```

## まとめ

現在のアプリは**レシピ解析とURL取得の基礎**は実装されていますが、**レシピ提案機能は完全に未実装**です。また、URL取得は基本的な実装のみで、実用的なレベルには改善が必要です。

最も重要な不足機能は以下の3点です：

1. **Gemini APIを使ったレシピ提案機能の実装**
2. **URL先からのレシピ取得の高度化（構造化データ対応、画像取得、CORS対応）**
3. **バックエンドプロキシの構築（より確実なスクレイピングのため）**
