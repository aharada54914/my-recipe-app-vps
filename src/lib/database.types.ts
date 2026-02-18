/**
 * Supabase Database Type Definitions
 *
 * Generated-style types compatible with @supabase/supabase-js v2.
 * Mirrors the Dexie schema with cloud-sync fields (user_id, timestamps).
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          recipe_id: string
          google_event_id: string
          calendar_id: string
          event_type: string
          start_time: string
          end_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          recipe_id: string
          google_event_id: string
          calendar_id: string
          event_type?: string
          start_time: string
          end_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          recipe_id?: string
          google_event_id?: string
          calendar_id?: string
          event_type?: string
          start_time?: string
          end_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          family_calendar_id: string | null
          meal_start_hour: number
          meal_start_minute: number
          meal_end_hour: number
          meal_end_minute: number
          default_calendar_id: string | null
          weekly_menu_generation_day: number
          weekly_menu_generation_hour: number
          weekly_menu_generation_minute: number
          shopping_list_hour: number
          shopping_list_minute: number
          seasonal_priority: string
          user_prompt: string
          notify_weekly_menu_done: boolean
          notify_shopping_list_done: boolean
          cooking_notify_enabled: boolean
          cooking_notify_hour: number
          cooking_notify_minute: number
          desired_meal_hour: number
          desired_meal_minute: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          family_calendar_id?: string | null
          meal_start_hour?: number
          meal_start_minute?: number
          meal_end_hour?: number
          meal_end_minute?: number
          default_calendar_id?: string | null
          weekly_menu_generation_day?: number
          weekly_menu_generation_hour?: number
          weekly_menu_generation_minute?: number
          shopping_list_hour?: number
          shopping_list_minute?: number
          seasonal_priority?: string
          user_prompt?: string
          notify_weekly_menu_done?: boolean
          notify_shopping_list_done?: boolean
          cooking_notify_enabled?: boolean
          cooking_notify_hour?: number
          cooking_notify_minute?: number
          desired_meal_hour?: number
          desired_meal_minute?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          family_calendar_id?: string | null
          meal_start_hour?: number
          meal_start_minute?: number
          meal_end_hour?: number
          meal_end_minute?: number
          default_calendar_id?: string | null
          weekly_menu_generation_day?: number
          weekly_menu_generation_hour?: number
          weekly_menu_generation_minute?: number
          shopping_list_hour?: number
          shopping_list_minute?: number
          seasonal_priority?: string
          user_prompt?: string
          notify_weekly_menu_done?: boolean
          notify_shopping_list_done?: boolean
          cooking_notify_enabled?: boolean
          cooking_notify_hour?: number
          cooking_notify_minute?: number
          desired_meal_hour?: number
          desired_meal_minute?: number
          updated_at?: string
        }
        Relationships: []
      }
      weekly_menus: {
        Row: {
          id: string
          user_id: string
          week_start_date: string
          items: string
          shopping_list: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start_date: string
          items: string
          shopping_list?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start_date?: string
          items?: string
          shopping_list?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
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
