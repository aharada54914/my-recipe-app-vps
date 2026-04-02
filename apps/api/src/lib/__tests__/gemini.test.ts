import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  fetchMock: vi.fn(),
  calls: [] as Array<{ apiKey: string; model: string; prompt: unknown }>,
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    private readonly apiKey: string

    constructor(apiKey: string) {
      this.apiKey = apiKey
    }

    getGenerativeModel({ model }: { model: string }) {
      return {
        generateContent: async (prompt: unknown) => {
          mocks.calls.push({ apiKey: this.apiKey, model, prompt })
          return mocks.generateContentMock(this.apiKey, model, prompt)
        },
      }
    }
  },
}))

describe('gemini provider routing', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.generateContentMock.mockReset()
    mocks.fetchMock.mockReset()
    mocks.calls.length = 0
    vi.stubGlobal('fetch', mocks.fetchMock)

    delete process.env['GEMINI_API_KEY']
    delete process.env['GEMINI_PHOTO_API_KEY']
    delete process.env['GEMINI_PHOTO_PROJECT_ID']
    delete process.env['GEMINI_MODEL_PHOTO_PRIMARY']
    delete process.env['GEMINI_MODEL_PHOTO_FALLBACK']
    delete process.env['GEMINI_ADVICE_API_KEY']
    delete process.env['GEMINI_ADVICE_PROJECT_ID']
    delete process.env['GEMINI_MODEL_ADVICE_PRIMARY']
    delete process.env['GEMINI_MODEL_ADVICE_FALLBACK']
    delete process.env['GEMINI_ALERT_WEBHOOK_URL']
    delete process.env['GEMINI_PHOTO_ERROR_THRESHOLD']
    delete process.env['GEMINI_ADVICE_ERROR_THRESHOLD']
    delete process.env['GEMINI_RATE_LIMIT_WINDOW_MINUTES']
  })

  it('uses the photo provider key and primary model for image analysis', async () => {
    process.env['GEMINI_PHOTO_API_KEY'] = 'photo-key'
    process.env['GEMINI_MODEL_PHOTO_PRIMARY'] = 'photo-primary'
    mocks.generateContentMock.mockResolvedValue({
      response: { text: () => 'photo-ok' },
    })

    const { generateGeminiTextFromImageAndPrompt } = await import('../gemini.js')

    const response = await generateGeminiTextFromImageAndPrompt(
      'prompt',
      { mimeType: 'image/png', data: 'abcd' },
      undefined,
      'photo',
    )

    expect(response).toBe('photo-ok')
    expect(mocks.calls).toEqual([
      {
        apiKey: 'photo-key',
        model: 'photo-primary',
        prompt: [
          { text: 'prompt' },
          { inlineData: { mimeType: 'image/png', data: 'abcd' } },
        ],
      },
    ])
  })

  it('falls back to the advice fallback model on quota errors', async () => {
    process.env['GEMINI_ADVICE_API_KEY'] = 'advice-key'
    process.env['GEMINI_MODEL_ADVICE_PRIMARY'] = 'advice-primary'
    process.env['GEMINI_MODEL_ADVICE_FALLBACK'] = 'advice-fallback'

    mocks.generateContentMock
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockResolvedValueOnce({ response: { text: () => 'advice-fallback-ok' } })

    const { askGeminiConsultation } = await import('../gemini.js')

    const response = await askGeminiConsultation('help', {}, 'advice')

    expect(response).toBe('advice-fallback-ok')
    expect(mocks.calls.map((entry) => ({ apiKey: entry.apiKey, model: entry.model }))).toEqual([
      { apiKey: 'advice-key', model: 'advice-primary' },
      { apiKey: 'advice-key', model: 'advice-fallback' },
    ])
  })

  it('sends an alert webhook after repeated provider failures', async () => {
    process.env['GEMINI_PHOTO_API_KEY'] = 'photo-key'
    process.env['GEMINI_MODEL_PHOTO_PRIMARY'] = 'photo-primary'
    process.env['GEMINI_MODEL_PHOTO_FALLBACK'] = 'photo-fallback'
    process.env['GEMINI_ALERT_WEBHOOK_URL'] = 'https://example.com/hook'
    process.env['GEMINI_PHOTO_ERROR_THRESHOLD'] = '1'

    mocks.fetchMock.mockResolvedValue({ ok: true })
    mocks.generateContentMock
      .mockRejectedValueOnce(new Error('429 quota exceeded'))
      .mockRejectedValueOnce(new Error('429 quota exceeded again'))

    const { generateGeminiTextFromImageAndPrompt } = await import('../gemini.js')

    await expect(generateGeminiTextFromImageAndPrompt(
      'prompt',
      { mimeType: 'image/png', data: 'abcd' },
      undefined,
      'photo',
    )).rejects.toThrow(/429/)

    expect(mocks.fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
    )
  })
})
