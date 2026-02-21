import { z } from 'zod'

export const DeviceTypeSchema = z.enum(['hotcook', 'healsio', 'manual'])

export const IngredientCategorySchema = z.enum(['main', 'sub'])

export const RecipeCategorySchema = z.enum(['すべて', '主菜', '副菜', 'スープ', '一品料理', 'スイーツ'])

export const IngredientSchema = z.object({
    name: z.string().min(1, '食材名は必須です'),
    quantity: z.union([z.number(), z.string(), z.literal('適量')]),
    unit: z.string(),
    category: IngredientCategorySchema.catch('main'),
    optional: z.boolean().catch(false).optional(),
})

export const CookingStepSchema = z.object({
    name: z.string().min(1, '工程名は必須です'),
    durationMinutes: z.number().catch(5),
    isDeviceStep: z.boolean().catch(false).optional(),
})

export const ParsedRecipeSchema = z.object({
    title: z.string().min(1, 'タイトルは必須です'),
    device: DeviceTypeSchema.catch('manual'),
    category: RecipeCategorySchema.catch('主菜'),
    baseServings: z.number().catch(2),
    totalWeightG: z.number().catch(500),
    ingredients: z.array(IngredientSchema).min(1, '材料は1つ以上必要です'),
    steps: z.array(CookingStepSchema).min(1, '工程は1つ以上必要です'),
    totalTimeMinutes: z.number().optional().catch(undefined),
})
