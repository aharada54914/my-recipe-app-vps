/**
 * Reading dictionary (Yomigana) used for Japanese search expansion.
 *
 * Designed to be migrated to CSV in future;
 * keep keys canonical and values as normalized reading variants.
 */
export const readingMap: Record<string, string[]> = {
    鶏肉: ['とりにく'],
    豚肉: ['ぶたにく'],
    牛肉: ['ぎゅうにく'],
    玉ねぎ: ['たまねぎ'],
    じゃがいも: ['じゃがいも'],
    人参: ['にんじん'],
    大根: ['だいこん'],
    白菜: ['はくさい'],
    味噌: ['みそ'],
    醤油: ['しょうゆ'],
    鮭: ['しゃけ', 'さけ'],
    鯖: ['さば'],
    海老: ['えび'],
    烏賊: ['いか'],
    蕎麦: ['そば'],
}
