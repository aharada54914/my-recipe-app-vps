export interface SupportedRecipeSite {
  name: string
  url: string
  description: string
  domains: string[]
  importStrategy?: 'jsonld-first' | 'gemini-first'
}

export const SUPPORTED_RECIPE_SITES: SupportedRecipeSite[] = [
  {
    name: 'みんなのきょうの料理',
    url: 'https://www.kyounoryouri.jp/',
    description: '公共放送関連。基本に忠実で客観性が高い。',
    domains: ['kyounoryouri.jp', 'www.kyounoryouri.jp'],
  },
  {
    name: 'Nadia（ナディア）',
    url: 'https://oceans-nadia.com/',
    description: '審査を通過したプロのレシピ。',
    domains: ['oceans-nadia.com', 'www.oceans-nadia.com'],
  },
  {
    name: '楽天レシピ',
    url: 'https://recipe.rakuten.co.jp/',
    description: '一般投稿型。人気順検索に対応。',
    domains: ['recipe.rakuten.co.jp'],
  },
  {
    name: 'macaroni（マカロニ）',
    url: 'https://macaro-ni.jp/',
    description: 'トレンド系の料理メディア。',
    domains: ['macaro-ni.jp', 'www.macaro-ni.jp'],
  },
  {
    name: 'E・レシピ',
    url: 'https://erecipe.woman.excite.co.jp/',
    description: 'プロ監修の献立提案が強み。',
    domains: ['erecipe.woman.excite.co.jp'],
  },
  {
    name: 'キッコーマン ホームクッキング',
    url: 'https://www.kikkoman.co.jp/homecook/',
    description: '食品メーカー公式の定番和食。',
    domains: ['www.kikkoman.co.jp', 'kikkoman.co.jp'],
  },
  {
    name: '味の素パーク',
    url: 'https://park.ajinomoto.co.jp/',
    description: '食品メーカー公式。手軽で早い料理。',
    domains: ['park.ajinomoto.co.jp'],
  },
  {
    name: 'フーディストノート',
    url: 'https://foodistnote.recipe-blog.jp/',
    description: '料理ブロガー記事の集約サイト。',
    domains: ['foodistnote.recipe-blog.jp'],
    importStrategy: 'gemini-first',
  },
  {
    name: 'リュウジのバズレシピ.com',
    url: 'https://bazurecipe.com/',
    description: '時短・簡単系レシピ。',
    domains: ['bazurecipe.com', 'www.bazurecipe.com'],
  },
  {
    name: 'つくおき',
    url: 'https://cookien.com/',
    description: '作り置き特化。日持ち情報付き。',
    domains: ['cookien.com', 'www.cookien.com'],
  },
]

export const SUPPORTED_RECIPE_DOMAINS = Array.from(
  new Set(SUPPORTED_RECIPE_SITES.flatMap((site) => site.domains.map((domain) => domain.toLowerCase())))
)

export type RecipeImportStrategy = 'jsonld-first' | 'gemini-first'

const RECIPE_IMPORT_STRATEGY_BY_DOMAIN = new Map<string, RecipeImportStrategy>()

for (const site of SUPPORTED_RECIPE_SITES) {
  const strategy = site.importStrategy ?? 'jsonld-first'
  for (const domain of site.domains) {
    RECIPE_IMPORT_STRATEGY_BY_DOMAIN.set(domain.toLowerCase(), strategy)
  }
}

export function resolveRecipeImportStrategy(hostname: string): RecipeImportStrategy {
  const host = hostname.toLowerCase()

  const exact = RECIPE_IMPORT_STRATEGY_BY_DOMAIN.get(host)
  if (exact) return exact

  for (const [domain, strategy] of RECIPE_IMPORT_STRATEGY_BY_DOMAIN.entries()) {
    if (host.endsWith(`.${domain}`)) return strategy
  }

  return 'jsonld-first'
}
