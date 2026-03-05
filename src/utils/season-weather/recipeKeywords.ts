/**
 * recipeKeywords.ts — 温冷・辛みキーワード正規表現（共通定義）
 *
 * weatherScoring.ts / recipeWeatherVectors.ts / tOptLearner.ts で
 * 同一キーワードを使用するため、ここで一元管理する。
 */

/** 温料理タイトルキーワード（鍋・煮込み・スープ系） */
export const WARM_TITLE_RE =
  /鍋|シチュー|ポトフ|おでん|煮込み|グラタン|ラーメン|うどん|そば|けんちん|雑炊|おじや|ポワレ|ブレゼ|スープ/

/** 冷料理タイトルキーワード（冷製・サラダ系） */
export const COLD_TITLE_RE =
  /冷|サラダ|さっぱり|あえ|マリネ|カルパッチョ|ガスパチョ|そうめん|冷製/

/** 辛み食材・タイトルキーワード */
export const SPICE_KEYWORDS_RE =
  /唐辛子|一味|七味|豆板醤|コチュジャン|キムチ|カレー|チリ|タバスコ|ラー油|鷹の爪|ハラペーニョ|サンバル/
