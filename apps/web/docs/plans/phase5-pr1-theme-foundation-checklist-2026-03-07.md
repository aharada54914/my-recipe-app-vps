# Phase 5 PR-1 Theme Foundation Checklist

対象: `Warm Tactile Kitchen` paired theme の基盤実装

## Scope

- `system / light / dark` の設定追加
- 初回ロード時の theme bootstrap
- `data-theme` ベースの token 適用
- `theme-color` 同期
- 設定画面からの切替 UI
- 基盤レベルの unit / component / smoke test 追加

## Checklist

- [x] `UserPreferences` に `appearanceMode` を追加する
- [x] Dexie migration を追加して既存データへ `appearanceMode: 'system'` を補完する
- [x] preferences repository / default values を更新する
- [x] theme utility module を追加する
- [x] `index.html` に bootstrap script を追加し、React mount 前に `data-theme` を解決する
- [x] `PreferencesProvider` で appearance mode を DOM と localStorage mirror に同期する
- [x] `resolvedTheme` を context から参照できるようにする
- [x] `index.css` の token を semantic token ベースに組み替える
- [x] light / dark の paired theme 値を導入する
- [x] 既存 `bg-bg-*`, `text-*`, `accent` 系 class が新 token で動くように保つ
- [x] `StatusNotice` / `ui-btn` / `ui-input` などの base primitives を新 token に合わせる
- [x] Settings に `表示` タブを追加する
- [x] `AppearanceTab` を追加して `system / light / dark` を切り替え可能にする
- [x] 現在の解決テーマが UI 上で分かるようにする
- [x] unit test を追加する
- [x] component test を追加する
- [x] smoke test に theme persistence を追加する
- [x] `npm run lint` を通す
- [x] `npm test` を通す
- [x] `npm run build` を通す
- [x] `npm run test:smoke:ci` を通す

## Out of Scope

- BottomNav / Header の全面 redesign
- Home / WeeklyMenu の情報設計変更
- screenshot regression 導入
- glass class の全面削除
