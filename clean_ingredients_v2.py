#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
食材名のノイズ除去・名寄せ・単位統一を行うスクリプト（改善版）
- 水・お湯など調達容易なものを除外
- 「各」を含む単位は分割してカウント
- 社名・ブランド名を削除
"""

import json
import re
from collections import defaultdict
from pathlib import Path

# 除外する食材（水・お湯など調達容易なもの）
EXCLUDED_INGREDIENTS = [
    '水', 'お湯', '湯', '熱湯', '冷水', '氷水', '氷',
    '水またはだし汁', '水　または　だし', 
]

# 社名・ブランド名パターン
BRAND_PATTERNS = [
    r'ミツカン\s*',
    r'味の素[㈱株式会社]*\s*',
    r'カネテツ\s*',
    r'神州一味噌\s*',
    r'キッコーマン\s*',
    r'「[^」]*」\s*',  # 「ほんだし®」などの商品名
    r'®',
    r'™',
    r'㈱',
    r'株式会社',
    r'市販の',
]

# ノイズパターン（削除対象）
NOISE_PATTERNS = [
    r'[☆★○●◎◇◆□■△▲▽▼※]',
    r'[A-Z]\s*(?![a-z])',  # 単独のアルファベット大文字
    r'\([A-Z]\)',
    r'国産',
    r'[都道府県]\s*産',
    r'特選',
    r'高級',
    r'みじん切り',
    r'一口大',
    r'薄切り',
    r'細切り',
    r'角切り',
    r'千切り',
    r'乱切り',
    r'輪切り',
    r'半月切り',
    r'いちょう切り',
    r'拍子木切り',
    r'水気を切った',
    r'水けを切った',
    r'冷凍',
    r'解凍',
    r'下ゆで',
    r'ゆでた',
    r'茹でた',
    r'炒めた',
    r'焼いた',
    r'蒸した',
    r'お好みで',
    r'あれば',
    r'好みで',
    r'長さ\d+cm程度の',
    r'\d+cm角',
]

# 名寄せルール
NORMALIZATION_RULES = {
    # 肉類
    r'豚.*こま.*': '豚肉（こま）',
    r'豚.*バラ.*': '豚肉（バラ）',
    r'豚.*ロース.*': '豚肉（ロース）',
    r'豚.*もも.*': '豚肉（もも）',
    r'豚.*ひき.*': '豚ひき肉',
    r'鶏.*もも.*': '鶏肉（もも）',
    r'鶏.*むね.*': '鶏肉（むね）',
    r'鶏.*ささみ.*': '鶏肉（ささみ）',
    r'鶏.*ひき.*': '鶏ひき肉',
    r'牛.*切り落とし.*': '牛肉（切り落とし）',
    r'牛.*ひき.*': '牛ひき肉',
    r'合いびき.*': '合いびき肉',
    
    # 野菜類
    r'人参|ニンジン': 'にんじん',
    r'玉ねぎ|玉葱|タマネギ': 'たまねぎ',
    r'じゃが芋|ジャガイモ': 'じゃがいも',
    r'キャベツ': 'キャベツ',
    r'白菜|はくさい': 'はくさい',
    r'大根|だいこん': 'だいこん',
    r'ピーマン': 'ピーマン',
    r'トマト': 'トマト',
    r'なす|ナス|茄子': 'なす',
    r'きゅうり|キュウリ|胡瓜': 'きゅうり',
    r'ほうれん草|ホウレンソウ': 'ほうれん草',
    r'小松菜|コマツナ': 'こまつな',
    r'ブロッコリー': 'ブロッコリー',
    r'もやし|モヤシ': 'もやし',
    r'長ねぎ|長ネギ|ねぎ|ネギ': 'ねぎ',
    r'青ねぎ|青ネギ': '青ねぎ',
    r'しょうが|ショウガ|生姜': 'しょうが',
    r'にんにく|ニンニク': 'にんにく',
    r'れんこん|レンコン|蓮根': 'れんこん',
    
    # きのこ類
    r'生しいたけ|しいたけ': 'しいたけ',
    r'干ししいたけ|干しいたけ': '干ししいたけ',
    r'しめじ|ぶなしめじ': 'しめじ',
    r'えのきだけ|えのき': 'えのき',
    r'まいたけ': 'まいたけ',
    
    # 卵・乳製品
    r'卵|玉子|タマゴ|たまご': '卵',
    r'牛乳': '牛乳',
    r'バター': 'バター',
    r'チーズ': 'チーズ',
    r'ピザ用チーズ': 'ピザ用チーズ',
    
    # 調味料
    r'しょうゆ|醤油': 'しょうゆ',
    r'みりん': 'みりん',
    r'酒': '酒',
    r'砂糖': '砂糖',
    r'塩': '塩',
    r'こしょう|胡椒|コショウ': 'こしょう',
    r'塩[、・]こしょう': '塩・こしょう',
    r'サラダ油': 'サラダ油',
    r'ごま油|胡麻油': 'ごま油',
    r'オリーブオイル|オリーブ油': 'オリーブオイル',
    r'片栗粉': '片栗粉',
    r'薄力粉': '薄力粉',
    r'強力粉': '強力粉',
}

# 単位の統一ルール
UNIT_NORMALIZATION = {
    'cc': 'ml',
    'CC': 'ml',
    'mL': 'ml',
    'ｍｌ': 'ml',
    'カップ': 'ml',
    'グラム': 'g',
    'ｇ': 'g',
    '適量': '-',
    '少々': '-',
    'お好みで': '-',
    'M個': '個',
    'L個': '個',
    'S個': '個',
}

def should_exclude(name):
    """除外すべき食材かどうか判定"""
    return name in EXCLUDED_INGREDIENTS or name.startswith('水') or name.startswith('お湯')

def remove_brands(name):
    """社名・ブランド名を削除"""
    cleaned = name
    for pattern in BRAND_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned)
    return cleaned.strip()

def remove_noise(name):
    """ノイズパターンを削除"""
    cleaned = name
    for pattern in NOISE_PATTERNS:
        cleaned = re.sub(pattern, '', cleaned)
    return cleaned.strip()

def normalize_name(name):
    """名寄せルールを適用"""
    for pattern, normalized in NORMALIZATION_RULES.items():
        if re.search(pattern, name):
            return normalized
    return name

def normalize_unit(unit):
    """単位を統一"""
    return UNIT_NORMALIZATION.get(unit, unit)

def split_combined_ingredients(name, unit):
    """「各」を含む単位の場合、食材を分割"""
    # 「各」が含まれている場合
    if '各' in unit:
        # 食材名に「、」や「・」が含まれている場合は分割
        if '、' in name or '・' in name:
            # 分割
            parts = re.split('[、・]', name)
            return [(part.strip(), unit.replace('各', '')) for part in parts if part.strip()]
    
    return [(name, unit)]

def main():
    # 生データを読み込み
    input_file = Path('/home/ubuntu/ingredients_raw.json')
    with open(input_file, 'r', encoding='utf-8') as f:
        raw_data = json.load(f)
    
    print(f"処理開始: {len(raw_data)}件の食材")
    
    # クリーニングと名寄せ
    cleaned_ingredients = defaultdict(lambda: {"count": 0, "units": defaultdict(int)})
    
    for item in raw_data:
        original_name = item['original_name']
        count = item['count']
        
        # ステップ1: 社名・ブランド名削除
        name_no_brand = remove_brands(original_name)
        
        # ステップ2: ノイズ除去
        cleaned_name = remove_noise(name_no_brand)
        
        # ステップ3: 名寄せ
        normalized_name = normalize_name(cleaned_name)
        
        # 空になった場合はスキップ
        if not normalized_name:
            continue
        
        # ステップ4: 除外判定
        if should_exclude(normalized_name):
            continue
        
        # ステップ5: 「各」を含む単位の分割処理
        for unit, unit_count in item['all_units'].items():
            normalized_unit = normalize_unit(unit)
            
            # 分割処理
            split_items = split_combined_ingredients(normalized_name, normalized_unit)
            
            for split_name, split_unit in split_items:
                # 再度名寄せ（分割後の名前に対して）
                final_name = normalize_name(split_name)
                if not final_name or should_exclude(final_name):
                    continue
                
                # 集計
                cleaned_ingredients[final_name]["count"] += count * unit_count
                cleaned_ingredients[final_name]["units"][split_unit] += unit_count
    
    # 出現頻度順にソート
    sorted_ingredients = sorted(
        cleaned_ingredients.items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )
    
    print(f"クリーニング完了: {len(sorted_ingredients)}種類に集約")
    
    # 結果を保存
    output_data = []
    for name, stats in sorted_ingredients:
        # 最も使われている単位を取得
        most_common_unit = max(stats["units"].items(), key=lambda x: x[1])[0] if stats["units"] else "-"
        
        output_data.append({
            "name": name,
            "count": stats["count"],
            "unit": most_common_unit,
            "all_units": dict(stats["units"])
        })
    
    output_file = Path('/home/ubuntu/ingredients_cleaned_v2.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"結果を保存: {output_file}")
    print(f"\n上位30件の食材:")
    for i, (name, stats) in enumerate(sorted_ingredients[:30], 1):
        most_common_unit = max(stats["units"].items(), key=lambda x: x[1])[0] if stats["units"] else "-"
        print(f"{i:2d}. {name:20s} ({stats['count']:4d}回, 単位: {most_common_unit})")

if __name__ == "__main__":
    main()
