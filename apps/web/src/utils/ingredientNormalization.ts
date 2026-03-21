const NAME_PREFIXES = [
  'お好みの',
  '好みの',
  '市販の',
  '適量の',
  'おすすめの',
] as const

const NAME_SUFFIXES = [
  'など',
  '等',
  '少々',
  '適量',
] as const

const SYNONYM_RULES: Array<[RegExp, string]> = [
  [/^(?:ささ身|ささみ|鶏ささ身)$/, '鶏ささみ'],
  [/^(?:市販の)?カレールウ$/, 'カレールウ'],
  [/^ルウ$/, 'カレールウ'],
  [/^好みのドレッシング$/, 'ドレッシング'],
  [/^.*ホットケーキ.*(?:のもと|ミックス).*$/, 'ホットケーキミックス'],
  [/^しし唐辛子$/, 'ししとう'],
  [/^きぬさや$/, 'さやいんげん'],
  [/^サラダ菜$/, 'レタス'],
  [/^絹さや$/, 'さやいんげん'],
  [/^具材$/, '野菜'],
  [/^きのこ$/, 'マッシュルーム'],
  [/^揚げ豚$/, '豚肉'],
  [/^好みのハーブ$/, 'パセリ'],
  [/^ハーブ$/, 'パセリ'],
  [/^ハーブミックス$/, 'パセリ'],
  [/^中華めん$/, '中華麺'],
  [/^梅肉$/, '梅干し'],
  [/^赤$/, 'パプリカ'],
  [/^黄$/, 'パプリカ'],
  [/^緑$/, 'ピーマン'],
]

function normalizeAscii(value: string): string {
  return value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/[Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(/，/g, ',')
    .replace(/．/g, '.')
    .replace(/[／]/g, '/')
    .replace(/[〜～]/g, '~')
}

export function normalizeIngredientName(rawName: string): string {
  let name = normalizeAscii(rawName)
    .replace(/[［[][^］\]]*[］\]]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim()

  for (const prefix of NAME_PREFIXES) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
      break
    }
  }
  for (const suffix of NAME_SUFFIXES) {
    if (name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length)
      break
    }
  }

  for (const [pattern, replacement] of SYNONYM_RULES) {
    if (pattern.test(name)) {
      return name.replace(pattern, replacement)
    }
  }
  return name
}
