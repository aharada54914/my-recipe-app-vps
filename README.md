# Kitchen App — Smart Recipe Manager PWA

最終改訂: 2026-02-22

ホットクック / ヘルシオ向けのレシピ管理PWAです。  
オフライン優先で動作し、Google Driveバックアップ、Gemini連携、週間献立自動生成に対応しています。

---

## 主な機能

- レシピ検索（約1,700件、あいまい検索対応）
- 在庫管理と在庫一致率表示
- 週間献立の自動生成（主菜+副菜/スープ）
- 週間献立の共有（共有リンク / 共有コード）
- 買い物リスト自動生成 + 追加編集UI
- Google Calendar登録
- Google Drive自動バックアップ / 復元
- 通知機能（権限設定 + ローカル通知スケジューラ）
- Gemini 3 FlashによるAIレシピ解析
- 写真複数枚から食材抽出 -> 献立生成（再生成は文字データのみ送信）
- URL取り込み/献立生成の結果を大型編集ウィンドウで修正してから保存
- 検索結果を好みデータで補正する Kitchen App Preference Rank
- iOS向けPWA最適化 + Liquid Glass UI

---

## クイックスタート

Node.js `22.12.0+` 推奨（`.nvmrc` 参照）

```bash
npm install
npm run dev
```

ビルド:

```bash
npm run build
npm run preview
```

---

## 環境変数

`.env.example` をコピーして `.env` を作成:

```bash
cp .env.example .env
```

```env
# Google OAuth（Googleログイン/Drive/Calendar）
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Gemini API（任意。設定画面入力でも可）
VITE_GEMINI_API_KEY=your-gemini-api-key
```

補足:
- `VITE_GOOGLE_CLIENT_ID` 未設定時はOAuth機能のみ無効化（アプリ自体は起動）
- `VITE_GEMINI_API_KEY` は `.env` 値が設定画面保存値より優先

---

## 主要ルート

- `/` ホーム
- `/search` 検索
- `/stock` 在庫管理
- `/weekly-menu` 週間献立
- `/favorites` お気に入り
- `/history` 履歴
- `/gemini` AI提案
- `/settings/:tab` 設定タブ画面

---

## ドキュメント

- `docs/FEATURES.md` 機能詳細
- `docs/SETUP.md` セットアップ・デプロイ
- `docs/ALGORITHMS.md` アルゴリズム仕様
- `docs/ARCHITECTURE.md` アーキテクチャ仕様
- `docs/SETTINGS_GUIDE.md` 個人向けやさしい設定ガイド (アプリ内から閲覧可能)
- `SETUP_GUIDE_OKAZAKI.md` 個人向け（岡崎弁）設定ガイド

---

## URLインポート対応サイト

`/gemini -> インポート` タブ内にも同じ一覧を表示しています。

- みんなのきょうの料理: `https://www.kyounoryouri.jp/`
- Nadia（ナディア）: `https://oceans-nadia.com/`
- 楽天レシピ: `https://recipe.rakuten.co.jp/`
- macaroni（マカロニ）: `https://macaro-ni.jp/`
- E・レシピ: `https://erecipe.woman.excite.co.jp/`
- キッコーマン ホームクッキング: `https://www.kikkoman.co.jp/homecook/`
- 味の素パーク: `https://park.ajinomoto.co.jp/`
- フーディストノート: `https://foodistnote.recipe-blog.jp/`
- リュウジのバズレシピ.com: `https://bazurecipe.com/`
- つくおき: `https://cookien.com/`

---

## バージョン

現在: **v1.9.6**

`設定 > バージョン情報` で、これまでの変更要約（v1.9.6 の調味料在庫登録・URL取り込み改善を含む）を確認できます。
