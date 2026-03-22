export interface SupportedRecipeSite {
  name: string
  domains: string[]
  importStrategy?: 'jsonld-first' | 'gemini-first'
}

const SUPPORTED_RECIPE_SITES: SupportedRecipeSite[] = [
  { name: 'みんなのきょうの料理', domains: ['kyounoryouri.jp', 'www.kyounoryouri.jp'] },
  { name: 'Nadia', domains: ['oceans-nadia.com', 'www.oceans-nadia.com'] },
  { name: '楽天レシピ', domains: ['recipe.rakuten.co.jp'] },
  { name: 'macaroni', domains: ['macaro-ni.jp', 'www.macaro-ni.jp'] },
  { name: 'E・レシピ', domains: ['erecipe.woman.excite.co.jp'] },
  { name: 'キッコーマン', domains: ['www.kikkoman.co.jp', 'kikkoman.co.jp'] },
  { name: '味の素パーク', domains: ['park.ajinomoto.co.jp'] },
  { name: 'フーディストノート', domains: ['foodistnote.recipe-blog.jp'], importStrategy: 'gemini-first' },
  { name: 'バズレシピ', domains: ['bazurecipe.com', 'www.bazurecipe.com'] },
  { name: 'つくおき', domains: ['cookien.com', 'www.cookien.com'] },
]

export const SUPPORTED_RECIPE_DOMAINS = Array.from(
  new Set(SUPPORTED_RECIPE_SITES.flatMap((site) => site.domains.map((domain) => domain.toLowerCase()))),
)

const REQUEST_TIMEOUT_MS = 12_000
const MAX_HTML_LENGTH = 2_000_000
const MAX_TEXT_LENGTH = 24_000

type JsonLdRecipeNode = Record<string, unknown>

export interface ExtractedRecipeSource {
  url: string
  host: string
  title: string
  imageUrl: string
  description: string
  text: string
  fetchStrategy: 'direct' | 'jina-ai-proxy'
  jsonLdRecipes: JsonLdRecipeNode[]
  warnings: string[]
}

export function resolveRecipeImportStrategy(hostname: string): 'jsonld-first' | 'gemini-first' {
  const host = hostname.toLowerCase()
  for (const site of SUPPORTED_RECIPE_SITES) {
    for (const domain of site.domains) {
      const normalized = domain.toLowerCase()
      if (host === normalized || host.endsWith(`.${normalized}`)) {
        return site.importStrategy ?? 'jsonld-first'
      }
    }
  }
  return 'jsonld-first'
}

export function parseSupportedRecipeUrl(rawUrl: string): URL {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawUrl)
  } catch {
    throw new Error('URL形式が不正です。')
  }

  if (!/^https?:$/.test(parsedUrl.protocol)) {
    throw new Error('http/https のURLのみ対応しています。')
  }

  const host = parsedUrl.hostname.toLowerCase()
  const supported = SUPPORTED_RECIPE_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  if (!supported) {
    throw new Error('このURLは現在未対応です。対応サイト一覧を確認してください。')
  }

  return parsedUrl
}

function extractMetaContent(html: string, propertyName: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${propertyName}["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+name=["']${propertyName}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }

  return ''
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeRecipeNodes(data: unknown): JsonLdRecipeNode[] {
  if (!data) return []
  if (Array.isArray(data)) return data.flatMap((item) => normalizeRecipeNodes(item))

  if (typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>
    const type = record['@type']
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
      return [record]
    }

    const graph = record['@graph']
    if (Array.isArray(graph)) {
      return graph.flatMap((item) => normalizeRecipeNodes(item))
    }
  }

  return []
}

function extractJsonLdRecipes(html: string): JsonLdRecipeNode[] {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const recipes: JsonLdRecipeNode[] = []

  for (const match of scripts) {
    try {
      const text = (match[1] || '').trim()
      if (!text) continue
      const parsed = JSON.parse(text) as unknown
      recipes.push(...normalizeRecipeNodes(parsed))
    } catch {
      // Skip invalid JSON-LD blocks.
    }
  }

  return recipes
}

async function fetchTextWithTimeout(url: string, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, { signal: controller.signal, headers })
    if (!response.ok) {
      throw new Error(`対象ページの取得に失敗しました (${response.status})`)
    }

    const body = await response.text()
    if (!body || body.length > MAX_HTML_LENGTH) {
      throw new Error('対象ページのサイズが大きすぎるか、本文を取得できませんでした。')
    }
    return body
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchDirectHtml(url: string): Promise<Omit<ExtractedRecipeSource, 'url' | 'host'>> {
  const html = await fetchTextWithTimeout(url, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    Referer: 'https://www.google.com/',
  })

  return {
    title: extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title'),
    imageUrl: extractMetaContent(html, 'og:image') || extractMetaContent(html, 'twitter:image'),
    description: extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description'),
    text: stripHtml(html).slice(0, MAX_TEXT_LENGTH),
    jsonLdRecipes: extractJsonLdRecipes(html),
    fetchStrategy: 'direct',
    warnings: [],
  }
}

async function fetchViaJinaAi(url: string, warnings: string[]): Promise<Omit<ExtractedRecipeSource, 'url' | 'host'>> {
  const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
  const text = await fetchTextWithTimeout(proxyUrl)

  return {
    title: '',
    imageUrl: '',
    description: '',
    text: text.slice(0, MAX_TEXT_LENGTH),
    jsonLdRecipes: [],
    fetchStrategy: 'jina-ai-proxy',
    warnings,
  }
}

export async function extractRecipeSourceFromUrl(rawUrl: string): Promise<ExtractedRecipeSource> {
  const parsedUrl = parseSupportedRecipeUrl(rawUrl)
  const warnings: string[] = []

  try {
    const extracted = await fetchDirectHtml(parsedUrl.toString())
    return {
      url: parsedUrl.toString(),
      host: parsedUrl.hostname,
      ...extracted,
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'direct fetch failed')
  }

  try {
    const extracted = await fetchViaJinaAi(parsedUrl.toString(), warnings)
    return {
      url: parsedUrl.toString(),
      host: parsedUrl.hostname,
      ...extracted,
    }
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : 'jina.ai fallback failed')
    throw new Error(`URL取得に失敗しました。${warnings.join(' / ')}`)
  }
}
