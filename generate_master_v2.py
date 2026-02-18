#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
食材マスターデータを生成し、Markdown表として出力するスクリプト（改善版）
- TOP 200まで出力
"""

import json
from pathlib import Path

def categorize_ingredient(name):
    """食材をカテゴリ分類"""
    # 調味料
    seasonings = ['塩', 'しょうゆ', '砂糖', '酒', 'みりん', 'こしょう', '塩・こしょう', 
                  'サラダ油', 'ごま油', 'オリーブオイル', '片栗粉', '薄力粉', '強力粉',
                  'マヨネーズ', '酢', 'ケチャップ', 'ソース', 'だし', 'めんつゆ', 
                  'コンソメ', '鶏がらスープの素', '味噌', 'みそ', 'オイスターソース',
                  'ウスターソース', 'バルサミコ酢', '黒酢', 'カレー粉', 'カレールウ']
    
    # 野菜
    vegetables = ['たまねぎ', 'にんじん', 'ねぎ', 'にんにく', 'しょうが', 'トマト',
                  'ピーマン', 'じゃがいも', 'パプリカ', 'なす', 'きゅうり', 'キャベツ',
                  'はくさい', 'だいこん', 'ほうれん草', 'こまつな', 'ブロッコリー',
                  'もやし', 'かぼちゃ', 'れんこん', 'ごぼう', 'さつまいも', 'アスパラ']
    
    # きのこ類
    mushrooms = ['しめじ', 'えのき', 'しいたけ', 'まいたけ', '干ししいたけ', 'エリンギ', 'きくらげ']
    
    # 肉類
    meats = ['鶏肉', '豚肉', '牛肉', 'ひき肉', 'ベーコン', 'ハム', 'ソーセージ', 'ウインナー']
    
    # 魚介類
    seafood = ['魚', 'えび', 'いか', 'たこ', 'ほたて', 'あさり', 'さば', 'さけ', 'まぐろ', 
               'ぶり', 'たら', 'かつお', 'いわし', 'さんま']
    
    # 乳製品・卵
    dairy = ['卵', '牛乳', 'バター', 'チーズ', 'ピザ用チーズ', '生クリーム', 'ヨーグルト']
    
    # 穀物・麺類
    grains = ['米', 'パン', 'パスタ', 'うどん', 'そば', 'ラーメン', 'そうめん', 'スパゲティ']
    
    # 豆類・豆製品
    beans = ['豆腐', '厚揚げ', '油揚げ', '納豆', '大豆', '枝豆', '絹ごし豆腐', '木綿豆腐']
    
    # その他
    name_lower = name.lower()
    
    if any(s in name for s in seasonings):
        return '調味料'
    elif any(v in name for v in vegetables):
        return '野菜'
    elif any(m in name for m in mushrooms):
        return 'きのこ類'
    elif any(m in name for m in meats):
        return '肉類'
    elif any(f in name for f in seafood):
        return '魚介類'
    elif any(d in name for d in dairy):
        return '乳製品・卵'
    elif any(g in name for g in grains):
        return '穀物・麺類'
    elif any(b in name for b in beans):
        return '豆類・豆製品'
    else:
        return 'その他'

def main():
    # クリーニング済みデータを読み込み
    input_file = Path('/home/ubuntu/ingredients_cleaned_v2.json')
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"マスターデータ生成開始: {len(data)}件")
    
    # カテゴリ分類
    categorized = {}
    for item in data:
        category = categorize_ingredient(item['name'])
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(item)
    
    # Markdown表を生成
    markdown_lines = ["# 食材マスターデータ（改善版）\n"]
    markdown_lines.append(f"**生成日**: 2026年2月18日\n")
    markdown_lines.append(f"**総食材数**: {len(data)}種類\n")
    markdown_lines.append(f"**元データ**: my-recipe-app レシピ1,722件から抽出\n")
    markdown_lines.append("\n## 改善内容\n")
    markdown_lines.append("- ✅ 水・お湯など調達容易なものを除外\n")
    markdown_lines.append("- ✅ 「各」を含む単位は分割してカウント\n")
    markdown_lines.append("- ✅ 社名・ブランド名を削除\n")
    markdown_lines.append("- ✅ TOP 200まで出力\n")
    markdown_lines.append("\n---\n")
    
    # カテゴリごとに出力
    category_order = ['調味料', '野菜', 'きのこ類', '肉類', '魚介類', '乳製品・卵', '豆類・豆製品', '穀物・麺類', 'その他']
    
    for category in category_order:
        if category not in categorized:
            continue
        
        items = categorized[category]
        markdown_lines.append(f"\n## {category} ({len(items)}種類)\n")
        markdown_lines.append("\n| No. | 食材名 | 標準単位 | 出現回数 |\n")
        markdown_lines.append("|-----|--------|----------|----------|\n")
        
        # 出現頻度順にソート
        items_sorted = sorted(items, key=lambda x: x['count'], reverse=True)
        
        # 上位30件まで表示
        for i, item in enumerate(items_sorted[:30], 1):
            name = item['name']
            unit = item['unit']
            count = item['count']
            markdown_lines.append(f"| {i} | {name} | {unit} | {count} |\n")
        
        if len(items_sorted) > 30:
            markdown_lines.append(f"\n*他 {len(items_sorted) - 30}種類*\n")
    
    # 全体リスト（出現頻度順トップ200）
    markdown_lines.append("\n---\n")
    markdown_lines.append("\n## 出現頻度ランキング TOP 200\n")
    markdown_lines.append("\n| 順位 | 食材名 | カテゴリ | 標準単位 | 出現回数 |\n")
    markdown_lines.append("|------|--------|----------|----------|----------|\n")
    
    for i, item in enumerate(data[:200], 1):
        name = item['name']
        category = categorize_ingredient(name)
        unit = item['unit']
        count = item['count']
        markdown_lines.append(f"| {i} | {name} | {category} | {unit} | {count} |\n")
    
    # ファイルに保存
    output_file = Path('/home/ubuntu/ingredients_master_v2.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(markdown_lines)
    
    print(f"マスターデータを保存: {output_file}")
    print(f"\nカテゴリ別集計:")
    for category in category_order:
        if category in categorized:
            print(f"  {category}: {len(categorized[category])}種類")

if __name__ == "__main__":
    main()
