# 人前・皿数ベース単位の改善計画

## 現状の問題

`unitToGrams` の `pieceUnits` 配列に以下が**未登録**のため、すべて 50g フォールバックになっている。

| 単位 | 実例 | 現状の推定値 | 正しい値 |
|---|---|---|---|
| `人前` | ごはん 1人前 | 50g | 160g |
| `人分` | うどん 2人分 | 100g | 400g |
| `皿` | スープ 1皿 | 50g | 180g |
| `皿分` | カレー 1皿分 | 50g | 180g |
| `膳` | 白飯 1膳 | 50g | 160g |

加えて **白飯/ご飯** が `NUTRITION_PATTERNS` に未登録のため
`findNutritionEntry` が null → 計算からまるごと除外されている。

---

## 変更スコープ

### ファイル 1: `src/utils/nutritionEstimator.ts`

`unitToGrams` の pieceUnits ループの**前**に、人前・皿系ユニット専用ブロックを追加する。

```typescript
// Person/serving-based units
const servingUnits: Array<[string, number]> = [
  ['人前', 150], ['人分', 150], ['膳', 160],
  ['皿分', 180], ['皿', 180],
]
for (const [su, defaultG] of servingUnits) {
  if (u === su || u.endsWith(su)) {
    return quantity * (unitGrams[su] ?? defaultG)
  }
}
```

汎用デフォルト値の根拠:
- `人前`/`人分` → 150g（日本の家庭料理 1 人前の典型重量）
- `膳` → 160g（茶碗 1 杯 = 白飯 160g）
- `皿`/`皿分` → 180g（一般的な盛り付け量）

---

### ファイル 2: `src/data/nutritionLookup.ts`

#### A. 白飯（炊飯後）entry を新規追加

現在の `米` entry は**生米**の栄養値。「ごはん 1人前」は炊飯後の値を使うべき。

```typescript
{
  keywords: ['白飯', 'ご飯', 'ごはん', '炊きたて', '炊いたご飯', 'rice'],
  entry: {
    per100g: {
      energyKcal: 168, proteinG: 2.5, fatG: 0.3, carbG: 37.1,
      saltEquivalentG: 0.0, fiberG: 0.3, sugarG: 0.3,
      saturatedFatG: 0.1, potassiumMg: 29, calciumMg: 3,
      ironMg: 0.1, vitaminCMg: 0,
    },
    unitGrams: { 人前: 160, 人分: 160, 膳: 160, 皿: 160, 茶碗: 160, 杯: 160 },
  },
},
```

※ `米` entry（生米）より**前**に配置（より具体的なキーワード優先）。

#### B. 既存 entry の unitGrams に人前・皿を追加

| entry | 追加する unitGrams |
|---|---|
| うどん | `人前: 200, 人分: 200, 玉: 200` |
| そば | `人前: 200, 人分: 200` |
| パスタ/スパゲッティ | `人前: 100, 人分: 100`（乾麺重量） |

#### C. ラーメン・中華麺 entry を新規追加

現在未登録。

```typescript
{
  keywords: ['ラーメン', 'らーめん', '中華麺', '中華そば', 'ちゅうかめん'],
  entry: {
    per100g: {
      energyKcal: 149, proteinG: 4.9, fatG: 0.6, carbG: 33.6,
      saltEquivalentG: 0.4, fiberG: 1.3, sugarG: 0.5,
      saturatedFatG: 0.1, potassiumMg: 45, calciumMg: 9,
      ironMg: 0.4, vitaminCMg: 0,
    },
    unitGrams: { 人前: 120, 人分: 120, 玉: 130 },
  },
},
```

---

## 変更しないもの

- `_ingredientName` パラメータ（引き続き未使用）
- `baseServings` を使った「レシピ全体の人数割り」ロジック（既存のまま）
- `皿分` が `formatQuantityVibe` に登録済みの部分（`recipeUtils.ts` は触らない）

---

## 変更ファイルまとめ

| ファイル | 変更内容 |
|---|---|
| `src/utils/nutritionEstimator.ts` | `unitToGrams` に人前・皿系ユニット処理ブロック追加 |
| `src/data/nutritionLookup.ts` | 白飯 entry 新規追加、うどん/そば/パスタの unitGrams 追加、ラーメン entry 新規追加 |
