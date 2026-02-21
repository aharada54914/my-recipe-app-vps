import { create } from 'zustand'
import type { Recipe } from '../db/db'

export type GeminiTabId = 'import' | 'suggest' | 'chat'

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

interface GeminiStore {
  activeTab: GeminiTabId
  setActiveTab: (tab: GeminiTabId) => void

  photoFiles: File[]
  setPhotoFiles: (files: File[]) => void

  ingredientsDraft: string
  setIngredientsDraft: (value: string) => void

  generatedRecipes: Omit<Recipe, 'id'>[]
  setGeneratedRecipes: (recipes: Omit<Recipe, 'id'>[]) => void

  statusMessage: string | null
  setStatusMessage: (message: string | null) => void

  chatMessages: ChatMessage[]
  setChatMessages: (messages: ChatMessage[]) => void
  appendChatMessage: (message: ChatMessage) => void
}

export const useGeminiStore = create<GeminiStore>((set) => ({
  activeTab: 'suggest',
  setActiveTab: (tab) => set({ activeTab: tab }),

  photoFiles: [],
  setPhotoFiles: (files) => set({ photoFiles: files }),

  ingredientsDraft: '',
  setIngredientsDraft: (value) => set({ ingredientsDraft: value }),

  generatedRecipes: [],
  setGeneratedRecipes: (recipes) => set({ generatedRecipes: recipes }),

  statusMessage: null,
  setStatusMessage: (message) => set({ statusMessage: message }),

  chatMessages: [],
  setChatMessages: (messages) => set({ chatMessages: messages }),
  appendChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages, message] })),
}))
