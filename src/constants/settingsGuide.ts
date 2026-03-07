export type HelpGroupId =
  | 'getting-started'
  | 'daily'
  | 'sharing'
  | 'troubleshooting'

export type HelpStatusResolver =
  | 'google'
  | 'gemini'
  | 'appearance'
  | 'notifications'

export interface HelpAction {
  label: string
  to: string
}

export interface HelpStep {
  title: string
  detail?: string
}

export interface HelpArticle {
  id: string
  group: HelpGroupId
  title: string
  summary: string
  badge?: string
  estimatedMinutes?: number
  whenToUse?: string
  prerequisites?: string[]
  successState: string
  steps: HelpStep[]
  pitfalls?: string[]
  primaryAction: HelpAction
  secondaryAction?: HelpAction
  statusResolver?: HelpStatusResolver
}

export interface HelpGroup {
  id: HelpGroupId
  title: string
  summary: string
}

export const HELP_GROUPS: HelpGroup[] = [
  {
    id: 'getting-started',
    title: 'まずはここから',
    summary: '最初に済ませると、あとから困りにくい設定です。',
  },
  {
    id: 'daily',
    title: 'よく使う操作',
    summary: '検索、AI、在庫、献立の毎日使う流れを短く案内します。',
  },
  {
    id: 'sharing',
    title: '共有・移行',
    summary: '家族共有、機種変更、在庫共有の導線です。',
  },
  {
    id: 'troubleshooting',
    title: '困ったとき',
    summary: '設定が見つからない、動かない、通知が来ないときの確認先です。',
  },
]

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'protect-data',
    group: 'getting-started',
    title: 'Google でデータを守る',
    summary: 'Google ログインを済ませると、Drive バックアップとカレンダー登録の土台が整います。',
    badge: '最初に',
    estimatedMinutes: 3,
    whenToUse: '端末故障や機種変更に備えたいとき。',
    prerequisites: ['Google アカウントを用意する'],
    successState: '接続画面に「利用可能」や最終バックアップ時刻が表示される。',
    steps: [
      { title: '設定 → 接続 を開く' },
      { title: 'Google でログイン を押す', detail: 'ボタンがない場合は詳細設定の Client ID を確認します。' },
      { title: 'アカウントを選んで許可する' },
      { title: '接続状態と Drive バックアップ表示を確認する' },
    ],
    pitfalls: [
      '保存先は通常の Drive 一覧ではなくアプリ専用領域です。',
      'ログインだけでは不安な場合は、データ画面から JSON エクスポートも残せます。',
    ],
    primaryAction: { label: '接続へ移動', to: '/settings/account' },
    secondaryAction: { label: 'データ設定を見る', to: '/settings/data' },
    statusResolver: 'google',
  },
  {
    id: 'enable-gemini',
    group: 'getting-started',
    title: 'Gemini を使えるようにする',
    summary: 'API キーを登録すると、AI 相談、URL 解析、画像解析、提案機能が使えるようになります。',
    badge: 'AI',
    estimatedMinutes: 4,
    whenToUse: 'AI 相談や自動提案を使い始めたいとき。',
    prerequisites: ['Google AI Studio で API キーを発行する'],
    successState: 'AI 設定画面で利用可能と表示され、Gemini 画面から相談を開始できる。',
    steps: [
      { title: 'Google AI Studio で API キーを作成する' },
      { title: '設定 → AI を開く' },
      { title: 'API キーを貼り付けて保存する' },
      { title: '接続テストか利用状況表示で動作を確認する' },
    ],
    pitfalls: [
      '旧形式のキーが残っている場合は暗号化して再保存するのが安全です。',
      '推定残量が少ないときは軽量モデルへ切り替えると安定します。',
    ],
    primaryAction: { label: 'AI 設定へ移動', to: '/settings/ai' },
    secondaryAction: { label: 'AI 相談を開く', to: '/gemini' },
    statusResolver: 'gemini',
  },
  {
    id: 'switch-theme',
    group: 'getting-started',
    title: '見やすいテーマに切り替える',
    summary: '明るさや時間帯に合わせて light / dark / system を切り替えると視認性が安定します。',
    badge: '表示',
    estimatedMinutes: 1,
    whenToUse: '夜に眩しい、昼に文字が見づらいと感じるとき。',
    successState: '表示画面に選んだモードが反映され、画面全体の色が切り替わる。',
    steps: [
      { title: '設定 → 表示 を開く' },
      { title: 'システム連動、ライト、ダークから選ぶ' },
      { title: '必要なら画面を再表示して見え方を確認する' },
    ],
    pitfalls: ['画面ごとの色味は theme 変更後すぐ反映されます。再ログインは不要です。'],
    primaryAction: { label: '表示設定へ移動', to: '/settings/appearance' },
    statusResolver: 'appearance',
  },
  {
    id: 'search-fast',
    group: 'daily',
    title: 'レシピをすばやく探す',
    summary: '検索語と上部ボタンを組み合わせると、調理時間や旬、カテゴリで絞り込めます。',
    badge: '毎日使う',
    estimatedMinutes: 2,
    whenToUse: '今食べたいものを数タップで見つけたいとき。',
    successState: '検索結果が欲しい条件だけに絞り込まれ、候補数がすぐ下がる。',
    steps: [
      { title: '検索画面で料理名か食材名を入力する' },
      { title: '上の条件ボタンを必要な分だけ選ぶ' },
      { title: 'カテゴリボタンで主菜や副菜を追加で絞る' },
      { title: '気になるカードを開いて材料や手順を確認する' },
    ],
    pitfalls: [
      '条件ボタンは組み合わせて使えます。同じグループ内は OR、別グループは AND で絞られます。',
    ],
    primaryAction: { label: '検索へ移動', to: '/search' },
    secondaryAction: { label: '在庫を確認する', to: '/stock' },
  },
  {
    id: 'ask-ai',
    group: 'daily',
    title: 'AI に相談する',
    summary: '在庫、食べたい気分、URL、写真のどれからでも Gemini に相談できます。',
    badge: 'AI',
    estimatedMinutes: 2,
    whenToUse: 'レシピ名が決まっていないときや、食材から逆引きしたいとき。',
    successState: 'Gemini 画面で相談文や解析結果が返り、次の行動ボタンが出る。',
    steps: [
      { title: 'Gemini 画面を開く' },
      { title: '相談、URL 解析、写真解析の入口から 1 つ選ぶ' },
      { title: '入力して実行し、提案結果を確認する' },
      { title: '必要なら設定画面でモデルやキーを見直す' },
    ],
    pitfalls: ['AI が未設定なら、まず AI 設定を済ませてから戻ると詰まりません。'],
    primaryAction: { label: 'AI 相談へ移動', to: '/gemini' },
    secondaryAction: { label: 'AI 設定へ移動', to: '/settings/ai' },
    statusResolver: 'gemini',
  },
  {
    id: 'make-weekly-menu',
    group: 'daily',
    title: '週間献立を作る',
    summary: '今週の献立は 1 回生成すると、買い物リスト、共有、カレンダー登録まで一気に進められます。',
    badge: '献立',
    estimatedMinutes: 3,
    whenToUse: '週末や買い出し前に、1 週間分をまとめて決めたいとき。',
    successState: '週間献立に 7 日分のカードが並び、買い物リストや共有が使える。',
    steps: [
      { title: '週間献立を開く' },
      { title: '献立を自動生成 を押す' },
      { title: '必要なら主菜・副菜の入れ替えや人数調整を行う' },
      { title: '買い物リストやカレンダー登録へ進む' },
    ],
    pitfalls: ['生成後の下部アクションから再生成、共有、カレンダー登録へ進めます。'],
    primaryAction: { label: '週間献立へ移動', to: '/weekly-menu' },
    secondaryAction: { label: '献立設定を見る', to: '/settings/planning' },
  },
  {
    id: 'use-stock',
    group: 'daily',
    title: '在庫を追加して使い切る',
    summary: '在庫を足しておくと、検索結果や献立の在庫一致率がすぐ変わります。',
    estimatedMinutes: 2,
    whenToUse: '買い物直後や、冷蔵庫の残り物を使い切りたいとき。',
    successState: '在庫一覧に食材が追加され、検索や献立で一致率が反映される。',
    steps: [
      { title: '在庫画面で食材名を検索する' },
      { title: '+1 / -1 や数量入力で在庫数を調整する' },
      { title: '最近使った食材や候補から素早く追加する' },
      { title: '検索や献立に戻って一致率を見る' },
    ],
    pitfalls: ['調味料も管理したいときは買い物リストの調味料切替も合わせて確認します。'],
    primaryAction: { label: '在庫へ移動', to: '/stock' },
    secondaryAction: { label: '検索へ移動', to: '/search' },
  },
  {
    id: 'share-calendar',
    group: 'sharing',
    title: '家族カレンダーに献立を出す',
    summary: 'Google カレンダーへ献立と買い物リストを登録すると、家族全員が同じ予定を見られます。',
    badge: '共有',
    estimatedMinutes: 3,
    whenToUse: '家族と夕食予定や買い物担当を共有したいとき。',
    prerequisites: ['Google ログインを済ませる'],
    successState: '接続画面で登録先カレンダーが選べて、週間献立から登録完了メッセージが出る。',
    steps: [
      { title: '設定 → 接続 でカレンダー一覧を読み込む' },
      { title: '登録先カレンダーを選ぶ' },
      { title: '週間献立でカレンダー登録 を押す' },
      { title: '予定が家族カレンダーに追加されたことを確認する' },
    ],
    pitfalls: ['権限が切れたときは再ログインで直ることが多いです。'],
    primaryAction: { label: '接続へ移動', to: '/settings/account' },
    secondaryAction: { label: '週間献立へ移動', to: '/weekly-menu' },
    statusResolver: 'google',
  },
  {
    id: 'migrate-device',
    group: 'sharing',
    title: '機種変更でデータを移す',
    summary: 'JSON エクスポートとインポートで、レシピや在庫をまとめて新端末へ移せます。',
    badge: '移行',
    estimatedMinutes: 4,
    whenToUse: '新しいスマホへ引っ越すときや、手元に控えを残したいとき。',
    successState: '新端末で在庫、履歴、献立が以前の状態に近い形で読める。',
    steps: [
      { title: '旧端末で 設定 → データ → データをエクスポート を実行する' },
      { title: '保存した JSON を新端末へ移す' },
      { title: '新端末で 設定 → データ → データをインポート を実行する' },
      { title: '必要に応じて上書きかマージを選ぶ' },
    ],
    pitfalls: ['迷う場合は先に新端末側もエクスポートして退避しておくと安全です。'],
    primaryAction: { label: 'データ設定へ移動', to: '/settings/data' },
    secondaryAction: { label: '接続設定を見る', to: '/settings/account' },
  },
  {
    id: 'share-stock-qr',
    group: 'sharing',
    title: '在庫を QR で共有する',
    summary: '在庫の送信と受信を QR で行うと、家族間の受け渡しが手早く済みます。',
    estimatedMinutes: 2,
    whenToUse: '同じ家の別端末へ在庫を渡したいとき。',
    successState: 'QR を表示した端末と読み取った端末で、同じ在庫が見える。',
    steps: [
      { title: '設定 → データ を開く' },
      { title: '在庫 QR 共有の送信または受信を選ぶ' },
      { title: 'QR を表示するか読み取る' },
      { title: '取り込み後に在庫一覧で反映を確認する' },
    ],
    pitfalls: ['大量在庫は事前に整理しておくと QR の確認がしやすくなります。'],
    primaryAction: { label: 'データ設定へ移動', to: '/settings/data' },
    secondaryAction: { label: '在庫へ移動', to: '/stock' },
  },
  {
    id: 'google-login-missing',
    group: 'troubleshooting',
    title: 'Google ログインが出ない',
    summary: 'Client ID 未設定か、接続状態が崩れているとログインボタンや権限導線が出ません。',
    badge: '詰まりやすい',
    estimatedMinutes: 2,
    whenToUse: '接続画面にログインボタンが見えないとき。',
    successState: '接続画面に Google ログインか接続状態カードが表示される。',
    steps: [
      { title: '設定 → 接続 を開いて状態文言を確認する' },
      { title: '必要なら 設定 → 詳細設定 で Google Client ID を確認する' },
      { title: 'QA モードでないかも合わせて確認する' },
      { title: '設定後に接続画面へ戻って再読み込みする' },
    ],
    pitfalls: ['QA Google モード中は実アカウント連携の表示になりません。'],
    primaryAction: { label: '接続へ移動', to: '/settings/account' },
    secondaryAction: { label: '詳細設定へ移動', to: '/settings/advanced' },
    statusResolver: 'google',
  },
  {
    id: 'backup-anxiety',
    group: 'troubleshooting',
    title: 'バックアップが不安',
    summary: '接続状態と JSON エクスポートを併用すると、Drive 側の状態を気にしすぎず確認できます。',
    estimatedMinutes: 2,
    whenToUse: '今の端末の内容がちゃんと残っているか確かめたいとき。',
    successState: '接続画面でバックアップ状態が確認でき、必要なら JSON エクスポートも保存できる。',
    steps: [
      { title: '接続画面で Google 状態と最終バックアップ表示を確認する' },
      { title: '必要なら今すぐバックアップを実行する' },
      { title: 'さらに控えが欲しい場合はデータ画面からエクスポートする' },
    ],
    pitfalls: ['Drive 側は appDataFolder なので通常一覧に見えないのが正常です。'],
    primaryAction: { label: '接続へ移動', to: '/settings/account' },
    secondaryAction: { label: 'データ設定へ移動', to: '/settings/data' },
    statusResolver: 'google',
  },
  {
    id: 'gemini-not-working',
    group: 'troubleshooting',
    title: 'Gemini が動かない',
    summary: '未設定、旧形式キー、セッション未復号、推定残量不足のどれかで止まることが多いです。',
    estimatedMinutes: 2,
    whenToUse: 'AI 相談や URL 解析でエラーが出るとき。',
    successState: 'AI 設定画面の状態が利用可能になり、Gemini 画面から再試行できる。',
    steps: [
      { title: '設定 → AI で状態カードを見る' },
      { title: '未設定なら API キー登録、保存済みなら復号を行う' },
      { title: '旧形式キーなら暗号化して再保存する' },
      { title: '必要なら軽量モデルへ切り替えて再試行する' },
    ],
    pitfalls: ['推定残量警告が出ているときは、まずモデルと使用量を見るのが近道です。'],
    primaryAction: { label: 'AI 設定へ移動', to: '/settings/ai' },
    secondaryAction: { label: 'AI 相談へ移動', to: '/gemini' },
    statusResolver: 'gemini',
  },
  {
    id: 'notifications-missing',
    group: 'troubleshooting',
    title: '通知が来ない',
    summary: 'ブラウザ権限、通知設定、OS 側の省電力設定の 3 点を順に確認すると切り分けしやすいです。',
    estimatedMinutes: 2,
    whenToUse: '買い物リストや献立完了の通知が来ないとき。',
    successState: '通知設定がオンで、ブラウザ権限も許可になっている。',
    steps: [
      { title: '設定 → 通知 を開く' },
      { title: '必要な通知トグルがオンか確認する' },
      { title: 'ブラウザの通知権限が許可になっているか確認する' },
      { title: 'OS の集中モードや省電力設定も見直す' },
    ],
    pitfalls: ['権限が拒否になっている場合はブラウザ設定から再許可が必要です。'],
    primaryAction: { label: '通知設定へ移動', to: '/settings/notifications' },
    statusResolver: 'notifications',
  },
]
