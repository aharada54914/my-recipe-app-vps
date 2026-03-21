import { useState } from 'react'
import { Utensils } from 'lucide-react'
import type { Recipe } from '../db/db'

interface RecipeImageProps {
    recipe: Pick<Recipe, 'imageUrl' | 'thumbnailUrl' | 'title'>
    className?: string
    /** Height class for placeholder, e.g. 'h-32' */
    placeholderHeight?: string
    /** Thumbnail mode: square aspect ratio instead of 16:9 */
    thumbnail?: boolean
}

/**
 * Null-safe image component with error handling and aspect-ratio lock.
 * - Shows placeholder icon when imageUrl is undefined or on load error.
 * - Uses thumbnailUrl as a smaller alternative when available.
 * - Fixed aspect-ratio 16:9 (or 1:1 in thumbnail mode) to prevent layout shifts.
 */
export function RecipeImage({
    recipe,
    className = '',
    placeholderHeight = 'h-32',
    thumbnail = false,
}: RecipeImageProps) {
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(true)
    const src = recipe.thumbnailUrl ?? recipe.imageUrl
    const aspectRatio = thumbnail ? '1/1' : '16/9'

    if (!src || error) {
        return (
            <div
                className={`flex items-center justify-center rounded-xl bg-white/5 ${placeholderHeight} ${className}`}
                style={{ aspectRatio }}
            >
                <Utensils className={`${thumbnail ? 'h-5 w-5' : 'h-8 w-8'} text-text-secondary`} />
            </div>
        )
    }

    return (
        <div
            className={`relative overflow-hidden rounded-xl ${className}`}
            style={{ aspectRatio }}
        >
            {loading && (
                <div className={`absolute inset-0 flex items-center justify-center bg-white/5`}>
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
            )}
            <img
                src={src}
                alt={recipe.title}
                loading="lazy"
                onLoad={() => setLoading(false)}
                onError={() => { setError(true); setLoading(false) }}
                className={`h-full w-full object-cover ${loading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
            />
        </div>
    )
}
