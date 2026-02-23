export interface GuideStep {
  title: string
  detail?: string
}

export interface GuideSection {
  id: string
  title: string
  summary: string
  badge: string
  steps: GuideStep[]
  notes?: string[]
}

export const SETTINGS_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'backup',
    title: 'データを守りたい（Google連携）',
    badge: '最初に設定',
    summary:
      'Googleでログインすると、在庫・お気に入り・メモ・履歴・週間献立などのユーザーデータを Google Drive のアプリ専用領域に自動保存できます。',
    steps: [
      { title: '設定 → アカウント を開く' },
      { title: '「Googleでログイン」を押す', detail: 'ボタンがない場合は Google Client ID の設定が必要です。' },
      { title: '使うGoogleアカウントを選ぶ' },
      { title: 'ログイン後、バックアップ状態が表示されることを確認する', detail: '「最終バックアップ: ○分前」と出れば動いています。' },
    ],
    notes: [
      '保存先は Google Drive の通常のファイル一覧ではなく、アプリ専用の非表示に近い領域（appDataFolder）です。',
      'レシピ本体の完全な控えを残したい場合は、設定 → データ の「データをエクスポート」を使ってください。',
    ],
  },
  {
    id: 'calendar',
    title: '家族と献立を共有したい（Googleカレンダー）',
    badge: '便利機能',
    summary:
      '週間献立と買い物リストをGoogleカレンダーに登録できます。家族共有カレンダーを選ぶと便利です。',
    steps: [
      { title: '先に「アカウント」タブでGoogleログインを完了する' },
      { title: '設定 → カレンダー を開く' },
      { title: '書き込み許可をオンにする' },
      { title: '登録先カレンダーを選ぶ（家族カレンダー推奨）' },
      { title: '週間献立画面で「カレンダー登録」を押す' },
    ],
    notes: [
      '共有カレンダーに登録すると、家族のスマホでも献立予定を確認しやすくなります。',
    ],
  },
  {
    id: 'ai',
    title: 'AI機能を使いたい（Gemini API）',
    badge: 'AI設定',
    summary:
      '在庫から献立提案、URL解析、写真から食材抽出、料理相談などのAI機能を使うには Gemini APIキー の設定が必要です。',
    steps: [
      { title: 'Google AI Studio を開いて APIキー を作成する' },
      { title: '設定 → 献立 を開く' },
      { title: 'Gemini API設定のロックを解除してキーを貼り付ける' },
      { title: '保存して「接続テスト」を実行する' },
      { title: '必要に応じて機能ごとのモデル（軽量/標準/高精度）を選ぶ' },
    ],
    notes: [
      'APIキーはこの端末のローカルストレージに保存されます（サーバーには送信しません）。',
      'AIの利用回数は設定画面に「推定使用量」として表示されます（公式残量ではありません）。',
    ],
  },
  {
    id: 'migration',
    title: '機種変更・移行をしたい（手動バックアップ）',
    badge: '重要',
    summary:
      'レシピを含めた全データをJSONファイルとして保存/復元したいときは、設定 → データ のエクスポート/インポートを使います。',
    steps: [
      { title: '旧端末で 設定 → データ →「データをエクスポート」' },
      { title: '保存されたJSONファイルを新端末へ移す' },
      { title: '新端末で 設定 → データ →「データをインポート」' },
      { title: '必要に応じて「上書き」か「マージ」を選ぶ' },
    ],
    notes: [
      '「上書き」は現在のデータを置き換えます。迷う場合はまずエクスポートしてから試すのが安全です。',
    ],
  },
]
