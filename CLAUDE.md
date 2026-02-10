# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev       # Start dev server (Vite HMR, http://localhost:5173)
npm run build     # Type-check (tsc -b) then Vite production build
npm run lint      # ESLint (TypeScript + React Hooks rules)
npm run preview   # Preview production build locally
```

## Tech Stack

- **React 19** + TypeScript (strict mode, ES2022 target) + Vite 7
- **Tailwind CSS** for styling
- **Dexie.js** (IndexedDB wrapper) for offline data storage
- **Lucide-react** for icons
- ESLint with typescript-eslint + react-hooks + react-refresh plugins

## Project Vision: Recipe PWA

A recipe management PWA with dark-themed modern UI targeting Japanese home cooking (ホットクック/ヘルシオ integration).

### Design System

- Dark background: `bg-[#121214]`, accent orange: `#F97316`
- Cards/buttons: `rounded-xl` / `rounded-2xl` with translucent dark backgrounds
- Sans-serif fonts, bold numerics for emphasis

### Planned Architecture

- **Type definitions** centralized in `src/db/db.ts`
- **Calculation logic** (salt %, quantity conversion) as pure functions in `src/utils/`
- **Key components**: RecipeCard, IngredientList, SearchUI, AI/Stock panels

### Cooking Logic Rules

- **Quantity display**: Use `formatQuantityVibe` — convert to intuitive Japanese expressions ("1個強", "約1/2")
- **Weight rounding**: All gram values round to nearest 10g
- **Salt calculation presets**: 0.6% (薄味), 0.8% (標準), 1.2% (濃いめ) — auto-convert to soy sauce (~16% salt) and miso (~12% salt) in g/ml
- **Reverse schedule**: Calculate start times backward from target "いただきます" time, display as Gantt-style chart

### Integrations

- **Gemini API**: AI recipe analysis
- **PWA**: Offline support, installable app (to be configured)

---

## Performance & Scalability Guidelines

**Target data scale**: ~2000 recipes stored offline

### Critical Performance Rules

#### 🔴 NEVER load all recipes at once
- **Problem**: `db.recipes.toArray()` loads entire dataset into memory (10-20MB for 2000 recipes)
- **Impact**: Crashes on low-memory devices (Android <2GB RAM, older iPhones)
- **Solution**: Use pagination or virtual scrolling

```typescript
// ❌ BAD: Loads all 2000 recipes
const recipes = useLiveQuery(() => db.recipes.toArray())

// ✅ GOOD: Load only what's needed
const PAGE_SIZE = 50
const recipes = useLiveQuery(() => 
  db.recipes
    .offset(page * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray(),
  [page]
)
```

#### 🔴 Filter and sort in database, not in JavaScript
- **Problem**: Filtering 2000 items in JS causes UI freezes on every keystroke
- **Solution**: Push filters to Dexie queries

```typescript
// ❌ BAD: Filters in memory
const filtered = recipes.filter(r => r.category === category)

// ✅ GOOD: Filters in IndexedDB
const recipes = useLiveQuery(() => 
  db.recipes.where('category').equals(category).toArray(),
  [category]
)
```

#### 🟡 Add database indexes for common queries
- **Current schema**: Only indexes `id`, `title`, `device`, `category`
- **Missing**: `recipeNumber`, compound indexes like `[category+device]`
- **Impact**: Slow queries on large datasets

```typescript
// Recommended schema upgrade
this.version(2).stores({
  recipes: '++id, title, device, category, recipeNumber, [category+device]',
  stock: '++id, &name',
})
```

#### 🟡 Debounce search input
- **Problem**: Search triggers full dataset scan on every character typed
- **Solution**: Add 300ms debounce to search handler

```typescript
// Option 1: Using lodash (npm install lodash.debounce)
import debounce from 'lodash.debounce'
const debouncedSearch = useMemo(
  () => debounce((value: string) => setSearch(value), 300),
  []
)

// Option 2: Custom implementation (no dependencies)
const debouncedSearch = useMemo(() => {
  let timeoutId: NodeJS.Timeout
  return (value: string) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => setSearch(value), 300)
  }
}, [])
```

#### 🟢 Combine multiple reactive queries
- **Problem**: Multiple `useLiveQuery` calls trigger separate database scans on every update
- **Solution**: Combine related queries into a single `useLiveQuery`

```typescript
// ❌ BAD: Two separate queries
const recipes = useLiveQuery(() => db.recipes.toArray())
const stock = useLiveQuery(() => db.stock.where('inStock').equals(1).toArray())

// ✅ GOOD: Single combined query
const data = useLiveQuery(async () => {
  const [recipes, stock] = await Promise.all([
    db.recipes.limit(PAGE_SIZE).toArray(),
    db.stock.where('inStock').equals(1).toArray()
  ])
  return { recipes, stock }
})
```

### Advanced Performance Techniques

For even smoother user experience on mobile devices:

#### 🚀 Use React.memo and useMemo strategically
- **Purpose**: Prevent unnecessary re-renders of expensive components
- **Apply to**: RecipeCard, ingredient lists, schedule charts

```typescript
// Memoize expensive components
export const RecipeCard = React.memo(({ recipe, matchRate, onClick }) => {
  // Component logic
})

// Memoize expensive calculations
const sortedRecipes = useMemo(
  () => recipes.sort((a, b) => b.matchRate - a.matchRate),
  [recipes]
)
```

#### 🚀 Implement virtual scrolling for long lists
- **Library**: `react-window` or `@tanstack/react-virtual` (not currently installed)
- **Install**: `npm install @tanstack/react-virtual`
- **Benefit**: Only renders visible items (e.g., 10 cards) instead of all 2000
- **Memory savings**: 95%+ reduction in DOM nodes

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: recipes.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // Estimated card height
})
```

#### 🚀 Use CSS containment for better rendering
- **Purpose**: Isolate component rendering to prevent layout thrashing
- **Apply to**: Recipe cards, modals, fixed headers

```css
.recipe-card {
  contain: layout style paint;
  content-visibility: auto;
}
```

#### 🚀 Lazy load images with Intersection Observer
- **Status**: Future feature (no images currently in data model)
- **Purpose**: Load recipe images only when scrolling into view
- **Benefit**: Faster initial page load, reduced bandwidth

```typescript
const [imageSrc, setImageSrc] = useState(placeholderSrc)

useEffect(() => {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      setImageSrc(actualSrc)
      observer.disconnect()
    }
  })
  observer.observe(imgRef.current)
  return () => observer.disconnect()
}, [])
```

#### 🚀 Use Web Workers for heavy computations
- **Status**: Not currently implemented (future optimization)
- **Use cases**: Ingredient match rate calculation, schedule optimization
- **Benefit**: Keeps UI thread responsive during heavy processing

```typescript
// worker.ts
self.onmessage = (e) => {
  const { recipes, stockNames } = e.data
  const withRates = recipes.map(r => ({
    recipe: r,
    matchRate: calculateMatchRate(r.ingredients, stockNames)
  }))
  self.postMessage(withRates)
}

// Component
const worker = new Worker(new URL('./worker.ts', import.meta.url))
worker.postMessage({ recipes, stockNames })
worker.onmessage = (e) => setProcessedRecipes(e.data)
```

#### 🚀 Enable React Concurrent Features
- **useTransition**: Mark non-urgent updates (e.g., search filtering)
- **useDeferredValue**: Defer expensive re-renders

```typescript
const [isPending, startTransition] = useTransition()
const deferredSearch = useDeferredValue(search)

const handleSearch = (value: string) => {
  startTransition(() => {
    setSearch(value)
  })
}
```

#### 🚀 Optimize Tailwind CSS output
- **Purpose**: Reduce CSS bundle size for faster load
- **Method**: Ensure proper purging in production build

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  // This ensures unused styles are removed in production
}
```

### Image Handling Strategy (Future-Proof)

**Current state**: No images in recipes
**Future plan**: Add recipe images without breaking existing functionality

#### 📸 Data Model Design

**MUST use optional fields** to ensure backward compatibility:

```typescript
export interface Recipe {
  id?: number
  title: string
  recipeNumber: string
  // ... existing fields ...
  
  // Image fields (optional for backward compatibility)
  imageUrl?: string          // CDN/external URL (preferred)
  thumbnailUrl?: string       // Smaller version for list view
  imageBlurHash?: string      // BlurHash for placeholder (tiny string)
}
```

#### 📸 Storage Strategy

**🔴 NEVER store image blobs in IndexedDB**
- **Problem**: 2000 recipes × 200KB/image = 400MB (exceeds Safari's 50MB limit)
- **Solution**: Store URLs only, host images externally

**Recommended approach**:
1. **Upload to CDN** (Cloudinary, Imgix, S3 + CloudFront)
2. **Store URL in database**: `imageUrl: "https://cdn.example.com/recipes/001.webp"`
3. **Use image optimization service**: Auto-resize, WebP conversion, lazy loading

```typescript
// Example: Cloudinary URL with transformations
const imageUrl = `https://res.cloudinary.com/demo/image/upload/w_800,f_auto,q_auto/recipe-${id}.jpg`
```

#### 📸 Component Implementation (Null-Safe)

**Always handle missing images gracefully**:

```typescript
interface RecipeCardProps {
  recipe: Recipe
}

export const RecipeCard = ({ recipe }: RecipeCardProps) => {
  return (
    <div className="recipe-card">
      {/* Conditional rendering - no error if imageUrl is undefined */}
      {recipe.imageUrl && (
        <img 
          src={recipe.thumbnailUrl || recipe.imageUrl} 
          alt={recipe.title}
          loading="lazy"
          onError={(e) => {
            // Fallback to placeholder on load error
            e.currentTarget.src = '/placeholder-recipe.svg'
          }}
        />
      )}
      
      {/* Fallback icon when no image */}
      {!recipe.imageUrl && (
        <div className="recipe-card-placeholder">
          <Utensils className="h-12 w-12 text-text-secondary" />
        </div>
      )}
      
      <h3>{recipe.title}</h3>
    </div>
  )
}
```

#### 📸 Progressive Image Loading

**Use BlurHash for smooth loading experience**:

**Note**: Requires `npm install react-blurhash` (not currently installed)

```typescript
import { Blurhash } from 'react-blurhash'

const [imageLoaded, setImageLoaded] = useState(false)

return (
  <div className="relative">
    {recipe.imageBlurHash && !imageLoaded && (
      <Blurhash
        hash={recipe.imageBlurHash}
        width="100%"
        height={200}
        resolutionX={32}
        resolutionY={32}
      />
    )}
    {recipe.imageUrl && (
      <img
        src={recipe.imageUrl}
        onLoad={() => setImageLoaded(true)}
        className={imageLoaded ? 'opacity-100' : 'opacity-0'}
      />
    )}
  </div>
)
```

#### 📸 Image Optimization Checklist

When adding images in the future:

- ✅ **Format**: Use WebP (fallback to JPEG for old browsers)
- ✅ **Size**: Max width 800px for detail view, 400px for thumbnails
- ✅ **Compression**: Quality 80-85% (balance between size and quality)
- ✅ **Lazy loading**: Use `loading="lazy"` attribute
- ✅ **Responsive**: Serve different sizes based on screen width
- ✅ **Alt text**: Always include for accessibility
- ✅ **Error handling**: Fallback to placeholder on load failure

#### 📸 Database Migration Example

**When adding image fields later**:

```typescript
class RecipeDB extends Dexie {
  constructor() {
    super('RecipeDB')
    
    // Initial schema (current)
    this.version(1).stores({
      recipes: '++id, title, device, category',
      stock: '++id, &name',
    })
    
    // Future schema with images
    this.version(2).stores({
      recipes: '++id, title, device, category, recipeNumber',
      stock: '++id, &name',
    }).upgrade(tx => {
      // No data migration needed - new fields are optional
      // Existing recipes will have imageUrl: undefined
      return tx.table('recipes').toCollection().modify(recipe => {
        // Optional: Set default placeholder URL
        // recipe.imageUrl = recipe.imageUrl || null
      })
    })
  }
}
```

#### 📸 AI Recipe Parser Enhancement

**Extract image URL from web scraping**:

```typescript
export async function parseRecipeFromUrl(url: string): Promise<Omit<Recipe, 'id'>> {
  const res = await fetch(url)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')
  
  // Extract recipe image from Open Graph or schema.org
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content')
  const schemaImage = doc.querySelector('[itemprop="image"]')?.getAttribute('src')
  const imageUrl = ogImage || schemaImage
  
  // ... existing text extraction ...
  
  return {
    // ... existing fields ...
    imageUrl: imageUrl || undefined, // Optional field
  }
}
```

### Mobile Testing Checklist

Before deploying with 2000+ recipes, test on:

1. **Low-spec Android** (2GB RAM, Android 9-10)
2. **iPhone 8** (iOS 15-16, strict memory limits)
3. **Background recovery**: Open app → switch to other apps → return (should not crash)

### Memory Budget Guidelines

- **Per-page data**: Keep <1MB in memory at any time
- **Image storage**: Store URLs only, not blobs (IndexedDB has 50MB limit on Safari)
- **AI parsing**: Clear DOM after extracting text from fetched HTML

---

## Code Style Preferences

- Use `useLiveQuery` for reactive database queries
- Keep components small and focused (single responsibility)
- Extract complex calculations to `src/utils/` as pure functions
- Type everything strictly (no `any` types)
