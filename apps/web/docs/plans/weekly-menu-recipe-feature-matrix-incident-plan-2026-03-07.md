# Weekly Menu Feature Matrix Incident Plan

最終改訂: 2026-03-07

## 1. 事象

週間献立生成時に、以下のエラーで生成全体が失敗する。

`recipeFeatureMatrix.bulkPut(): ... ConstraintError: Unable to add key to index 'recipeId': at least one key does not satisfy the uniqueness requirements.`

ユーザー影響:
- 週間献立生成が完了しない
- UI には IndexedDB / Dexie の内部エラーがそのまま表示される
- 再試行しても同じ状態が継続しやすい

重大度:
- `P0`
- 中核機能である週間献立生成を直接停止させる

---

## 2. 原因

### 2.1 直接原因

`ensureRecipeFeatureMatrix()` が、`recipeFeatureMatrix` テーブルの既存レコード確認に `bulkGet(ids)` を使っている。

対象コード:
- [src/utils/recipeFeatureMatrix.ts](/Users/jrmag/my-recipe-app/src/utils/recipeFeatureMatrix.ts#L47)

現状:

```ts
const ids = recipes.map(r => r.id).filter((id): id is number => id != null)
const existing = await db.recipeFeatureMatrix.bulkGet(ids)
```

しかし `recipeFeatureMatrix` の primary key は `id`、`recipeId` は unique secondary index である。

対象スキーマ:
- [src/db/db.ts](/Users/jrmag/my-recipe-app/src/db/db.ts#L723)

現状:

```ts
recipeFeatureMatrix: '++id, &recipeId, confidence, source'
```

そのため `bulkGet(ids)` は `recipeId` ではなく `id` を見にいく。  
結果として、既存レコードが存在しても「未登録」と誤判定され、同じ `recipeId` のレコードを `bulkPut()` しようとして unique index 衝突が発生する。

### 2.2 なぜ 81 件すべて失敗したのか

今回のエラー文では `81 of 81 operations failed` となっている。  
これは、生成対象として評価された 81 件すべてについて既存レコードの存在確認に失敗し、全件を重複 insert / upsert しようとしたことを示す。

### 2.3 設計上の問題

`recipeFeatureMatrix` は「派生キャッシュ」であり、なくても献立生成は継続可能なはずだが、現状はこのキャッシュの書き込み失敗が生成フロー全体を abort している。

対象経路:
- [src/utils/weeklyMenuSelector.ts](/Users/jrmag/my-recipe-app/src/utils/weeklyMenuSelector.ts#L226)
- [src/hooks/useWeeklyMenuController.ts](/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts#L147)

つまり今回の障害は、

1. lookup の誤り
2. 派生キャッシュと本処理の密結合
3. 内部エラーの生表示

の 3 点が重なって表面化している。

---

## 3. なぜ既存テストで防げなかったか

### 3.1 `recipeFeatureMatrix` の保存経路テストがない

現状のテストは `buildRecipeFeatureRecord()` の純関数しか見ていない。

対象:
- [src/utils/__tests__/recipeFeatureMatrix.test.ts](/Users/jrmag/my-recipe-app/src/utils/__tests__/recipeFeatureMatrix.test.ts#L21)

不足:
- unique index 衝突
- 既存レコード再利用
- 2 回目の生成
- migration 後データ

### 3.2 `weeklyMenuSelector` テストが DB 仕様をモックで潰している

現状モック:
- [src/utils/__tests__/weeklyMenuSelector.test.ts](/Users/jrmag/my-recipe-app/src/utils/__tests__/weeklyMenuSelector.test.ts#L20)

`recipeFeatureMatrix.bulkGet` は常に `undefined` を返すため、primary key / unique index の意味論差がテストに現れない。

---

## 4. 再発防止方針

### 4.1 lookup を `recipeId` 基準へ修正する

応急修正として、既存確認を primary key ではなく `recipeId` unique index で行う。

方針:
- `bulkGet(ids)` を廃止
- `where('recipeId').anyOf(uniqueIds).toArray()` へ変更
- 入力 `recipeId` を事前に重複除去

### 4.2 派生キャッシュを best-effort に落とす

週間献立生成は、feature cache が壊れていても続行できるようにする。

方針:
- feature record はまずメモリ上で算出
- cache write は best-effort
- cache write が失敗しても生成本体は継続
- 必要なら `console.error` + internal log に送る

### 4.3 schema を `recipeId` 主キーに寄せる

現行の `++id, &recipeId` は今回のような実装ミスを誘発しやすい。  
このテーブルは recipe に 1:1 対応する派生キャッシュなので、主キーは `recipeId` でよい。

方針:
- v19 で cache table を disposable として再定義
- `recipeFeatureMatrix: 'recipeId, confidence, source, updatedAt'`
- 既存データは migration 時に wipe & rebuild、または recipeId 単位で再投入

補足:
- 派生キャッシュなので、完全移行より `drop and rebuild` を優先できる

### 4.4 ユーザー向けエラーを内部例外から切り離す

現在は raw error がそのまま toast に出る。

対象:
- [src/hooks/useWeeklyMenuController.ts](/Users/jrmag/my-recipe-app/src/hooks/useWeeklyMenuController.ts#L43)

方針:
- `ConstraintError`, `BulkError`, `AbortError` をドメインエラーへ変換
- ユーザー表示:
  - `内部データを再構築して再試行します`
  - `献立生成に失敗しました。少し待ってから再試行してください`
- 開発者向け詳細は console / log に残す

---

## 5. リファクタリング計画

## Phase 0: Hotfix

目的:
- 今日中に週間献立生成を復旧する

作業:
- `ensureRecipeFeatureMatrix()` の既存確認を `recipeId` unique index ベースに修正
- `newRecords` 生成前に入力 `recipeId` を重複排除
- `bulkPut` 失敗時は再読込して続行する暫定ガードを入れる
- 週間献立生成の toast から raw DB error を隠す

完了条件:
- 既存 `recipeFeatureMatrix` データがある状態で、週間献立を連続 2 回生成しても失敗しない

---

## Phase 1: Cache Boundary Refactor

目的:
- 派生キャッシュ障害が献立生成本体を巻き込まないようにする

作業:
- `recipeFeatureMatrix.ts` を分割
  - `buildRecipeFeatureRecord`
  - `loadRecipeFeatureRecordsByRecipeId`
  - `persistRecipeFeatureRecords`
  - `ensureRecipeFeatureMatrixBestEffort`
- `weeklyMenuSelector.ts` から「cache を読む責務」と「score 計算」を分離
- cache miss 時はメモリ計算結果を使い、その場でスコアリング継続

完了条件:
- cache write を意図的に失敗させても、献立生成結果は返る

---

## Phase 2: Schema Simplification

目的:
- `recipeFeatureMatrix` を 1 recipe = 1 record の形に正規化する

作業:
- Dexie schema v19 を追加
- `recipeFeatureMatrix` を `recipeId` 主キーへ変更
- 古い cache は migration で破棄して再生成
- `featureSchemaVersion` 追加を検討し、将来の score 変更時に cache invalidation 可能にする

完了条件:
- lookup は primary key ベースで単純化される
- `bulkGet(recipeIds)` が意味的にも正しくなる

---

## Phase 3: Error Translation / Recovery UX

目的:
- 内部障害をユーザーが理解可能な形へ変換する

作業:
- `getErrorMessage()` を用途別に置き換え
- `normalizeWeeklyMenuGenerationError()` を追加
- 派生 cache 障害時は
  - 自動再構築を試す
  - 失敗しても `一部内部データを再作成しました` などの軽い通知に留める
- 本当に生成不能な場合だけ error toast を出す

完了条件:
- Dexie / IndexedDB の内部用語がユーザー向け toast に出ない

---

## Phase 4: Test Remediation

目的:
- 同種事故を CI で止める

作業:
- `recipeFeatureMatrix.test.ts` を拡張
  - 既存レコードがある場合に再挿入しない
  - 同じ recipes を 2 回処理しても失敗しない
- `fake-indexeddb` を導入し、Dexie の unique index 挙動を伴う integration test を追加
- Playwright smoke に以下を追加
  - 献立生成を 2 回連続実行
  - 生成前に feature cache を持つ状態から再生成
- 失敗時の user-facing message も検証

完了条件:
- unique index の誤用が unit / integration / smoke の 3 段階で検出される

---

## 6. 優先順位

1. Phase 0 Hotfix
2. Phase 1 Cache Boundary Refactor
3. Phase 4 Test Remediation のうち回帰防止に必要な最小セット
4. Phase 3 Error Translation / Recovery UX
5. Phase 2 Schema Simplification

理由:
- まず復旧
- 次に同じ class の障害で本機能が停止しない構造へ切る
- そのあと schema を整理する

---

## 7. 受け入れ基準

- 週間献立生成が既存 cache の有無に依存せず成功する
- 同一週で連続生成しても `ConstraintError` が発生しない
- ユーザー向け toast に `bulkPut`, `ConstraintError`, `index` などの内部語が出ない
- CI で
  - unit
  - IndexedDB integration
  - smoke
  の 3 層が通る

---

## 8. 実装時の注意

- `recipeFeatureMatrix` は派生データなので、破損時は rebuild を優先し、ユーザーデータ互換性より可用性を優先する
- 週間献立生成の本処理と派生 cache 永続化を同一の失敗ドメインに置かない
- future regression を防ぐため、`bulkGet` のような primary key API を unique index 用途に使わない lint / review rule をチーム内で明文化する
