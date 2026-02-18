#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
レシピデータから全食材を抽出し、出現頻度とともにリスト化するスクリプト
"""

import json
import re
from collections import defaultdict
from pathlib import Path

def extract_all_ingredients(recipe_files):
    """全レシピから食材名と単位を抽出"""
    ingredient_stats = defaultdict(lambda: {"count": 0, "units": defaultdict(int)})
    
    for recipe_file in recipe_files:
        with open(recipe_file, 'r', encoding='utf-8') as f:
            recipes = json.load(f)
        
        for recipe in recipes:
            if 'ingredients' not in recipe:
                continue
            
            for ing in recipe['ingredients']:
                name = ing.get('name', '').strip()
                unit = ing.get('unit', '').strip()
                
                if not name:
                    continue
                
                ingredient_stats[name]["count"] += 1
                ingredient_stats[name]["units"][unit] += 1
    
    return ingredient_stats

def main():
    # レシピファイルのパス
    recipe_files = [
        Path('/home/ubuntu/my-recipe-app/src/data/recipes-healsio.json'),
        Path('/home/ubuntu/my-recipe-app/src/data/recipes-hotcook.json')
    ]
    
    print("食材データを抽出中...")
    ingredient_stats = extract_all_ingredients(recipe_files)
    
    # 出現頻度順にソート
    sorted_ingredients = sorted(
        ingredient_stats.items(),
        key=lambda x: x[1]["count"],
        reverse=True
    )
    
    print(f"\n抽出完了: {len(sorted_ingredients)}種類の食材を検出")
    
    # 結果をJSONファイルに保存
    output_data = []
    for name, stats in sorted_ingredients:
        # 最も使われている単位を取得
        most_common_unit = max(stats["units"].items(), key=lambda x: x[1])[0] if stats["units"] else "-"
        
        output_data.append({
            "original_name": name,
            "count": stats["count"],
            "most_common_unit": most_common_unit,
            "all_units": dict(stats["units"])
        })
    
    output_file = Path('/home/ubuntu/ingredients_raw.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"結果を保存: {output_file}")
    print(f"\n上位20件の食材:")
    for i, (name, stats) in enumerate(sorted_ingredients[:20], 1):
        most_common_unit = max(stats["units"].items(), key=lambda x: x[1])[0] if stats["units"] else "-"
        print(f"{i:2d}. {name:20s} ({stats['count']:4d}回, 主な単位: {most_common_unit})")

if __name__ == "__main__":
    main()
