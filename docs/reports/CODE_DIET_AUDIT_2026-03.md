# コードダイエット監査レポート（2026-03 / rev3）

## 実施方針
「提案だけ」で終わらせず、依存関係・重複コード・単発スクリプト運用を実際に整理し、テスト/ビルドで安全性を確認する。

## 今回実施したチェック
- `rg --files`
- `rg "migrate-json-categories|resize-category-images|refactor-weekly|jimp|sharp" -n ...`
- `npm ls vite-plugin-pwa workbox-build @rollup/plugin-terser serialize-javascript`
- `npm audit --omit=dev --json`
- `npm audit fix --omit=dev`
- `npm run lint`
- `npm test`
- `npm run build`

## 監査結果（実装反映済み）

### 1. 認証系の重複ロジックを共通化
- `AuthContext` 内で重複していた `localStorage` の認証情報削除処理を `clearAuthStorage()` に統合。
- 対象: OAuth 未設定時 `signOut` / silent refresh エラー時 / OAuth 有効時 `signOut`。

**効果**
- 同一仕様変更時の修正箇所を 1 箇所化。
- 失敗時のクリーンアップ挙動の差分発生を抑制。

### 2. 画像変換スクリプトを一本化（Sharpベース）
- `scripts/resize-category-images.cjs` を実運用スクリプトとして整理。
  - 入力ディレクトリを `--input`（または `CATEGORY_IMAGE_INPUT_DIR`）で指定可能化。
  - 出力ディレクトリを `--output` で指定可能化。
  - 固定の Windows ローカルパス依存を解消。
- `scripts/resize-category-images.js` は互換用の最小ラッパーに縮小。

**効果**
- 環境依存コードを排除。
- メンテ対象ロジックを 1 つに集約。

### 3. カテゴリ移行スクリプトを重複排除
- `migrate-json-categories.js` は `.cjs` 実装を呼ぶ互換ラッパーに変更済み。

**効果**
- 実質的な二重メンテナンスを解消。

### 4. 依存関係の削減（実施）
`depcheck` とコード参照を突合し、未使用依存を削減。

- 削除: `jimp`（画像変換は sharp に統一）
- 削除: `react-markdown`
- 削除: `remark-gfm`
- 削除: `@tailwindcss/typography`

### 5. 残課題だった単発スクリプト運用を明確化（今回対応）
- `scripts/refactor-weekly.cjs` を `scripts/archive/refactor-weekly.cjs` へ移動。
- 先頭コメントに「単発用途」「通常は再実行しない」方針を明記。
- `scripts/README.md` を追加し、現役/アーカイブの区分と運用ルールを定義。

**効果**
- 誤実行リスクを低減。
- 現役スクリプトの判別コストを削減。

### 6. 依存脆弱性の残課題を解消（今回対応）
- `serialize-javascript` 脆弱性（GHSA-5c6j-r48x-rmvq）への対処として、`package.json` に `overrides` を追加し `7.0.3` を強制。
- `npm audit --omit=dev` で `0 vulnerabilities` を確認。

**効果**
- 本番依存の high 脆弱性を解消。

## 検証結果
- `npm run lint`: pass
- `npm test`: pass（184 tests）
- `npm run build`: pass（Vite chunk 警告は既知、ビルド自体は成功）
