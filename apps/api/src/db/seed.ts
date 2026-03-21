import { prisma } from './client.js'

async function seed(): Promise<void> {
  console.info('Seeding database...')

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { id: 'demo-user' },
    update: {},
    create: {
      id: 'demo-user',
      email: 'demo@kitchen-app.local',
      name: 'Demo User',
      preferences: {
        appearanceMode: 'system',
        mealStartHour: 18,
        mealStartMinute: 0,
        mealEndHour: 19,
        mealEndMinute: 0,
        seasonalPriority: 'medium',
        weeklyMenuCostMode: 'ignore',
        userPrompt: '',
        notifyWeeklyMenuDone: true,
        notifyShoppingListDone: true,
      },
    },
  })

  console.info(`Created user: ${user.email}`)

  // Create sample recipes
  const sampleRecipes = [
    {
      title: '鶏もも肉のトマト煮込み',
      device: 'hotcook',
      category: '主菜',
      recipeNumber: 'SAMPLE-001',
      baseServings: 2,
      totalWeightG: 800,
      totalTimeMinutes: 45,
      ingredients: [
        { name: '鶏もも肉', quantity: 300, unit: 'g', category: 'main' },
        { name: 'トマト缶', quantity: 1, unit: '缶', category: 'main' },
        { name: 'たまねぎ', quantity: 1, unit: '個', category: 'main' },
        { name: 'にんにく', quantity: 1, unit: '片', category: 'sub' },
        { name: 'コンソメ', quantity: 1, unit: '個', category: 'sub' },
        { name: '塩', quantity: '少々', unit: '', category: 'sub' },
      ],
      steps: [
        { name: '材料を切る', durationMinutes: 10, isDeviceStep: false },
        { name: 'ホットクックで煮込む', durationMinutes: 35, isDeviceStep: true },
      ],
    },
    {
      title: 'ほうれん草のおひたし',
      device: 'manual',
      category: '副菜',
      recipeNumber: 'SAMPLE-002',
      baseServings: 2,
      totalWeightG: 300,
      totalTimeMinutes: 10,
      ingredients: [
        { name: 'ほうれん草', quantity: 1, unit: '束', category: 'main' },
        { name: '醤油', quantity: 1, unit: '大さじ', category: 'sub' },
        { name: 'かつお節', quantity: '適量', unit: '', category: 'sub' },
      ],
      steps: [
        { name: 'ほうれん草を茹でる', durationMinutes: 3, isDeviceStep: false },
        { name: '水気を絞り切る', durationMinutes: 2, isDeviceStep: false },
        { name: '調味料で和える', durationMinutes: 5, isDeviceStep: false },
      ],
    },
    {
      title: '野菜たっぷりミネストローネ',
      device: 'hotcook',
      category: 'スープ',
      recipeNumber: 'SAMPLE-003',
      baseServings: 4,
      totalWeightG: 1200,
      totalTimeMinutes: 40,
      ingredients: [
        { name: 'にんじん', quantity: 1, unit: '本', category: 'main' },
        { name: 'じゃがいも', quantity: 2, unit: '個', category: 'main' },
        { name: 'キャベツ', quantity: '1/4', unit: '個', category: 'main' },
        { name: 'ベーコン', quantity: 50, unit: 'g', category: 'main' },
        { name: 'トマト缶', quantity: 1, unit: '缶', category: 'main' },
        { name: 'コンソメ', quantity: 2, unit: '個', category: 'sub' },
        { name: '水', quantity: 400, unit: 'ml', category: 'sub' },
      ],
      steps: [
        { name: '野菜を1cm角に切る', durationMinutes: 15, isDeviceStep: false },
        { name: 'ホットクックで煮込む', durationMinutes: 25, isDeviceStep: true },
      ],
    },
  ]

  for (const recipe of sampleRecipes) {
    await prisma.recipe.upsert({
      where: { recipeNumber: recipe.recipeNumber },
      update: {},
      create: recipe,
    })
  }

  console.info(`Created ${sampleRecipes.length} sample recipes`)

  // Create sample stocks
  const sampleStocks = [
    { name: '塩', inStock: true },
    { name: '醤油', inStock: true },
    { name: 'コンソメ', inStock: true },
    { name: 'にんにく', inStock: false },
    { name: 'オリーブオイル', inStock: true },
  ]

  for (const stock of sampleStocks) {
    await prisma.stock.upsert({
      where: {
        userId_name: { userId: user.id, name: stock.name },
      },
      update: {},
      create: {
        userId: user.id,
        name: stock.name,
        inStock: stock.inStock,
      },
    })
  }

  console.info(`Created ${sampleStocks.length} stock items`)
  console.info('Seed complete!')
}

seed()
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Seed failed: ${message}`)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
