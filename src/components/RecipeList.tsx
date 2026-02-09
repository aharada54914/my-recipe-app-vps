import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { RecipeCategory } from '../db/db'
import { calculateMatchRate } from '../utils/recipeUtils'
import { SearchBar } from './SearchBar'
import { CategoryTags } from './CategoryTags'
import { RecipeCard } from './RecipeCard'

interface RecipeListProps {
  onSelectRecipe: (id: number) => void
}

export function RecipeList({ onSelectRecipe }: RecipeListProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<RecipeCategory>('すべて')

  const recipes = useLiveQuery(() => db.recipes.toArray())
  const stock = useLiveQuery(() => db.stock.where('inStock').equals(1).toArray())

  if (!recipes || !stock) return null

  const stockNames = new Set(stock.map((s) => s.name))

  let filtered = recipes
  if (category !== 'すべて') {
    filtered = filtered.filter((r) => r.category === category)
  }
  if (search) {
    const q = search.toLowerCase()
    filtered = filtered.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
    )
  }

  const withRates = filtered
    .map((r) => ({
      recipe: r,
      matchRate: calculateMatchRate(r.ingredients, stockNames),
    }))
    .sort((a, b) => b.matchRate - a.matchRate)

  return (
    <>
      <SearchBar value={search} onChange={setSearch} />
      <CategoryTags selected={category} onSelect={setCategory} />
      <div className="grid gap-4">
        {withRates.map(({ recipe, matchRate }) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            matchRate={matchRate}
            onClick={() => onSelectRecipe(recipe.id!)}
          />
        ))}
        {withRates.length === 0 && (
          <p className="py-12 text-center text-sm text-text-secondary">
            レシピが見つかりません
          </p>
        )}
      </div>
    </>
  )
}
