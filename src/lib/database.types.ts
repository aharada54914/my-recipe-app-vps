/**
 * Supabase Database Type Definitions
 *
 * Mirrors the Dexie (IndexedDB) schema with additional cloud-sync fields:
 * - user_id: ties rows to authenticated users (RLS)
 * - created_at / updated_at: timestamps for sync conflict resolution
 *
 * Naming convention: PostgreSQL snake_case in DB, camelCase in app code.
 * Conversion utilities will be added in Phase 3 (data sync).
 */

export interface Database {
  public: {
    Tables: {
      recipes: {
        Row: {
          id: string
          user_id: string | null
          title: string
          recipe_number: string
          device: string
          category: string
          base_servings: number
          total_weight_g: number
          ingredients: IngredientJson[]
          steps: CookingStepJson[]
          total_time_minutes: number
          image_url: string | null
          thumbnail_url: string | null
          image_blur_hash: string | null
          source_url: string | null
          servings: string | null
          calories: string | null
          salt_content: string | null
          cooking_time: string | null
          raw_steps: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          recipe_number?: string
          device?: string
          category?: string
          base_servings?: number
          total_weight_g?: number
          ingredients?: IngredientJson[]
          steps?: CookingStepJson[]
          total_time_minutes?: number
          image_url?: string | null
          thumbnail_url?: string | null
          image_blur_hash?: string | null
          source_url?: string | null
          servings?: string | null
          calories?: string | null
          salt_content?: string | null
          cooking_time?: string | null
          raw_steps?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          recipe_number?: string
          device?: string
          category?: string
          base_servings?: number
          total_weight_g?: number
          ingredients?: IngredientJson[]
          steps?: CookingStepJson[]
          total_time_minutes?: number
          image_url?: string | null
          thumbnail_url?: string | null
          image_blur_hash?: string | null
          source_url?: string | null
          servings?: string | null
          calories?: string | null
          salt_content?: string | null
          cooking_time?: string | null
          raw_steps?: string[] | null
          updated_at?: string
        }
      }
      stock: {
        Row: {
          id: string
          user_id: string
          name: string
          in_stock: boolean
          quantity: number | null
          unit: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          in_stock?: boolean
          quantity?: number | null
          unit?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          in_stock?: boolean
          quantity?: number | null
          unit?: string | null
          updated_at?: string
        }
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          recipe_id: string
          added_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipe_id: string
          added_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipe_id?: string
          added_at?: string
        }
      }
      user_notes: {
        Row: {
          id: string
          user_id: string
          recipe_id: string
          content: string
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipe_id: string
          content?: string
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipe_id?: string
          content?: string
          updated_at?: string
        }
      }
      view_history: {
        Row: {
          id: string
          user_id: string
          recipe_id: string
          viewed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipe_id: string
          viewed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipe_id?: string
          viewed_at?: string
        }
      }
    }
  }
}

/** JSON shape stored in the `ingredients` jsonb column */
export interface IngredientJson {
  name: string
  quantity: number
  unit: string
  category: 'main' | 'sub'
  optional?: boolean
}

/** JSON shape stored in the `steps` jsonb column */
export interface CookingStepJson {
  name: string
  durationMinutes: number
  isDeviceStep?: boolean
}
