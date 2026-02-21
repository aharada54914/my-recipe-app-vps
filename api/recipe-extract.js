const SUPPORTED_DOMAINS = [
  'kyounoryouri.jp',
  'www.kyounoryouri.jp',
  'oceans-nadia.com',
  'www.oceans-nadia.com',
  'recipe.rakuten.co.jp',
  'macaro-ni.jp',
  'www.macaro-ni.jp',
  'erecipe.woman.excite.co.jp',
  'www.kikkoman.co.jp',
  'kikkoman.co.jp',
  'park.ajinomoto.co.jp',
  'foodistnote.recipe-blog.jp',
  'bazurecipe.com',
  'www.bazurecipe.com',
  'cookien.com',
  'www.cookien.com',
]

const REQUEST_TIMEOUT_MS = 12000
const MAX_HTML_LENGTH = 2_000_000

function normalizeDomain(hostname) {
  return hostname.toLowerCase()
}

function isSupportedHost(hostname) {
  const host = normalizeDomain(hostname)
  return SUPPORTED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

function extractMetaContent(html, propertyName) {
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

function stripHtml(html) {
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

function normalizeRecipeNodes(data) {
  if (!data) return []
  if (Array.isArray(data)) return data.flatMap((item) => normalizeRecipeNodes(item))

  if (typeof data === 'object') {
    const type = data['@type']
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
      return [data]
    }

    if (Array.isArray(data['@graph'])) {
      return data['@graph'].flatMap((item) => normalizeRecipeNodes(item))
    }
  }

  return []
}

function extractJsonLdRecipes(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const recipes = []

  for (const match of scripts) {
    try {
      const text = (match[1] || '').trim()
      if (!text) continue
      const parsed = JSON.parse(text)
      recipes.push(...normalizeRecipeNodes(parsed))
    } catch {
      // Skip invalid block
    }
  }

  return recipes
}

async function fetchWithTimeout(url) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'KitchenAppBot/1.5 (+https://example.local)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!res.ok) {
      throw new Error(`対象ページの取得に失敗しました (${res.status})`)
    }

    const html = await res.text()
    if (!html || html.length > MAX_HTML_LENGTH) {
      throw new Error('対象ページのサイズが大きすぎるか、本文を取得できませんでした。')
    }

    return html
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const rawUrl = req.query.url
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
      return res.status(400).json({ ok: false, error: 'url クエリが必要です。' })
    }

    let parsedUrl
    try {
      parsedUrl = new URL(rawUrl)
    } catch {
      return res.status(400).json({ ok: false, error: 'URL形式が不正です。' })
    }

    if (!/^https?:$/.test(parsedUrl.protocol)) {
      return res.status(400).json({ ok: false, error: 'http/https のURLのみ対応しています。' })
    }

    if (!isSupportedHost(parsedUrl.hostname)) {
      return res.status(400).json({
        ok: false,
        error: 'このURLは現在未対応です。対応サイト一覧を確認してください。',
        supportedDomains: SUPPORTED_DOMAINS,
      })
    }

    const html = await fetchWithTimeout(parsedUrl.toString())
    const jsonLdRecipes = extractJsonLdRecipes(html)
    const text = stripHtml(html).slice(0, 24000)

    return res.status(200).json({
      ok: true,
      url: parsedUrl.toString(),
      host: parsedUrl.hostname,
      title: extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title'),
      imageUrl: extractMetaContent(html, 'og:image') || extractMetaContent(html, 'twitter:image'),
      description: extractMetaContent(html, 'og:description') || extractMetaContent(html, 'description'),
      jsonLdRecipes,
      text,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : '抽出処理に失敗しました。',
    })
  }
}
