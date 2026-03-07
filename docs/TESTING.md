# Testing Guide

最終改訂: 2026-03-07

Kitchen App の現在のテスト運用をまとめます。Phase 6 で、単一の smoke spec 依存から `unit / smoke / visual / class audit` の多層構成へ移行しています。

---

## 1. テストレイヤ

### 1.1 Unit / Component

実行:

```bash
npm test
```

対象:
- 純ロジック
- theme
- integration status
- QA mode helper
- 一部コンポーネント

---

### 1.2 Smoke

実行:

```bash
npm run test:smoke:ci
```

iPhone Safari 想定の検索回帰だけを WebKit で確認する場合:

```bash
npm run test:smoke:safari-search
```

ローカル build を含めて一括確認する場合:

```bash
npm run test:smoke
```

主な spec:
- `tests/smoke/navigation.spec.ts`
  - iPhone Safari 想定の日本語入力順序回帰
  - 検索 URL は blur 後にのみ同期
  - 検索ファセットの複合 AND 絞り込み
  - カテゴリ grid が viewport 内に収まること
  - ヘルプ記事からの CTA 遷移
- `tests/smoke/home-priority.spec.ts`
- `tests/smoke/gemini-entry.spec.ts`
- `tests/smoke/weekly-menu-core.spec.ts`
  - 買い物リスト / ガントモーダルの viewport 内表示
- `tests/smoke/weekly-menu-editing.spec.ts`
- `tests/smoke/connected-google.spec.ts`
- `tests/smoke/connected-gemini.spec.ts`

---

### 1.3 Visual Regression

実行:

```bash
npm run test:visual
```

スナップショット更新:

```bash
npm run test:visual:update
```

対象:
- home
- search
- gemini
- weekly menu
- settings connected states

Playwright はモバイル想定で実行します。

---

### 1.4 UI Class Audit

実行:

```bash
npm run ui:class-audit
```

`scripts/ui-class-audit.mjs` が以下の残存数を監査します。

- `bg-white/5`
- `bg-white/10`
- `bg-white/15`
- `ring-white/10`
- `ring-white/15`
- `backdrop-blur`
- `liquid-background`

用途:
- glass 系の残滓を棚卸しする
- token migration の進捗を監視する

---

## 2. QA Google モード

connected flow を実アカウントなしで検証するためのモードです。

有効化:

- URL に `?qa-google=1` を付与
- または `設定 > 詳細設定 > 接続フロー検証`
- 旧 URL の `/settings/data?qa-google=1` でも詳細設定へ移動

モック対象:
- Google ログイン状態
- Google Drive バックアップ / 復元
- Google Calendar 登録

使いどころ:
- smoke test
- visual regression
- 手動 UI 監査
- 接続状態 UI の回帰確認

注意:
- 本番データや実アカウントには触れない
- localStorage を使うため、ブラウザデータを消すと QA データも消える

---

## 3. 推奨ローカル検証順

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. `npm run test:smoke:ci`
5. `npm run test:visual`
6. `npm run ui:class-audit`

UI を大きく変更した場合:
- `npm run test:visual:update`
- 変更意図に沿った snapshot か人間の目で確認する

---

## 4. 補足

- 旧 `tests/smoke/app.smoke.spec.ts` は廃止済み
- 現行の基準は route / flow 単位の smoke と visual snapshot
- テストの追加時は、1 つの大規模 spec に責務を寄せず、画面またはユースケース単位で分割する
