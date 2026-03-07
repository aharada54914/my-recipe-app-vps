import type { DeviceType, RecipeCategory } from '../db/db'

export interface RecipeSearchFacetState {
  devices: DeviceType[]
  categories: RecipeCategory[]
  quick: boolean
  seasonal: boolean
}

export interface RecipeSearchFacetChip {
  key: string
  label: string
  type: 'device' | 'category' | 'quick' | 'seasonal'
}

const DEVICE_OPTIONS: DeviceType[] = ['hotcook', 'healsio']
const CATEGORY_OPTIONS: RecipeCategory[] = ['主菜', '副菜', 'スープ', '一品料理', 'スイーツ']

const DEVICE_LABELS: Record<DeviceType, string> = {
  hotcook: 'ホットクック',
  healsio: 'ヘルシオ',
  manual: '手動調理',
}

function uniqueValues<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function createEmptyRecipeSearchFacets(): RecipeSearchFacetState {
  return {
    devices: [],
    categories: [],
    quick: false,
    seasonal: false,
  }
}

export function normalizeRecipeSearchFacets(facets: RecipeSearchFacetState): RecipeSearchFacetState {
  return {
    devices: uniqueValues(facets.devices).filter((device): device is DeviceType => DEVICE_OPTIONS.includes(device)),
    categories: uniqueValues(facets.categories).filter(
      (category): category is RecipeCategory => CATEGORY_OPTIONS.includes(category),
    ),
    quick: !!facets.quick,
    seasonal: !!facets.seasonal,
  }
}

export function toggleRecipeSearchDevice(facets: RecipeSearchFacetState, device: DeviceType): RecipeSearchFacetState {
  const nextDevices = facets.devices.includes(device)
    ? facets.devices.filter((value) => value !== device)
    : [...facets.devices, device]

  return normalizeRecipeSearchFacets({
    ...facets,
    devices: nextDevices,
  })
}

export function toggleRecipeSearchCategory(facets: RecipeSearchFacetState, category: RecipeCategory): RecipeSearchFacetState {
  if (category === 'すべて') return { ...facets, categories: [] }

  const nextCategories = facets.categories.includes(category)
    ? facets.categories.filter((value) => value !== category)
    : [...facets.categories, category]

  return normalizeRecipeSearchFacets({
    ...facets,
    categories: nextCategories,
  })
}

export function toggleRecipeSearchFlag(
  facets: RecipeSearchFacetState,
  flag: 'quick' | 'seasonal',
): RecipeSearchFacetState {
  return normalizeRecipeSearchFacets({
    ...facets,
    [flag]: !facets[flag],
  })
}

export function clearRecipeSearchFacets(): RecipeSearchFacetState {
  return createEmptyRecipeSearchFacets()
}

export function hasActiveRecipeSearchFacets(facets: RecipeSearchFacetState): boolean {
  return facets.devices.length > 0 || facets.categories.length > 0 || facets.quick || facets.seasonal
}

export function countActiveRecipeSearchFacets(facets: RecipeSearchFacetState): number {
  return facets.devices.length + facets.categories.length + (facets.quick ? 1 : 0) + (facets.seasonal ? 1 : 0)
}

export function buildRecipeSearchFacetChips(facets: RecipeSearchFacetState): RecipeSearchFacetChip[] {
  return [
    ...facets.devices.map((device) => ({
      key: `device:${device}`,
      label: DEVICE_LABELS[device],
      type: 'device' as const,
    })),
    ...facets.categories.map((category) => ({
      key: `category:${category}`,
      label: category,
      type: 'category' as const,
    })),
    ...(facets.quick ? [{ key: 'quick', label: '時短 30分以内', type: 'quick' as const }] : []),
    ...(facets.seasonal ? [{ key: 'seasonal', label: '旬を優先', type: 'seasonal' as const }] : []),
  ]
}

function parseCsvParam<T extends string>(rawValue: string | null, allowedValues: readonly T[]): T[] {
  if (!rawValue) return []

  const allowed = new Set(allowedValues)
  return uniqueValues(
    rawValue
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is T => allowed.has(value as T)),
  )
}

function parseLegacyFilterParam(filterParam: string | null): RecipeSearchFacetState {
  if (!filterParam) return createEmptyRecipeSearchFacets()

  if (filterParam.startsWith('device:')) {
    const device = filterParam.replace('device:', '') as DeviceType
    return normalizeRecipeSearchFacets({
      ...createEmptyRecipeSearchFacets(),
      devices: [device],
    })
  }

  if (filterParam === 'quick') {
    return { ...createEmptyRecipeSearchFacets(), quick: true }
  }

  if (filterParam === 'seasonal') {
    return { ...createEmptyRecipeSearchFacets(), seasonal: true }
  }

  if (filterParam !== 'すべて' && CATEGORY_OPTIONS.includes(filterParam as RecipeCategory)) {
    return {
      ...createEmptyRecipeSearchFacets(),
      categories: [filterParam as RecipeCategory],
    }
  }

  return createEmptyRecipeSearchFacets()
}

export function parseRecipeSearchFacetsFromParams(searchParams: URLSearchParams): RecipeSearchFacetState {
  const devices = parseCsvParam(searchParams.get('devices'), DEVICE_OPTIONS)
  const categories = parseCsvParam(searchParams.get('categories'), CATEGORY_OPTIONS)
  const quick = searchParams.get('quick') === '1'
  const seasonal = searchParams.get('seasonal') === '1'

  const next = normalizeRecipeSearchFacets({ devices, categories, quick, seasonal })
  if (hasActiveRecipeSearchFacets(next)) return next

  return parseLegacyFilterParam(searchParams.get('filter'))
}

export function createRecipeSearchParams(query: string, facets: RecipeSearchFacetState): URLSearchParams {
  const next = new URLSearchParams()
  const normalizedFacets = normalizeRecipeSearchFacets(facets)
  const trimmedQuery = query.trim()

  if (trimmedQuery) next.set('q', trimmedQuery)
  if (normalizedFacets.devices.length > 0) next.set('devices', normalizedFacets.devices.join(','))
  if (normalizedFacets.categories.length > 0) next.set('categories', normalizedFacets.categories.join(','))
  if (normalizedFacets.quick) next.set('quick', '1')
  if (normalizedFacets.seasonal) next.set('seasonal', '1')

  return next
}
