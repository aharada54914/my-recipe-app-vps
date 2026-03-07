# Phase 5 PR-2 App Chrome Checklist

対象: `Warm Tactile Kitchen` paired theme を前提にしたスマホ向け app chrome の整理

## Scope

- BottomNav のラベル付き化
- active tab の明示
- Header の utility 圧縮
- 本文と fixed nav の安全余白整理
- App chrome に対する component / smoke 更新

## Checklist

- [x] `BottomNav` を icon-only から `icon + label` に変更する
- [x] active tab に `aria-current` と視覚的 indicator を付与する
- [x] `BottomNav` の色と面を semantic token ベースへ寄せる
- [x] `Header` のガラス感を弱め、warm matte surface に寄せる
- [x] 右上 utility を圧縮し、ログイン CTA をヘッダーから外す
- [x] ログイン済み時は avatar から設定へ入れるようにする
- [x] `AppLayout` に下部 safe area を反映する
- [x] `SettingsPage` に下部 safe area を反映する
- [x] 設定一覧のカード見た目を paired theme に寄せる
- [x] `BottomNav` component test を追加する
- [x] smoke test で nav label と active state を確認する
- [x] `npm run lint` を通す
- [x] `npm test` を通す
- [x] `npm run build` を通す
- [x] `CI=1 npm run test:smoke:ci` を通す

## Out of Scope

- Home の情報設計刷新
- Gemini / Search hero の再配置
- Weekly Menu の縦圧縮
- Header 内の通知や検索導線の再統合
