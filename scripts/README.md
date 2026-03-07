# scripts ディレクトリ運用メモ

## Active（現役）
- `prebuild-recipes.mjs`  
  ビルド前に CSV から `src/data/recipes-*.json` を生成する。
- `nutrition-audit.ts`  
  栄養データ監査のための検証スクリプト。
- `ui-class-audit.mjs`
  glass 系 class と token migration の残存数を監査する。
- `resize-category-images.cjs`  
  カテゴリ画像を 400x400 の `.webp` に変換する。`--input` / `--output` を受け付ける。
- `resize-category-images.js`  
  互換ラッパー（`.cjs` 呼び出し専用）。
- `migrate-json-categories.cjs`  
  JSON レシピのカテゴリ名マイグレーション。
- `migrate-json-categories.js`  
  互換ラッパー（`.cjs` 呼び出し専用）。

## Archived（単発・履歴）
- `archive/refactor-weekly.cjs`  
  `WeeklyMenuPage.tsx` の過去リファクタ用単発スクリプト。

> ルール: 単発作業スクリプトは `scripts/archive/` に置き、再実行可否と目的を先頭コメントで明記する。
