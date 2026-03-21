# Memory-Aware Dev Agents

この repo では、Claude Code / Codex / Antigravity の 3 ツールが共通の memory runtime を使う。

## Shared Runtime

- path: `/Users/jrmag/.local/share/agent-memory`
- command: `/Users/jrmag/.local/share/agent-memory/bin/memoryctl`
- default mode: `observe`

## Memory Policy

1. 作業開始前に role に応じて recall する。
2. role handoff と failure は task memory に同期する。
3. canonical memory へは reusable な判断だけを昇格候補として送る。
4. 現行 repo 状態と矛盾する memory は信用しない。
5. 会話全文・思考全文・大量ログは memory に保存しない。
6. canonical 候補は `memoryctl audit` で監査してから昇格する。

## Role Mapping

- orchestrator: 制約、過去判断、未解決論点
- coder: 類似実装、既知の罠、依存制約
- reviewer: recurring findings、危険な変更パターン
- tester: edge case、回帰シナリオ、未カバー領域
- debugger: root cause、再発条件、修正履歴

## Observe Mode

- recall: active
- task-sync: active
- canonical writeback: `runtime/pending-canonical.jsonl` へ capture

`AGENT_MEMORY_MODE=enforce` に切り替えるまで canonical は監査対象として扱う。

## Canonical Audit Rules

- hard reject: 低重要度、短すぎる要約、秘密情報、TODO/WIP/next_action のような一時情報
- manual review: 参照不足、既存 canonical に近すぎる、pending 候補と重複している
- approve: reusable で evidence があり、現在の repo と矛盾せず、near-duplicate ではない

## Observe To Enforce Gate

次を満たすまで `enforce` へ上げない:

1. pending canonical 候補が 10 件以上ある
2. reject が 0 件
3. review が全候補の 25% 以下
4. secrets / tokens / transient work item が 0 件

## Workflow Authority

- repo-local workflow の正本はこの `AGENTS.md` と repo ルートの `CLAUDE.md`
- `.claude/agents/` と `.gemini/skills/` は tool-specific mirror として扱い、role semantics と handoff rule を一致させる
- `~/.claude/` には user-global policy だけを置き、repo 固有の path / release rule / debug playbook を混ぜない

## Skill Routing

- orchestrator: 計画前に `memory-recall`。task と repo から必要 skill だけを絞る。常時全 skill を有効化しない。
- orchestrator: frontend web task は `vercel-react-best-practices` を候補に入れる。非 UI の data / script / backend 寄り変更では frontend skill を足さない。
- coder: React/Vite の UI・route・data-fetch・perf 変更は `vercel-react-best-practices` を使う。
- coder: boolean props 増殖、compound component、provider/context API の整理では `vercel-composition-patterns` を追加で使う。
- reviewer: UI 変更のレビュー、UX/a11y 監査、デザイン品質確認では `web-design-guidelines` を使い、review ごとに最新ルールを取り直す。web 取得ルールは review input として扱い、自動で実装判断に昇格しない。
- deploy: preview / release / Vercel 反映の依頼時は `vercel.json` の有無に関係なく `deploy-to-vercel` を使う。production は明示依頼がある時だけ。
- skip: `vercel-react-native-skills` は Expo / React Native が repo か task に現れるまで使わない。
- tester: workflow 検証は positive case だけでなく negative case、overlap case、failure case を含める。

## Skill Routing Guards

- allowlist: `vercel-react-best-practices` は React/Vite の UI、route、data fetch、bundle/perf、frontend refactor でのみ使う。
- allowlist: `vercel-composition-patterns` は boolean props 増殖、compound component、render props、provider/context API 整理でのみ使う。
- allowlist: `web-design-guidelines` は UI review、a11y review、UX audit でのみ使う。
- allowlist: `deploy-to-vercel` は preview deploy、production deploy、release verification、shareable link 取得でのみ使う。
- denylist: `question-only`、`read-only`、`tiny-fix`、`docs-only` では追加 skill を起動しない。
- denylist: backend / data / script-only タスクでは frontend skill を起動しない。
- denylist: `vercel-react-native-skills` は `expo`、`react-native`、mobile native API が prompt または repo に明示される場合だけ使う。
- overlap: 複数 skill が該当しても最小集合に絞る。React web task で `web-design-guidelines` を coder に渡さない。

## Role Contracts

### orchestrator
- Inputs: user goal、repo constraints、recalled memory、直近の handoff summary
- Outputs: 規模判断、実装計画、skill routing、次 role への handoff 要約
- Fallback: subagent / skill が起動できなくても、同一会話で role を明示して続行する
- Exit Criteria: 承認済み計画を coder へ渡すか、軽作業を単発で完了する

### coder
- Inputs: 承認済み計画、関連ファイル、repo rules、recalled constraints
- Outputs: 実装、検証結果、touched files、reviewer 向け注意点
- Fallback: write/edit が拒否されたら patch-ready diff または適用手順を返し、変更済みと偽らない
- Exit Criteria: 変更を検証し、reviewer に必要情報を handoff 済み

### reviewer
- Inputs: 変更差分、実装意図、known findings、必要なら UI review source
- Outputs: Critical / Warning / Suggestion、判定、tester または coder への next action
- Fallback: visual review 不能なら code-based review に切り替え、未確認領域を明示する
- Exit Criteria: Critical の有無を確定し、次 role を決める

### tester
- Inputs: 承認済み変更、review result、existing tests、edge cases
- Outputs: 実行コマンド、pass/fail、未カバー領域、debugger 向け failure summary
- Fallback: テスト環境が壊れている場合は最小再現、build/lint、静的検証へ段階的にフォールバックする
- Exit Criteria: pass を確認するか、再現可能な failure を debugger へ渡す

### debugger
- Inputs: エラー全文、失敗コマンド、関連 diff、previous regressions
- Outputs: root cause、修正、再実行結果、再発防止
- Fallback: 原因未確定なら仮説を 3 つまでに絞り、試行ごとの結果を記録して止まる
- Exit Criteria: 失敗を再現し、修正後に同じ確認を通すか、3 回失敗で状況を報告する

## Degraded Mode Policy

- skill denied: skill が使えなくても role contract に従って plain workflow で続行する
- tool denied: 書き込み不可なら diff / patch / 手順へ切り替え、未適用であることを明記する
- visual unavailable: UI を見られない場合はコード、DOM、テスト、a11y 属性ベースで監査し、視覚確認未実施を残す
- deploy blocked: auth / link / size 制約で deploy 不能なら local build、preview fallback、blocker を報告する
- memory missing: recall 結果が空でも停止しない。現行 repo を authority として続行する
- agent mismatch: Claude/Gemini/Codex で挙動差が出たら degraded pass / hard fail を分けて評価する

## Handoff Schema

- required: `role`, `state`, `summary`, `decision`, `unresolved`, `next_action`
- optional: `files`, `commands`, `evidence`, `risks`
- rule: 会話全文ではなく 5 行以内の要約にする
- rule: failure handoff は失敗コマンドと stderr の抜粋を必ず含める

## Validation Gates

- repo-managed routing/eval は `npm run workflow:validate`
- live prompt smoke test は `npm run workflow:smoke`
- workflow / hooks / mirror を変えたら `workflow:validate` を必須、routing policy や degraded mode を変えたら `workflow:smoke` も実行する
- pass 条件: routing、skills、memory、hooks、loaders、live-smoke がすべて green または degraded-pass であること
