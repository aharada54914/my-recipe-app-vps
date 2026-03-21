# Help Content / UIUX Refactor Plan

Last updated: 2026-03-07
Target: in-app `ヘルプ` tab and the source content used by it

## 1. Current State

Current implementation:

- UI: [src/components/settings/GuideTab.tsx](/Users/jrmag/my-recipe-app/src/components/settings/GuideTab.tsx)
- Content source: [src/constants/settingsGuide.ts](/Users/jrmag/my-recipe-app/src/constants/settingsGuide.ts)
- Long-form doc: [docs/SETTINGS_GUIDE.md](/Users/jrmag/my-recipe-app/docs/SETTINGS_GUIDE.md)

The current in-app help is a static list of four fully-expanded articles:

1. Google backup
2. Google Calendar sharing
3. Gemini API
4. Manual migration

Each article has:

- title
- badge
- short summary
- ordered steps
- optional notes

This is structurally simple, but it is no longer sufficient for the current product scope.

## 2. Key Problems

### 2.1 Content scope is too narrow

The `ヘルプ` tab is named like a general help center, but the content is almost entirely settings setup.

What is missing:

- daily-use flows
  - how to search recipes efficiently
  - how to ask Gemini
  - how to make a weekly menu
  - how to use stock actions
- troubleshooting
  - Google login button not showing
  - backup not visible
  - Gemini key test fails
  - notifications do not arrive
- confirmation criteria
  - “what good looks like” after each setup

Result:

- the help center does not match the user’s actual top tasks
- users must infer success/failure themselves

### 2.2 The reading flow is poor on mobile

All sections are fully expanded by default.

Problems:

- long initial scroll
- low information scent
- users cannot quickly scan and jump to the one problem they have
- the visual hierarchy is flat: every section looks equally urgent

Result:

- good for reading top-to-bottom once
- weak for “I have one question right now”

### 2.3 Articles are written as procedure lists, not outcome-oriented guides

The current pattern is “open X, press Y, choose Z”.

What is missing:

- who needs this
- what benefit the user gets
- prerequisites
- how to verify success
- what to do if blocked

Result:

- setup steps are clear enough
- decision-making is still hard

### 2.4 UI is passive

The articles are display-only.

Missing interaction:

- jump buttons to the relevant settings page
- shortcuts to common destinations
- completion/status chips
- “troubleshoot” expansion

Result:

- the help tab explains actions, but does not help perform them

### 2.5 Content duplication is unmanaged

The same guidance exists in two places:

- in-app article constants
- markdown docs

There is no content model that separates:

- concise in-app help
- detailed external documentation

Result:

- drift risk
- inconsistent wording risk
- repeated maintenance

## 3. Refactor Principles

### Principle 1: In-app help should solve immediate tasks, not be a full manual

The in-app help must optimize for:

- fast scanning
- single-task completion
- mobile use

Long explanations should live in docs, not in the main help surface.

### Principle 2: Help should follow user intent

Group help by user goal, not by internal subsystem.

Recommended top-level intents:

- 今すぐ使い始めたい
- 毎日よく使う
- 共有や移行をしたい
- 困ったとき

### Principle 3: Every help card should answer 5 questions

Each article should answer:

1. これは何のためか
2. いつ必要か
3. 何をすればよいか
4. うまくいった状態は何か
5. 詰まったらどこを見るか

### Principle 4: The help surface should be actionable

Every article should have at least one CTA:

- relevant settings page
- relevant feature page
- troubleshooting branch

## 4. Proposed Information Architecture

### 4.1 Replace the current four-card list with four groups

Recommended group structure:

1. `まずはここから`
2. `よく使う操作`
3. `共有・移行`
4. `困ったとき`

### 4.2 Recommended article set

#### Group A: まずはここから

1. `Google でデータを守る`
2. `Gemini を使えるようにする`
3. `見やすいテーマに切り替える`

#### Group B: よく使う操作

1. `レシピをすばやく探す`
2. `AI に相談する`
3. `週間献立を作る`
4. `在庫を追加して使い切る`

#### Group C: 共有・移行

1. `家族カレンダーに献立を出す`
2. `機種変更でデータを移す`
3. `在庫を QR で共有する`

#### Group D: 困ったとき

1. `Google ログインが出ない`
2. `バックアップが不安`
3. `Gemini が動かない`
4. `通知が来ない`

## 5. Recommended Article Template

Replace the current `title + steps + notes` model with a richer but still compact schema.

Suggested model:

```ts
type HelpArticle = {
  id: string
  group: 'getting-started' | 'daily' | 'sharing' | 'troubleshooting'
  title: string
  summary: string
  badge?: string
  estimatedMinutes?: number
  prerequisites?: string[]
  successState?: string
  steps: { title: string; detail?: string }[]
  pitfalls?: string[]
  primaryAction?: { label: string; to: string }
  secondaryAction?: { label: string; to: string }
  statusResolver?: 'google' | 'calendar' | 'gemini' | 'notifications'
}
```

Minimum article rules:

- summary: 50 to 90 chars
- steps: 3 to 5
- pitfalls: max 3
- at least 1 CTA
- at most 1 badge

## 6. Content Rewrite Guidance

### 6.1 Make the title user-facing

Current:

- `AI機能を使いたい（Gemini API）`

Better:

- `Gemini を使えるようにする`

Reason:

- simpler
- closer to user intent

### 6.2 Shorten summaries

Current summaries explain too much too early.

Better pattern:

- one sentence for value
- optional second sentence only if it changes the decision

Example:

- `在庫から提案や URL 解析を使うには、Gemini API キーの保存が必要です。`

### 6.3 Add success criteria

Example:

- `成功の目安: 画面上部の状態が「接続済み」になり、テストが成功する`

This reduces anxiety and support burden.

### 6.4 Add failure branches directly in articles

Example:

- `Googleでログインボタンが出ない場合`
  - `詳細設定に Client ID が入っているか確認`
  - `ページを再読み込み`

This should be inside the card, not only in docs.

### 6.5 Reflect actual daily flows

The user’s common flows are:

- recipe search
- ask AI

The help center should surface those above migration topics.

## 7. UIUX Refactor Recommendations

### 7.1 Add quick shortcuts at the top

Top row of tappable chips:

- `バックアップ`
- `AI設定`
- `週間献立`
- `困ったとき`

Purpose:

- reduce scroll
- improve entry speed

### 7.2 Use accordion cards, not fully expanded long cards

Recommended default:

- first group expanded
- all other groups collapsed

Benefits:

- less scroll on mobile
- clearer scan path
- better focus

### 7.3 Add CTA buttons inside each article

Examples:

- `接続を開く`
- `AI設定を開く`
- `週間献立へ`
- `データ設定を開く`

Without this, help stays informational only.

### 7.4 Add context-aware status chips

Examples:

- `未設定`
- `設定済み`
- `要確認`

For:

- Google connection
- calendar selection
- Gemini key
- notification permission

This makes the help tab feel personalized and much more useful.

### 7.5 Visually separate “how to do it” from “注意点”

Current notes are visually too similar to steps.

Use a clearer split:

- steps: solid surface
- warnings: tinted caution box
- success state: green confirmation row

### 7.6 Reduce repeated chrome inside every card

Current cards repeat:

- icon
- badge
- summary
- list
- notes

For mobile, use more compact headers:

- title
- tiny badge
- one-line summary

Then reveal details on expansion.

### 7.7 Add “last updated” or “for current version” once, not per article

This belongs in the page header/footer, not in individual cards.

## 8. Recommended New Help Screen Layout

### Header area

- title: `ヘルプ`
- subtitle: `やりたいことから選ぶ`
- shortcut chips

### Group 1

- `まずはここから`
- 2 or 3 cards

### Group 2

- `よく使う操作`
- daily flows first

### Group 3

- `共有・移行`

### Group 4

- `困ったとき`
- troubleshooting articles

### Footer

- `詳しいドキュメントを見る`
- `アプリ情報`

## 9. Relationship Between In-App Help and Markdown Docs

Recommended split:

- in-app help:
  - short
  - actionable
  - contextual
  - CTA-driven
- markdown docs:
  - longer explanations
  - background concepts
  - advanced setup
  - environment-specific notes

Refactor rule:

- do not copy full markdown doc into the in-app help
- instead derive both from one shared content model or shared wording guidelines

## 10. Implementation Plan

### Phase 1: Content model refactor

- replace `GuideSection` with `HelpArticle` model
- add groups, success state, pitfalls, CTA metadata
- keep article count small at first

### Phase 2: IA rewrite

- rewrite the article set around user intents
- move daily-flow help above migration help
- add troubleshooting articles

### Phase 3: Help UI refactor

- add top shortcuts
- convert long sections to grouped accordions
- add CTA buttons
- add status chips

### Phase 4: Content synchronization

- align wording between in-app help and markdown docs
- reduce duplication
- define which content lives where

### Phase 5: QA and regression coverage

- component tests for grouped rendering and CTA navigation
- smoke test for opening help and jumping to AI / 接続 / データ
- visual snapshot for the help screen

## 11. Test Plan

### Component tests

- group titles render in the intended order
- cards collapse/expand correctly
- CTA buttons navigate to the correct route
- status chips reflect mocked app state

### Smoke tests

- open `/settings/help`
- tap `AI設定`
- tap `接続`
- open one troubleshooting card

### Visual tests

- light theme help baseline
- dark theme help baseline

## 12. Recommended Priority

Priority order:

1. rewrite the content IA
2. add grouped/collapsed UI
3. add CTA buttons
4. add status-aware personalization
5. align markdown docs

## 13. Minimum Viable Improvement

If only a small tranche is possible first, do this:

1. change the article set from 4 setup-only cards to 6 intent-based cards
2. add top shortcut chips
3. collapse all but the first group
4. add CTA buttons to `接続`, `AI`, `データ`, `週間献立`

That alone would materially improve scan speed, reduce scroll, and make the help tab feel useful rather than archival.
