# Settings Information Architecture Refactor Plan

最終改訂: 2026-03-07

## 1. 結論

現状の 8 分類は、項目数そのものよりも「粒度」と「責務」が揃っていない。

特に問題なのは次の 4 点:

1. `Google / カレンダー / Drive / QA` が 3 タブ以上に分散している
2. `献立設定` と `Gemini 設定` が同じ `menu` タブに同居している
3. `食事時刻 / 自動生成時刻 / 通知時刻` が 3 タブに分散している
4. `使い方 / バージョン` が「設定」と同じ階層に並んでいる

したがって、現状の区分けは「一部は妥当だが、全体 IA としては不適切」と判断する。

---

## 2. 現状評価

### 2.1 現在のトップレベル

- `account`
- `appearance`
- `calendar`
- `menu`
- `notify`
- `data`
- `guide`
- `version`

対象:
- [src/pages/SettingsPage.tsx](/Users/jrmag/my-recipe-app/src/pages/SettingsPage.tsx#L18)

### 2.2 定量的な問題

#### A. 本来 1 グループであるべき `Google 連携` が 3 分割されている

- `Account`
  - Google ログイン
  - Drive バックアップ
  - Google Client ID
- `Calendar`
  - カレンダー一覧取得
  - デフォルト登録先
  - 家族カレンダー
- `Data`
  - QA Google mode

影響:
- ユーザーは「Google のことを設定したい」と思っても、どこへ行くべきか判断しづらい
- 実際の mental model は `接続設定` なのに、UI は `アカウント / カレンダー / データ` に分割されている

#### B. 時刻関連設定が 3 タブに分散している

- `Calendar`
  - `mealStartHour`, `mealStartMinute`
  - `mealEndHour`, `mealEndMinute`
- `Notify`
  - `cookingNotifyHour`, `cookingNotifyMinute`
  - `desiredMealHour`, `desiredMealMinute`
- `Menu`
  - `weeklyMenuGenerationDay`, `weeklyMenuGenerationHour`, `weeklyMenuGenerationMinute`

影響:
- 「食事や調理の時間を決めたい」という 1 つの目的で複数タブを往復する必要がある
- `desiredMealHour` は通知の一部ではなく、献立と逆算スケジュールの基準値でもある

#### C. `Menu` タブが 2 つの別ドメインを抱えている

- `MealPlanSettings`
  - 予算
  - 旬優先度
  - 価格モード
  - ご褒美枠
  - 献立生成タイミング
  - ユーザープロンプト
- `Gemini`
  - API キー
  - 鍵の暗号化 / 復号
  - 接続テスト
  - モデル設定
  - 使用量

影響:
- `献立` タブの情報密度が突出して高い
- AI を設定したいだけの人に、献立コストや旬優先度が混ざって見える
- Home や Gemini ページから `settings/menu` に飛ぶ導線も、遷移先の意図が曖昧

#### D. `Guide` と `Version` は設定ではなくサポート情報

- `Guide`
- `Version`

影響:
- 実設定 6 件とサポート情報 2 件が同格に見える
- モバイルで最初の一覧に「今すぐ触る設定」と「読むだけの情報」が混在する

### 2.3 定性的な問題

#### `AccountTab` に deployment-level 設定が混ざっている

`Google Client ID` は一般ユーザー設定というより、配布 / 開発環境設定に近い。

対象:
- [src/components/settings/AccountTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/AccountTab.tsx#L236)

これは通常ユーザーに見せるより、
- 環境変数未設定時のみ
- もしくは debug / advanced panel のみ
に出すべき内容である。

#### `DataTab` に QA モードが混ざっている

QA Google mode は完全に検証者 / 開発者向けであり、一般ユーザーの `データ管理` mental model と一致しない。

対象:
- [src/components/settings/DataTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/DataTab.tsx#L153)

---

## 3. 望ましい分類

## 3.1 新しいトップレベル案

### Primary Settings

1. `接続`
2. `献立`
3. `AI`
4. `通知`
5. `表示`
6. `データ`

### Secondary / Support

7. `ヘルプ`
8. `アプリ情報`

### Hidden / Debug

9. `開発・検証`

---

## 3.2 各タブの責務

### 1. 接続

含める:
- Google ログイン / ログアウト
- Drive バックアップ状態
- 手動バックアップ
- デフォルト登録先カレンダー
- 家族カレンダー
- 接続状態 summary

移す元:
- `account`
- `calendar`

理由:
- ユーザーの mental model は `Google まわりの接続`

### 2. 献立

含める:
- 週予算
- 旬優先度
- 価格モード
- ご褒美枠
- 献立生成曜日 / 時刻
- ユーザープロンプト
- 食事開始希望時刻
- 献立の時間帯

移す元:
- `menu`
- `notify`
- `calendar`

理由:
- `いつ食べるか / どういう方針で献立を作るか` は 1 つの設定目的

### 3. AI

含める:
- Gemini API キー
- 鍵の暗号化 / 復号
- 接続テスト
- モデル設定
- retry escalation
- 使用量 / 上限

移す元:
- `menu`

理由:
- AI を使うかどうかは、献立ロジックとは別の関心事

### 4. 通知

含める:
- 通知権限
- 調理開始通知 ON/OFF
- 調理開始通知時刻
- 週間献立完了通知
- 買い物リスト通知

移す元:
- `notify`

理由:
- `通知するかどうか` に限定して責務を絞る

### 5. 表示

含める:
- `system / light / dark`

現状維持:
- `appearance`

### 6. データ

含める:
- エクスポート
- インポート
- 在庫 QR 共有 / 受信

現状維持:
- `data`

除外:
- QA mode

### 7. ヘルプ

含める:
- 使い方ガイド
- 設定のおすすめ順

移す元:
- `guide`

### 8. アプリ情報

含める:
- バージョン
- 更新履歴
- 必要ならライセンス / 参照コミット

移す元:
- `version`

### 9. 開発・検証

含める:
- QA Google mode
- Google Client ID 手入力
- 将来の debug flags

表示条件:
- `import.meta.env.DEV`
- query param
- 明示的な advanced toggle

---

## 4. 推奨 IA

## 推奨トップレベル

- 接続
- 献立
- AI
- 通知
- 表示
- データ

## 補助エリア

- ヘルプ
- アプリ情報

## 非表示エリア

- 開発・検証

これは「8 を 6 + 2 + hidden」に再整理する案であり、モバイルで最も筋が良い。

理由:
- 実設定だけを一次面に残せる
- AI と献立を分離できる
- Google / Calendar / Drive を `接続` に集約できる
- `使い方 / バージョン` を設定から外せる

---

## 5. リファクタリング計画

## Phase 0: Audit & Mapping

目的:
- 各 setting key を新 IA にマッピングする

作業:
- `preferences` の各フィールドを棚卸し
- `localStorage` 管理値も含めて所属を決める
- `status action` から飛ぶ設定先も一覧化

成果物:
- 設定項目マッピング表

---

## Phase 1: Route / IA Restructure

目的:
- 画面構造を新分類へ変更する

新 route 案:
- `/settings/connections`
- `/settings/planning`
- `/settings/ai`
- `/settings/notifications`
- `/settings/appearance`
- `/settings/data`
- `/settings/help`
- `/settings/about`

作業:
- `SettingsPage.tsx` の `TabId` を置換
- 一覧画面を `Primary` と `Support` の 2 セクションに分離
- 各カードに summary を付与

完了条件:
- 初見ユーザーが `Google / 献立 / AI / 通知 / データ` を迷わず選べる

---

## Phase 2: Content Split / Merge

目的:
- 既存タブの内容を責務ごとに分け直す

作業:
- `AccountTab + CalendarSettings -> ConnectionsSettings`
- `MealPlanSettings + desired meal / meal range -> PlanningSettings`
- `MenuTab -> AISettings`
- `NotificationSettings` から `desiredMealHour` を除去
- `DataTab` から `QA Google mode` を除去
- `GuideTab + VersionTab` を support 群へ再配置

完了条件:
- 1 画面 1 目的に近づく
- 「設定したいこと」と「置いてある場所」が一致する

---

## Phase 3: Debug Gating

目的:
- 一般ユーザー IA から debug / deploy 設定を外す

作業:
- `Google Client ID` 入力 UI を
  - `DEV only`
  - `環境変数未設定時のみ`
  - `詳細設定を開く`
  のいずれかで gating
- `QA Google mode` を debug panel へ移す

完了条件:
- 一般利用者には QA / deployment 用 UI が見えない

---

## Phase 4: Navigation / Redirect Compatibility

目的:
- 既存 deep link と status action を壊さない

作業:
- `settings/menu` を使っている導線を `planning` または `ai` に切り替え
- 旧 route は 1 リリース分 alias redirect

特に更新対象:
- [src/pages/HomePage.tsx](/Users/jrmag/my-recipe-app/src/pages/HomePage.tsx#L302)
- [src/pages/AskGeminiPage.tsx](/Users/jrmag/my-recipe-app/src/pages/AskGeminiPage.tsx#L66)
- [src/components/gemini/ImportTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/ImportTab.tsx#L80)
- [src/components/gemini/SuggestTab.tsx](/Users/jrmag/my-recipe-app/src/components/gemini/SuggestTab.tsx#L175)
- [src/components/CalendarSettings.tsx](/Users/jrmag/my-recipe-app/src/components/CalendarSettings.tsx#L59)

完了条件:
- 既存導線からの遷移が壊れない

---

## Phase 5: Test Refactor

目的:
- IA 変更後も設定導線が壊れないようにする

作業:
- `SettingsPage` の route test 追加
- 各新セクションに対して component test 追加
- Playwright smoke 追加
  - settings list renders grouped sections
  - AI status action opens AI settings
  - calendar status action opens Connections settings
  - desired meal time persists under Planning settings

完了条件:
- 旧 route redirect
- 新 route 表示
- 主な status action 導線
が CI で検証される

---

## 6. 実装順

1. Phase 0 Audit & Mapping
2. Phase 1 Route / IA Restructure
3. Phase 2 Content Split / Merge
4. Phase 4 Navigation / Redirect Compatibility
5. Phase 3 Debug Gating
6. Phase 5 Test Refactor

理由:
- 先に route と見出しを決めないと中身の再配置が不安定
- compatibility は split 後すぐ入れるべき
- debug gating は最後でも本筋を壊さない

---

## 7. 受け入れ基準

- 一般ユーザー向けの一次設定は 6 分類以内に収まる
- `Google 接続` 系設定が 1 タブに集約される
- `献立` と `AI` が別タブになる
- `desiredMealHour` が `通知` から消える
- `Guide / Version` は support 扱いになり、実設定と同格で並ばない
- `QA Google mode` と `Google Client ID` は通常利用者の IA から外れる

---

## 8. 推奨実装単位

### PR-1
- `SettingsPage` の新 IA と新 route
- 旧 route alias

### PR-2
- `ConnectionsSettings` / `PlanningSettings` / `AISettings`

### PR-3
- `NotificationsSettings` / `DataSettings` cleanup
- debug gating

### PR-4
- help / about 再配置
- tests 更新
