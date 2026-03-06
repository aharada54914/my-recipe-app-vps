import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Star } from 'lucide-react'
import type { Recipe } from '../../db/db'
import { useSearchInputController } from '../../hooks/useSearchInputController'
import { RecipeCard } from '../RecipeCard'
import { calculateMatchRate } from '../../utils/recipeUtils'
import { searchRecipesWithScores } from '../../utils/searchUtils'

export interface SwapModalProps {
    swapType: 'main' | 'side'
    candidates: Recipe[]
    favorites: Recipe[]
    searchQuery: string
    stockNames: Set<string>
    onSearchChange: (q: string) => void
    onSelect: (recipe: Recipe) => void
    onClose: () => void
}

export function SwapModal({
    swapType, candidates, favorites, searchQuery,
    stockNames, onSearchChange, onSelect, onClose,
}: SwapModalProps) {
    const {
        draftValue,
        setDraftValue,
        handleCompositionStart,
        handleCompositionEnd,
    } = useSearchInputController({
        value: searchQuery,
        onCommit: onSearchChange,
        delay: 250,
    })

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return null
        return searchRecipesWithScores(candidates, searchQuery)
            .map((r) => r.recipe)
            .slice(0, 30)
    }, [candidates, searchQuery])

    const showSearch = !!filtered
    const topAlternatives = useMemo(
        () => candidates.slice(0, 10),
        [candidates]
    )

    return createPortal(
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/60" onClick={onClose}>
            <div
                className="flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-2xl bg-bg-primary"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3">
                    <h3 className="text-sm font-bold">
                        {swapType === 'main' ? '主菜' : '副菜・スープ'}を変更
                    </h3>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-text-secondary hover:text-accent cursor-pointer">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-3">
                    <div className="flex items-center gap-2 rounded-xl bg-bg-card px-3 py-2.5">
                        <Search className="h-4 w-4 shrink-0 text-text-secondary" />
                        <input
                            autoFocus
                            type="search"
                            value={draftValue}
                            onChange={e => setDraftValue(e.target.value)}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={(e) => handleCompositionEnd(e.currentTarget.value)}
                            placeholder="レシピを検索..."
                            className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-secondary outline-none cursor-text"
                        />
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
                    {showSearch ? (
                        /* Search results */
                        filtered!.length > 0 ? (
                            <div className="space-y-2">
                                {filtered!.map(recipe => (
                                    <RecipeCard
                                        key={recipe.id}
                                        recipe={recipe}
                                        matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                                        onClick={() => onSelect(recipe)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="py-6 text-center text-sm text-text-secondary">該当するレシピがありません</p>
                        )
                    ) : (
                        <>
                            {/* Favorites section */}
                            {favorites.length > 0 && (
                                <div>
                                    <div className="mb-2 flex items-center gap-1.5">
                                        <Star className="h-3.5 w-3.5 text-accent" />
                                        <h4 className="text-xs font-bold text-text-secondary">お気に入り</h4>
                                    </div>
                                    <div className="space-y-2">
                                        {favorites.slice(0, 5).map(recipe => (
                                            <RecipeCard
                                                key={recipe.id}
                                                recipe={recipe}
                                                matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                                                onClick={() => onSelect(recipe)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Stock-based recommendations */}
                            <div>
                                <div className="mb-2 text-xs font-bold text-text-secondary">在庫でつくれるレシピ</div>
                                <div className="space-y-2">
                                    {topAlternatives.map(recipe => (
                                        <RecipeCard
                                            key={recipe.id}
                                            recipe={recipe}
                                            matchRate={calculateMatchRate(recipe.ingredients, stockNames)}
                                            onClick={() => onSelect(recipe)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    )
}
