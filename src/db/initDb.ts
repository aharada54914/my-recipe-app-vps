import { db } from './db'
import type { Recipe, StockItem } from './db'

const seedRecipes: Omit<Recipe, 'id'>[] = [
  {
    title: '肉じゃが',
    recipeNumber: '001',
    device: 'hotcook',
    category: '主菜',
    baseServings: 4,
    totalWeightG: 800,
    ingredients: [
      { name: '牛薄切り肉', quantity: 200, unit: 'g', category: 'main' },
      { name: 'じゃがいも', quantity: 3, unit: '個', category: 'main' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
      { name: 'にんじん', quantity: 1, unit: '本', category: 'main' },
      { name: 'しらたき', quantity: 150, unit: 'g', category: 'sub' },
      { name: '醤油', quantity: 3, unit: '大さじ', category: 'sub' },
      { name: 'みりん', quantity: 2, unit: '大さじ', category: 'sub' },
      { name: '砂糖', quantity: 1, unit: '大さじ', category: 'sub' },
    ],
    steps: [
      { name: '材料を切る', durationMinutes: 15 },
      { name: 'ホットクック調理', durationMinutes: 35, isDeviceStep: true },
      { name: '盛り付け', durationMinutes: 5 },
    ],
    totalTimeMinutes: 55,
  },
  {
    title: 'チキンカレー',
    recipeNumber: '002',
    device: 'hotcook',
    category: '主菜',
    baseServings: 4,
    totalWeightG: 1200,
    ingredients: [
      { name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' },
      { name: '玉ねぎ', quantity: 2, unit: '個', category: 'main' },
      { name: 'じゃがいも', quantity: 2, unit: '個', category: 'main' },
      { name: 'にんじん', quantity: 1, unit: '本', category: 'main' },
      { name: 'カレールー', quantity: 4, unit: '皿分', category: 'main' },
      { name: 'トマト缶', quantity: 200, unit: 'g', category: 'sub' },
      { name: 'にんにく', quantity: 1, unit: '片', category: 'sub', optional: true },
      { name: '生姜', quantity: 1, unit: '片', category: 'sub', optional: true },
    ],
    steps: [
      { name: '材料を切る', durationMinutes: 15 },
      { name: 'ホットクック調理', durationMinutes: 45, isDeviceStep: true },
      { name: 'ルーを溶かす', durationMinutes: 5 },
      { name: '盛り付け', durationMinutes: 5 },
    ],
    totalTimeMinutes: 70,
  },
  {
    title: '豚の角煮',
    recipeNumber: '003',
    device: 'hotcook',
    category: '主菜',
    baseServings: 4,
    totalWeightG: 700,
    ingredients: [
      { name: '豚バラブロック', quantity: 500, unit: 'g', category: 'main' },
      { name: '長ねぎ', quantity: 1, unit: '本', category: 'main' },
      { name: '生姜', quantity: 1, unit: '片', category: 'sub' },
      { name: '醤油', quantity: 3, unit: '大さじ', category: 'sub' },
      { name: '砂糖', quantity: 2, unit: '大さじ', category: 'sub' },
      { name: '酒', quantity: 3, unit: '大さじ', category: 'sub' },
      { name: 'みりん', quantity: 2, unit: '大さじ', category: 'sub' },
    ],
    steps: [
      { name: '豚肉を切る', durationMinutes: 10 },
      { name: 'ホットクック調理', durationMinutes: 65, isDeviceStep: true },
      { name: '盛り付け', durationMinutes: 5 },
    ],
    totalTimeMinutes: 80,
  },
  {
    title: '味噌汁',
    recipeNumber: '010',
    device: 'manual',
    category: 'スープ',
    baseServings: 4,
    totalWeightG: 800,
    ingredients: [
      { name: '豆腐', quantity: 150, unit: 'g', category: 'main' },
      { name: 'わかめ', quantity: 5, unit: 'g', category: 'main' },
      { name: '長ねぎ', quantity: 0.5, unit: '本', category: 'main' },
      { name: 'だし汁', quantity: 600, unit: 'ml', category: 'sub' },
      { name: '味噌', quantity: 3, unit: '大さじ', category: 'sub' },
    ],
    steps: [
      { name: 'だし汁を沸かす', durationMinutes: 5 },
      { name: '具材を入れて煮る', durationMinutes: 5 },
      { name: '味噌を溶く', durationMinutes: 3 },
    ],
    totalTimeMinutes: 13,
  },
  {
    title: '蒸し野菜',
    recipeNumber: '020',
    device: 'healsio',
    category: '副菜',
    baseServings: 2,
    totalWeightG: 400,
    ingredients: [
      { name: 'ブロッコリー', quantity: 1, unit: '株', category: 'main' },
      { name: 'かぼちゃ', quantity: 200, unit: 'g', category: 'main' },
      { name: 'パプリカ', quantity: 1, unit: '個', category: 'main' },
      { name: 'オリーブオイル', quantity: 1, unit: '大さじ', category: 'sub', optional: true },
      { name: '塩', quantity: 0, unit: '適量', category: 'sub' },
    ],
    steps: [
      { name: '野菜を切る', durationMinutes: 10 },
      { name: 'ヘルシオ蒸し', durationMinutes: 15, isDeviceStep: true },
      { name: '盛り付け', durationMinutes: 3 },
    ],
    totalTimeMinutes: 28,
  },
  {
    title: '無水トマトスープ',
    recipeNumber: '011',
    device: 'hotcook',
    category: 'スープ',
    baseServings: 4,
    totalWeightG: 1000,
    ingredients: [
      { name: 'トマト', quantity: 3, unit: '個', category: 'main' },
      { name: '玉ねぎ', quantity: 1, unit: '個', category: 'main' },
      { name: 'ベーコン', quantity: 80, unit: 'g', category: 'main' },
      { name: 'にんにく', quantity: 1, unit: '片', category: 'sub', optional: true },
      { name: 'コンソメ', quantity: 1, unit: '個', category: 'sub' },
      { name: 'オリーブオイル', quantity: 1, unit: '大さじ', category: 'sub' },
      { name: '塩', quantity: 0, unit: '適量', category: 'sub' },
    ],
    steps: [
      { name: '材料を切る', durationMinutes: 10 },
      { name: 'ホットクック無水調理', durationMinutes: 30, isDeviceStep: true },
      { name: '味を整える', durationMinutes: 3 },
    ],
    totalTimeMinutes: 43,
  },
]

const seedStock: Omit<StockItem, 'id'>[] = [
  { name: '牛薄切り肉', inStock: true },
  { name: '鶏もも肉', inStock: false },
  { name: '豚バラブロック', inStock: false },
  { name: 'じゃがいも', inStock: true },
  { name: '玉ねぎ', inStock: true },
  { name: 'にんじん', inStock: true },
  { name: '長ねぎ', inStock: false },
  { name: '豆腐', inStock: true },
  { name: 'トマト', inStock: false },
  { name: 'ブロッコリー', inStock: false },
  { name: 'かぼちゃ', inStock: false },
  { name: 'パプリカ', inStock: false },
  { name: 'ベーコン', inStock: true },
  { name: 'カレールー', inStock: true },
  { name: 'わかめ', inStock: true },
]

export async function initDb() {
  const count = await db.recipes.count()
  if (count > 0) return

  await db.recipes.bulkAdd(seedRecipes)
  await db.stock.bulkAdd(seedStock)
}
