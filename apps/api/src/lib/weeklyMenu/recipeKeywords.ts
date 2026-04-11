// Warm dishes: suited for cold/rainy weather
export const WARM_TITLE_RE =
  /鍋|シチュー|ポトフ|おでん|煮込み|グラタン|ラーメン|うどん|そば|けんちん|雑炊|おじや|ポワレ|ブレゼ|スープ/

// Cold dishes: suited for hot weather
export const COLD_TITLE_RE =
  /冷|サラダ|さっぱり|あえ|マリネ|カルパッチョ|ガスパチョ|そうめん|冷製/

// Spicy / warming ingredients
export const SPICE_KEYWORDS_RE =
  /唐辛子|一味|七味|豆板醤|コチュジャン|キムチ|カレー|チリ|タバスコ|ラー油|鷹の爪|ハラペーニョ|サンバル/

// Solar irradiance factor by JMA weather code prefix
// 1xx = sunny (~1.0), 2xx = cloudy (~0.4), 3xx+ = rainy (~0.1)
export function solarFactor(weatherCode: string): number {
  const prefix = weatherCode.slice(0, 1)
  if (prefix === '1') return 1.0
  if (prefix === '2') return 0.4
  return 0.1
}
