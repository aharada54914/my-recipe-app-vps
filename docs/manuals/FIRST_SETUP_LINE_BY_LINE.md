# 最初のセットアップを1行ずつ説明

## このアプリは何をするものか

Kitchen App は、料理を助けるためのアプリです。

- レシピを探す
- 家にある食材を記録する
- 1週間の献立を考える
- AI に料理相談をする
- 個人設定を保存する

この repository は 1 つの箱ではなく、いくつかの部品でできています。

| 部品 | 役割 |
| --- | --- |
| `apps/web` | 画面そのもの |
| `apps/api` | 裏側の処理、設定保存、認証 |
| `apps/cli` | ターミナル管理用コマンド |
| `packages/shared-types` | 共通の型定義 |

## 先に必要なもの

- Git
- Node.js `24` 推奨
- 最低でも Node.js `22.12.0` 以上
- npm
- ターミナル
- 本番運用までやるなら Docker

確認コマンド:

```bash
node -v
npm -v
git --version
docker --version
```

意味:

- `node -v` は Node.js のバージョン確認です
- `npm -v` は npm のバージョン確認です
- `git --version` は Git が入っているかの確認です
- `docker --version` は Docker が使えるかの確認です

## セットアップ手順

### 1. コードを自分のPCにコピーする

```bash
git clone https://github.com/aharada54914/my-recipe-app-vps.git
```

意味:
GitHub にあるコードを、自分のPCに丸ごとコピーします。

### 2. 作業フォルダに入る

```bash
cd my-recipe-app-vps
```

意味:
このアプリのフォルダの中に移動します。

### 3. 必要なライブラリを全部入れる

```bash
npm install
```

意味:
アプリを動かすために必要な部品をまとめてインストールします。

### 4. 設定ファイルを作る

```bash
cp env.example .env
```

意味:
ひな形ファイル `env.example` をコピーして、本物の設定ファイル `.env` を作ります。

### 5. 設定ファイルを開く

```bash
nano .env
```

意味:
`.env` の中身を編集します。

まず最低限よく使う設定:

```env
DB_PASSWORD=好きな強いパスワード
DATABASE_URL=postgresql://kitchen:好きな強いパスワード@postgres:5432/kitchen_app
JWT_SECRET=長いランダム文字列
JWT_EXPIRES_IN=7d
API_PORT=3001
API_HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
TZ=Asia/Tokyo
ENABLE_WEEKLY_EMAIL_JOB=false
NODE_ENV=production
```

意味:

- `DB_PASSWORD` はデータベースのパスワードです
- `DATABASE_URL` は API が DB に接続する場所です
- `JWT_SECRET` はログイン状態を守るための秘密鍵です
- `JWT_EXPIRES_IN` はログインの有効期限です
- `API_PORT` は API のポート番号です
- `API_HOST` は API がどこで待ち受けるかです
- `FRONTEND_URL` は画面のURLです
- `TZ` はタイムゾーンです
- `ENABLE_WEEKLY_EMAIL_JOB=false` は週次メール送信を止めます
- `NODE_ENV=production` は本番向けモードです

補足:

- Google 連携を使うなら `GOOGLE_CLIENT_ID` なども必要です
- AI 相談を使うなら `GEMINI_API_KEY` も必要です

### 6. 画面だけ起動する

```bash
npm run dev
```

意味:
ブラウザに見える画面だけ起動します。

### 7. API も別ターミナルで起動する

```bash
npm run dev:api
```

意味:
裏側の処理を担当する API を起動します。

注意:
本当に全部の機能を試すなら、ターミナルを 2 つ使います。

- ターミナル1で `npm run dev`
- ターミナル2で `npm run dev:api`

### 8. ビルドできるか確認する

```bash
npm run build
```

意味:
本番向けの形にまとめられるか確認します。

### 9. テストする

```bash
npm test
```

意味:
壊れていないか、自動テストで確認します。

## 最初に触るおすすめ順

1. レシピ検索を開く
2. 気になるレシピをお気に入りに入れる
3. 在庫管理で家の食材を入れる
4. 週間献立で1週間分を作る
5. 設定で通知や見た目を調整する
