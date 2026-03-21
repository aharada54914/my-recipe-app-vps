import { create } from 'zustand'
import type { Recipe } from '../db/db'
import { generateGeminiText, resolveGeminiApiKey } from '../lib/geminiClient'
import { useUIStore } from './uiStore'

export type GeminiTabId = 'import' | 'suggest' | 'chat'

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
  createdAt: number
}

const CHAT_STORAGE_KEY = 'gemini_chat_state_v2'
const CHAT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000

function pruneChatMessages(messages: ChatMessage[], now = Date.now()): ChatMessage[] {
  const minTime = now - CHAT_RETENTION_MS
  return messages
    .filter((msg) => Number.isFinite(msg.createdAt) && msg.createdAt >= minTime && msg.text.trim())
    .slice(-200)
}

function loadPersistedChatState(): { chatMessages: ChatMessage[]; chatDraftInput: string } {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY)
    if (!raw) return { chatMessages: [], chatDraftInput: '' }
    const parsed = JSON.parse(raw) as {
      chatMessages?: Array<Partial<ChatMessage>>
      chatDraftInput?: string
    }
    const messages = Array.isArray(parsed.chatMessages)
      ? parsed.chatMessages
        .filter((msg): msg is Partial<ChatMessage> => !!msg && typeof msg === 'object')
        .map((msg) => ({
          role: (msg.role === 'model' ? 'model' : 'user') as ChatMessage['role'],
          text: typeof msg.text === 'string' ? msg.text : '',
          createdAt: typeof msg.createdAt === 'number' ? msg.createdAt : 0,
        }))
      : []

    return {
      chatMessages: pruneChatMessages(messages),
      chatDraftInput: typeof parsed.chatDraftInput === 'string' ? parsed.chatDraftInput : '',
    }
  } catch {
    return { chatMessages: [], chatDraftInput: '' }
  }
}

function persistChatState(chatMessages: ChatMessage[], chatDraftInput: string): void {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({
      chatMessages: pruneChatMessages(chatMessages),
      chatDraftInput,
    }))
  } catch {
    // ignore storage errors
  }
}

const persisted = loadPersistedChatState()

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
  appendChatMessage: (message: Omit<ChatMessage, 'createdAt'> & { createdAt?: number }) => void
  pruneChatHistory: () => void
  chatDraftInput: string
  setChatDraftInput: (text: string) => void
  chatLoading: boolean
  sendChatMessage: (text: string, apiKeyOverride?: string) => Promise<void>

  pendingChatInput: string | null
  setPendingChatInput: (text: string | null) => void
}

export const useGeminiStore = create<GeminiStore>((set, get) => ({
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

  chatMessages: persisted.chatMessages,
  setChatMessages: (messages) => set((state) => {
    const next = pruneChatMessages(messages)
    persistChatState(next, state.chatDraftInput)
    return { chatMessages: next }
  }),
  appendChatMessage: (message) => set((state) => {
    const next = pruneChatMessages([
      ...state.chatMessages,
      { ...message, createdAt: message.createdAt ?? Date.now() },
    ])
    persistChatState(next, state.chatDraftInput)
    return { chatMessages: next }
  }),
  pruneChatHistory: () => set((state) => {
    const next = pruneChatMessages(state.chatMessages)
    persistChatState(next, state.chatDraftInput)
    return { chatMessages: next }
  }),
  chatDraftInput: persisted.chatDraftInput,
  setChatDraftInput: (text) => set((state) => {
    persistChatState(state.chatMessages, text)
    return { chatDraftInput: text }
  }),
  chatLoading: false,
  sendChatMessage: async (text, apiKeyOverride) => {
    const q = text.trim()
    if (!q || get().chatLoading) return

    const key = resolveGeminiApiKey(apiKeyOverride)
    if (!key) {
      get().appendChatMessage({ role: 'model', text: 'エラーが発生しました: Gemini APIキーが未設定です。' })
      useUIStore.getState().addToast({ message: 'Gemini APIキーが未設定です', type: 'error' })
      return
    }

    get().appendChatMessage({ role: 'user', text: q })
    set({ chatLoading: true })

    try {
      const systemContext = 'あなたは日本の家庭料理のアシスタントです。ホットクックとヘルシオに詳しく、料理のコツや献立のアドバイスが得意です。'
      const history = [...get().chatMessages]
      const fullPrompt = history.length === 0
        ? `${systemContext}\n\nユーザー: ${q}`
        : `${systemContext}\n\n${history.map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.text}`).join('\n')}`

      const reply = await generateGeminiText(fullPrompt, key, { feature: 'chat' })
      get().appendChatMessage({ role: 'model', text: reply })
      useUIStore.getState().addToast({ message: 'Geminiの回答を受信しました', type: 'success', durationMs: 2500 })
    } catch (e) {
      get().appendChatMessage({ role: 'model', text: `エラーが発生しました: ${e instanceof Error ? e.message : String(e)}` })
      useUIStore.getState().addToast({ message: 'Geminiの応答でエラーが発生しました', type: 'error' })
    } finally {
      set({ chatLoading: false })
    }
  },

  pendingChatInput: null,
  setPendingChatInput: (text) => set({ pendingChatInput: text }),
}))
