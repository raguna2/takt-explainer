---
title: プロバイダーとエンジン
description: taktのマルチプロバイダーアーキテクチャとエンジン抽象化の設計
---

## マルチプロバイダーの必要性

AIコーディングエージェントの市場は急速に多様化しています。Claude Code、OpenAI Codex、Cursor、GitHub Copilotなど、開発者が利用できるAIツールは増え続けています。さらに、同じプロバイダーでも複数のモデル（Claude opus、Claude sonnet等）が提供されており、タスクの特性に応じて最適なモデルを選択したいというニーズがあります。

taktはこの多様性に対応するため、**プロバイダー抽象化**を設計の中核に据えています。

## Provider層の設計

### 抽象化レイヤー

Provider層は、各AIプロバイダーの差異を吸収する抽象化レイヤーです。上位のエンジン層から見ると、すべてのプロバイダーは同一のインターフェースで操作できます。

```
Engine層 ──→ Provider Interface ──→ Claude Code Provider
                                ──→ OpenAI Codex Provider
                                ──→ OpenCode Provider
                                ──→ Cursor Provider
                                ──→ Copilot Provider
                                ──→ Claude API Provider
                                ──→ OpenAI API Provider
```

### 対応プロバイダーの詳細

#### Claude Code（デフォルト）

Claude Codeは、taktのデフォルトプロバイダーです。`@anthropic-ai/claude-agent-sdk`を通じて連携します。

```yaml
# 設定例
provider: claude
model: sonnet  # opus, sonnet, haiku
```

Claude Codeは、ファイルの読み書き、コマンド実行、Git操作など、開発に必要な幅広いツールを提供します。taktのビルトインペルソナの多くはClaude Codeのツールセットを前提に設計されています。

#### OpenAI Codex

OpenAI Codexは、`@openai/codex-sdk`を通じて連携します。Codex CLIが事前にインストールされている必要があります。

```yaml
provider: codex
model: codex  # Codex SDKのデフォルトモデル
```

#### OpenCode

OpenCodeは、`@opencode-ai/sdk`を通じて連携します。

```yaml
provider: opencode
```

#### Cursor / Copilot

CursorとCopilotは、それぞれのIDE/エディタの機能を通じて連携します。

```yaml
provider: cursor   # Cursor Agent
provider: copilot  # GitHub Copilot
```

#### API直接呼び出し

Claude APIやOpenAI APIを直接呼び出すことも可能です。API Keyの設定が必要です。

```bash
# 環境変数で設定
export TAKT_ANTHROPIC_API_KEY=sk-ant-...
export TAKT_OPENAI_API_KEY=sk-...
```

```yaml
provider: anthropic-api
model: claude-sonnet-4-20250514

provider: openai-api
model: gpt-4o
```

## Movement単位のプロバイダー指定

taktの強力な機能の一つは、**Movement単位でプロバイダーやモデルを変更**できることです。これにより、タスクの特性に応じた最適なモデル選択が可能になります。

```yaml
movements:
  - name: design
    persona: architect-planner
    model: opus              # 設計にはより高性能なモデルを使用
    instruction_template: |
      以下のタスクのアーキテクチャを設計してください。
      {task}

  - name: implement
    persona: coder
    model: sonnet            # 実装にはコスト効率の良いモデルを使用
    instruction_template: |
      以下の設計に基づいて実装してください。
      {previous_response}

  - name: review
    persona: supervisor
    model: opus              # 最終レビューには高性能モデルを使用
    instruction_template: |
      実装結果をレビューしてください。
      {previous_response}
```

### モデル選択の指針

| 用途 | 推奨モデル | 理由 |
|---|---|---|
| 設計・計画 | opus | 複雑な推論と長期的な見通しが必要 |
| 実装 | sonnet | コスト効率が良く、定型的なコーディングに十分 |
| レビュー | opus | 細部の問題を見逃さない高い分析能力 |
| 高速プロトタイプ | haiku/sonnet | 速度重視のタスクに適切 |

### ペルソナプロバイダー設定

Piece定義内で `persona_providers` を使うと、ペルソナごとにプロバイダーを固定できます。

```yaml
persona_providers:
  coder: claude
  reviewer: codex
```

この設定により、coderペルソナは常にClaude Codeで実行され、reviewerペルソナは常にOpenAI Codexで実行されます。異なるAIの特性を活かしたクロスレビューが可能になります。

## エンジン層の詳細

### PieceEngineの責務

PieceEngineは、Piece実行モデルの章で解説した3フェーズ実行を管理する中核コンポーネントです。エンジン層は以下の責務を持ちます。

1. **フェーズの制御**: Phase 1 → Phase 2 → Phase 3 の順序を管理
2. **プロンプトの構築**: 命令構築層（Layer 6）を呼び出し、各フェーズのプロンプトを組み立てる
3. **プロバイダーの呼び出し**: Provider層（Layer 7）を通じてAIを実行する
4. **結果の解析**: AIの出力からステータスタグを抽出する
5. **イベントの発行**: 実行状況をイベントとして上位層に通知する

### イベント駆動アーキテクチャ

PieceEngineはイベント駆動で設計されています。エンジンは実行の各段階でイベントを発行し、UIやログシステムがこれらのイベントをサブスクライブします。

```
PieceEngine
    │
    ├── emit("step:start", { movement, persona, phase })
    │       ↓
    │   [CLI] "🎵 Movement: write-code (coder) を実行中..."
    │   [Log] { event: "step:start", ... }
    │
    ├── emit("step:complete", { movement, status, next })
    │       ↓
    │   [CLI] "✓ write-code 完了 → review へ遷移"
    │   [Log] { event: "step:complete", ... }
    │
    └── emit("piece:complete", { result })
            ↓
        [CLI] "🎶 Piece完了: success"
        [Log] { event: "piece:complete", ... }
```

このイベント駆動設計により、以下が実現されます。

- **実行とプレゼンテーションの分離**: エンジンは表示方法を知らず、イベントを発行するだけ
- **複数のサブスクライバー**: CLIとログシステムが同じイベントを独立に処理
- **テスト容易性**: イベントの発行をモックすることで、エンジンの動作を検証可能
- **拡張性**: Web UIやAPIサーバーなど、新しいサブスクライバーを追加可能

## 命令構築層の詳細

### プロンプト構築パイプライン

命令構築層（Layer 6）は、ファセットプロンプティングの各要素を収集・統合し、最終的なプロンプトを構築します。

```
[入力]
├── Persona定義ファイル (Markdown)
├── Policy定義ファイル (Markdown)
├── Movement.instruction_template (YAML内)
├── Knowledge定義ファイル (Markdown, オプション)
├── テンプレート変数の値
└── エンジン自動生成要素
    │
    ▼
[テンプレート変数の展開]
    │ {task} → 実際のタスク内容
    │ {previous_response} → 前のMovementの出力
    │ {iteration} → イテレーション回数
    │
    ▼
[ファセットの統合]
    │ @anthropic-ai/faceted-prompting
    │ 各ファセットを最適な構造に配置
    │
    ▼
[ステータス判定要素の注入]
    │ rules定義からステータスタグの説明を生成
    │
    ▼
[最終プロンプト]
    │ Provider層に送信
    ▼
AI実行
```

### ステータスタグの自動注入

エンジンは、Movement定義の `rules` からステータス判定に必要な情報を自動的にプロンプトに注入します。この自動注入により、Persona定義やInstruction定義にステータス判定ロジックを記述する必要がなくなります。

ペルソナの作者は「専門家としての振る舞い」に集中でき、ワークフロー制御の責務はエンジンが担います。これは関心の分離の原則の実践です。

## 設定の階層構造

taktの設定は、3つの階層で管理されます。上位の設定は下位の設定によって上書き可能です。

```
[Layer 1: デフォルト設定]
    │ takt内蔵のデフォルト値
    ▼
[Layer 2: グローバル設定]
    │ ~/.takt/config.yaml
    │ ユーザー全体に適用
    ▼
[Layer 3: プロジェクト設定]
    │ .takt/config.yaml
    │ プロジェクト固有の設定
    ▼
[Layer 4: Piece定義]
    │ 各Pieceファイル内の設定
    │ Movement単位の設定
    ▼
[最終的な設定値]
```

### グローバル設定例

```yaml
# ~/.takt/config.yaml
language: ja               # 表示言語
default_piece: default      # デフォルトで使用するPiece
provider: claude            # デフォルトプロバイダー
model: sonnet              # デフォルトモデル
```

### プロジェクト設定例

```yaml
# プロジェクトルート/.takt/config.yaml
piece: simple-review        # このプロジェクト固有のPiece
provider: claude
model: opus                # このプロジェクトではopusを使用

# プロジェクト固有のポリシー
policies:
  - .takt/policies/coding-standards.md
  - .takt/policies/security-policy.md

# プロジェクト固有のナレッジ
knowledge:
  - .takt/knowledge/architecture.md
  - .takt/knowledge/api-specs.md
```

この階層構造により、共通の設定をグローバルに定義しつつ、プロジェクトごとの特殊な要件にも柔軟に対応できます。

## エラーハンドリング

### プロバイダー障害時の挙動

Provider層では、AIプロバイダーとの通信エラーが発生する可能性があります。taktは以下のエラーハンドリング戦略を採用しています。

1. **リトライ**: 一時的なネットワークエラーの場合、自動的にリトライ
2. **タイムアウト**: 一定時間応答がない場合、タイムアウトとして処理
3. **フォールバック**: 特定のプロバイダーが利用できない場合のフォールバック先を設定可能
4. **ログ記録**: すべてのエラーはNDJSON形式でログに記録

### ステータス判定の失敗

Phase 3のステータス判定で、AIの出力からステータスタグを抽出できない場合、5段階フォールバック（Tier 1〜Tier 5）が順次適用されます。最終的なTier 5（包括的フォールバック）まで到達した場合、デフォルトの遷移先に進みます。

これにより、AIの出力が予期しない形式であっても、ワークフローの実行が停止することはありません。

## コスト管理

マルチプロバイダー環境では、AIの利用コストの管理も重要な関心事です。taktは以下の機能でコスト管理を支援します。

### Movement単位のモデル選択

前述の通り、Movement単位でモデルを変更できます。コスト効率を考慮して、以下のような戦略が推奨されます。

- **高コスト（opus）**: 設計、最終レビュー、複雑な判断
- **低コスト（sonnet/haiku）**: 定型的な実装、フォーマット変換、簡易チェック

### 分析機能

taktの `features/` ディレクトリには分析（Analytics）機能が含まれており、各Movement/Pieceの実行コスト（トークン数、実行時間）を追跡できます。これにより、ワークフローのコスト最適化が可能になります。

## まとめ

taktのプロバイダー/エンジンアーキテクチャは、以下の設計原則に基づいています。

1. **抽象化による独立性**: Provider層がAIプロバイダーの差異を吸収し、上位層は統一的なインターフェースで操作
2. **Movement単位の柔軟性**: タスクの特性に応じて最適なモデルを選択可能
3. **イベント駆動の疎結合**: 実行エンジンと表示・ログが分離され、拡張性を確保
4. **階層的な設定管理**: グローバル/プロジェクト/Piece/Movementの4段階で柔軟に設定を管理
5. **堅牢なエラーハンドリング**: 多段階フォールバックにより、どのような状況でも実行が継続
