# MCPサーバー リファクタリング計画書（UI/UX向上・ベストプラクティス完全準拠版）

## 1. 背景と現状の課題 (Background & Current Issues)
現在の `apps/mcp-server` は、初期のPWA（Progressive Web App）アーキテクチャの延長線上で実装されており、以下の構造的課題（技術的負債）を抱えている。

1. **推論のサーバー側結合（脱PWAの必要性）**
   - 現状、`ask_kitchen`ツール内で直接 `@google/generative-ai` を呼び出し、推論結果のテキストのみを返している。
   - これにより、クライアントAI（Cursor等）が思考するための「生のコンテキスト（データ）」が失われ、コード修正やUI提案など、より高度な支援を引き出せない状態となっている。
2. **MCP能力の未活用**
   - すべての機能を「Tools（ツール）」として実装しており、MCPプロトコルが提供する「Resources（データ参照）」や「Prompts（指示テンプレート）」の能力が活用されていない。
3. **運用監視とプロトコル管理の欠如**
   - 実行時のメトリクス（応答時間や成功率）が計測されておらず、かつプロトコルのバージョン管理が不明確であるため、将来的なA/Bテストや互換性維持が困難な状態にある。

## 2. リファクタリングの目的 (Objectives)
- **UI/UXの劇的向上**: サーバー側での推論を廃止し、クライアントAIに「材料（Resources）」と「指示書（Prompts）」を提供する形へ移行する。AIが能動的にデータを読み取り、高度な提案を行える自律型基盤を構築する。
- **厳格なプロンプト構造化**: プロンプトを標準化された構造（Context/Task/Output/Constraints）で管理し、AIのハルシネーションを抑制する。
- **観測性の確立**: ツール実行の成否と遅延（Latency）を定量的に計測・ロギングする仕組みを導入し、本番環境（VPS）での安定稼働と継続的改善を可能にする。

---

## 3. 段階的実行計画 (Phased Roadmap)

### フェーズ1: プロンプトとAI推論の分離（脱PWAと構造化プロンプト導入）
**目的**: サーバー側で行っているLLM推論ロジックを廃止し、構造化されたMCP `Prompts` 機能へ移行する。

- [ ] `src/tools/consultation.ts` から `@google/generative-ai` の依存と推論ロジックを削除する。
- [ ] `src/index.ts` に `Prompts` の Capability を追加する。
- [ ] `ListPromptsRequestSchema` および `GetPromptRequestSchema` のハンドラを実装する。
- [ ] **【重要】** 既存の `ask_kitchen` をプロンプトテンプレートとして再定義する。**その際、返すテンプレートには必ず `Context`（文脈）、`Task`（指示）、`Output Format`（出力形式）、`Constraints`（制約条件）の4要素を含めるよう、厳格に構造化を強制する。**

### フェーズ2: Resources（リソース）の解放
**目的**: データベースの情報を「ツールによる関数呼び出し」ではなく、「URIによる静的/動的参照」としてクライアントAIへ公開する。

- [ ] `src/index.ts` に `Resources` の Capability を追加する。
- [ ] `ListResourcesRequestSchema` および `ReadResourceRequestSchema` のハンドラを実装する。
- [ ] 以下のURIスキームを設計・実装し、AIが直接データを読み取れるようにする。
  - `kitchen://stock/{userId}` : ユーザーの現在の在庫一覧（JSON）
  - `kitchen://menu/today/{userId}` : 今日の献立データ（JSON）
- [ ] 既存の読み取り専用ツール（`get_stock` 等）の一部を非推奨とし、Resourceへのアクセスへ誘導する。

### フェーズ3: スキーマ自動化・バージョン管理・メトリクス計測（負債解消と観測性）
**目的**: 手動管理を廃止し、本番運用に耐えうる観測性と拡張性を備えたコードベースを確立する。

- [ ] **【重要】** `src/index.ts` のサーバー初期化設定において、プロトコルのバージョンを最新の仕様に準拠させ、`LATEST_PROTOCOL_VERSION = "2024-11-05"` 等の **YYYY-MM-DD形式** で明示的に定義・管理する。
- [ ] `package.json` に `zod-to-json-schema` を追加し、各ツールの Zod スキーマからJSON Schemaを動的に自動生成・マッピングする仕組みを構築する（二重管理の廃止）。
- [ ] `CallToolRequestSchema` 内の `if-else` チェーンを廃止し、「レジストリパターン」へルーティングをリファクタリングする。
- [ ] **【重要】** `CallToolRequestSchema` のハンドラに計測用ミドルウェアを導入する。各ツールの実行時間（`Response Latency`）と成功・失敗ステータス（`Tool Correctness`）をトラッキングし、`pino` を用いてJSON形式で構造化ロギングを行う。

---

## 4. 導入すべき依存パッケージ
本リファクタリングにあたり、以下のパッケージの追加を必須とする。

```json
"dependencies": {
  "zod-to-json-schema": "^3.23.0", // スキーマの二重管理解消用
  "pino": "^9.0.0"                 // 構造化ロギングおよびメトリクス出力用
}
