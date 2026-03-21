# Kitchen App — Smart Recipe Manager PWA

最終改訂: 2026-03-07

ホットクック / ヘルシオ向けのレシピ管理 PWA です。  
スマホ利用を前提に、`レシピ検索` と `AI 相談` を主導線に置きつつ、週間献立、在庫管理、Google 連携までを 1 つのアプリで扱います。

---

## 主な機能

- レシピ検索
  - 約 1,700 件のレシピをあいまい検索
  - 最近の検索、カテゴリ / 機器 / 時短 / 旬フィルタ
  - 別グループは AND、同一グループ内は OR の複合絞り込み
  - カテゴリは横スクロール不要の grid 表示
  - iPhone Safari の日本語入力で文字順が崩れにくい IME-safe 入力制御
  - 在庫一致率と好みシグナルによる並び替え
- AI 相談
  - URL 取り込み
  - 写真から食材抽出
  - 在庫から提案
  - Gemini チャット履歴保持と再試行導線
- 週間献立
  - 7 日分の献立生成
  - `再生成` 時に unlock 日の主菜を最低 4 日、または 60% 以上変更
  - 天気考慮スコアリング
  - 買い物リスト自動生成 / 編集
  - QR 共有、共有コード取り込み、Google Calendar 登録
- 在庫管理
  - 明示的な `+1 / -1 / 数量入力 / 削除`
  - 最近使った食材からの即時追加
  - 在庫 QR 共有 / 受信
- Google 連携
  - Google ログイン
  - Google Drive バックアップ / 復元
  - Google Calendar 連携
- テーマ / UI
  - `Warm Tactile Kitchen` ベースの light / dark / system 対応
  - ラベル付き BottomNav
  - safe-area 対応の sticky header / bottom nav
- ヘルプ
  - `まずはここから / よく使う操作 / 共有・移行 / 困ったとき`
  - 記事ごとの CTA と状態チップ
- 品質基盤
  - Vitest による unit / component test
  - Playwright による smoke test / visual regression
  - `ui:class-audit` による glass class 残滓監査

---

## クイックスタート

Node.js `22.12.0+` 推奨です。

```bash
npm install
npm run dev
```

この repository は現在 `apps/web`、`apps/api`、`apps/cli`、`packages/shared-types` を含む npm workspace 構成です。

Google OAuth や Gemini を使う場合のみ、ルートに `.env` を作成してください。

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GEMINI_API_KEY=your-gemini-api-key
```

補足:
- `VITE_GOOGLE_CLIENT_ID` がない場合でもアプリ自体は起動します
- `VITE_GEMINI_API_KEY` は設定画面保存値より `.env` が優先されます

---

## 主要コマンド

```bash
npm run dev
npm run build
npm run lint
npm test
npm run test:smoke:ci
npm run ops:ps
npm run ops:health
npm run ops:logs
npm run test:visual
npm run ui:class-audit
```

スナップショット更新:

```bash
npm run test:visual:update
```

---

## QA モード

Google 実アカウントなしで接続済みフローを検証できます。

- 有効化: `/settings/advanced?qa-google=1`
- 対象:
  - Google ログイン済み状態
  - Google Drive バックアップ / 復元
  - Google Calendar 予定登録
- 入口:
  - `設定 > 詳細設定 > 接続フロー検証`
  - 旧 URL の `/settings/data?qa-google=1` でも自動で詳細設定へ移動します

詳細は [docs/TESTING.md](/Users/jrmag/my-recipe-app/docs/TESTING.md) を参照してください。

---

## 主要ルート

- `/` ホーム
- `/search` 検索
- `/stock` 在庫管理
- `/weekly-menu` 週間献立
- `/favorites` お気に入り
- `/history` 履歴
- `/gemini` AI 提案
- `/settings/:tab` 設定

設定タブ:
- `account`
- `planning`
- `ai`
- `notifications`
- `appearance`
- `data`
- `help`
- `about`
- `advanced`
- `guide`
- `version`

---

## ドキュメント

- [docs/manuals/FIRST_SETUP_LINE_BY_LINE.md](/Users/jrmag/my-recipe-vps/docs/manuals/FIRST_SETUP_LINE_BY_LINE.md) 最初のセットアップを1行ずつ説明
- [docs/manuals/VPS_PRODUCTION_MANUAL.md](/Users/jrmag/my-recipe-vps/docs/manuals/VPS_PRODUCTION_MANUAL.md) VPS 本番運用マニュアル
- [docs/FEATURES.md](/Users/jrmag/my-recipe-app/docs/FEATURES.md) 現行機能の要約
- [docs/ARCHITECTURE.md](/Users/jrmag/my-recipe-app/docs/ARCHITECTURE.md) 現行アーキテクチャ
- [docs/SETUP.md](/Users/jrmag/my-recipe-app/docs/SETUP.md) 開発 / 配布セットアップ
- [docs/TESTING.md](/Users/jrmag/my-recipe-app/docs/TESTING.md) テスト構成と QA モード
- [docs/SETTINGS_GUIDE.md](/Users/jrmag/my-recipe-app/docs/SETTINGS_GUIDE.md) 詳細な設定ガイド
- [SETUP_GUIDE.md](/Users/jrmag/my-recipe-app/SETUP_GUIDE.md) かんたん初期設定ガイド
- [SETUP_GUIDE_OKAZAKI.md](/Users/jrmag/my-recipe-app/SETUP_GUIDE_OKAZAKI.md) 岡崎弁ガイド
- [docs/ALGORITHMS.md](/Users/jrmag/my-recipe-app/docs/ALGORITHMS.md) レコメンド / スコアリング仕様
- [docs/PWA_SPECIFICATION.md](/Users/jrmag/my-recipe-app/docs/PWA_SPECIFICATION.md) PWA の設計仕様
- [OPS_RUNBOOK.md](/Users/jrmag/my-recipe-vps/OPS_RUNBOOK.md) 単一 VPS での 24/365 運用手順

---

## URL インポート対応サイト

- `https://www.kyounoryouri.jp/`
- `https://oceans-nadia.com/`
- `https://recipe.rakuten.co.jp/`
- `https://macaro-ni.jp/`
- `https://erecipe.woman.excite.co.jp/`
- `https://www.kikkoman.co.jp/homecook/`
- `https://park.ajinomoto.co.jp/`
- `https://foodistnote.recipe-blog.jp/`
- `https://bazurecipe.com/`
- `https://cookien.com/`
