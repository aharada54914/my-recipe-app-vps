import { useState } from 'react'
import { Utensils } from 'lucide-react'
import type { Recipe } from '../db/db'

interface RecipeImageProps {
    recipe: Pick<Recipe, 'imageUrl' | 'thumbnailUrl' | 'title'>
    className?: string
    /** Height class for placeholder, e.g. 'h-32' */
    placeholderHeight?: string
}

/**
 * T-14: Null-safe image component with error handling.
 * - Shows placeholder icon when imageUrl is undefined or on load error.
 * - Uses thumbnailUrl as a smaller alternative when available.
 * - Gracefully degrades for recipes without images.
 */
export function RecipeImage({
    recipe,
    className = '',
    placeholderHeight = 'h-32',
}: RecipeImageProps) {
    const [error, setError] = useState(false)
    const src = recipe.thumbnailUrl ?? recipe.imageUrl

    if (!src || error) {
        return (
            <div
                className={`flex items-center justify-center rounded-xl bg-white/5 ${placeholderHeight} ${className}`}
            >
                <Utensils className="h-8 w-8 text-text-secondary" />
            </div>
        )
    }

    return (
        <img
            src={src}
            alt={recipe.title}
            loading="lazy"
            onError={() => setError(true)}
            className={`rounded-xl object-cover ${placeholderHeight} w-full ${className}`}
        />
    )
}
