---
title: アーキテクチャ概要
description: taktの7層アーキテクチャとデータフローの全体像
---

## 7層アーキテクチャ

taktの内部は、明確に分離された7つの層（レイヤー）で構成されています。各層は単一の責務を持ち、上位層から下位層へとデータが流れる一方向のアーキテクチャです。

```
┌─────────────────────────────────────┐
│  Layer 1: CLI Input                 │  ← ユーザー入力の受付
├─────────────────────────────────────┤
│  Layer 2: Interactive Processing    │  ← 対話的な要件整理
├─────────────────────────────────────┤
│  Layer 3: Orchestration             │  ← ワークフロー全体の管理
├─────────────────────────────────────┤
│  Layer 4: Piece Execution           │  ← Piece定義に基づく実行制御
├─────────────────────────────────────┤
│  Layer 5: Engine                    │  ← 3フェーズ実行エンジン
├─────────────────────────────────────┤
│  Layer 6: Instruction Building      │  ← プロンプト構築
├─────────────────────────────────────┤
│  Layer 7: Provider                  │  ← AIプロバイダーとの通信
└─────────────────────────────────────┘
```

この7層構造は、taktの柔軟性と拡張性の基盤です。各層が疎結合であるため、例えばAIプロバイダーを変更してもワークフロー定義に影響を与えず、新しいコマンドを追加してもエンジンの動作に影響を与えません。

## Layer 1: CLI Input（CLIインプット層）

最上位層は、ユーザーからの入力を受け付けるコマンドラインインターフェースです。taktは`commander`ライブラリを使用してCLIを実装しており、以下の入力パターンを処理します。

### コマンド体系

```bash
# メインコマンド: 対話/パイプラインモード
takt                              # 対話モード（タスクなし）
takt "認証機能を実装したい"         # 対話モード（初期メッセージ付き）
takt #99                          # GitHub Issue指定
takt --pipeline --task "..."       # パイプラインモード

# タスク管理コマンド
takt run                           # キューイングされたタスクの順次実行
takt watch                         # ディレクトリ監視・常駐実行
takt add                           # 対話的タスク追加
takt add #28                       # Issue番号指定でタスク追加
takt clear                         # セッションリセット

# ユーティリティコマンド
takt init                          # プロジェクト設定の初期化
takt config                        # 設定の確認・変更
```

この層は入力の解析とバリデーションのみを担い、ビジネスロジックには関与しません。解析された入力は次の層（Interactive Processing）に渡されます。

### レパートリーシステム

taktには**レパートリー**（Repertoire）という仕組みがあり、特定のタスクパターンに対して事前定義されたコマンドセットを提供します。レパートリーは音楽用語で「演奏家のレパートリー」を意味し、よく使うワークフローパターンをすぐに呼び出せるようにする機能です。

## Layer 2: Interactive Processing（対話処理層）

対話モードで起動された場合、この層がユーザーとの対話的なやり取りを担います。

### 対話フロー

1. **コードベースの調査**: AIエージェントがプロジェクトの構造を調査する（Read、Glob、Grep、Bashツールを使用）
2. **要件の確認**: ユーザーの意図を確認し、タスクの詳細を詰める
3. **計画の提示**: 実装計画を提示し、ユーザーの承認を得る
4. **実行開始**: `/go` コマンドで実行を開始、`/cancel` で中止

この層は、タスクの内容が曖昧な場合に特に重要です。AIエージェントがコードベースを理解した上で、適切な計画を立てるための対話プロセスを提供します。

### ワークツリー隔離

対話処理層は、タスク実行時にgit **worktree**（ワークツリー）を使った隔離環境を作成します。これにより、taktのタスク実行が開発者の作業中のコードを汚染しません。

```
main (作業中のブランチ)
  ├── .git/worktrees/
  │   └── takt-task-123/        ← taktの実行環境（隔離）
  │       ├── feature-branch    ← 自動作成されたブランチ
  │       └── ... (コード変更)
  └── src/ (開発者の作業は影響を受けない)
```

タスク完了後、worktreeから自動的にプルリクエストが作成されます。

## Layer 3: Orchestration（オーケストレーション層）

オーケストレーション層は、ワークフロー全体のライフサイクルを管理する中核的な層です。

### 責務

1. **Piece定義の読み込み**: YAMLファイルからPiece定義を解析し、バリデーションする
2. **実行コンテキストの構築**: タスク情報、プロジェクト設定、セッション情報を集約する
3. **Piece Execution層への委譲**: 構築されたコンテキストとともにPiece Execution層を起動する
4. **結果の集約**: 実行結果を収集し、レポートを生成する

### セッション管理

オーケストレーション層は**セッション**の管理も担います。taktのタスクは中断と再開が可能で、セッションIDによって状態が管理されます。再度taktを実行すると、前回のセッションから続行するか、新しいセッションを開始するかを選択できます。`takt clear` コマンドでセッションをリセットできます。

### レポート生成

タスク完了時に、オーケストレーション層は自動的にMarkdown形式のレポートを生成します。レポートには以下が含まれます。

- タスクの概要と実行結果
- 各Movementの入出力
- 検出された問題と対応
- 変更されたファイルの一覧

レポートは `.takt/reports/` ディレクトリに保存されます。

## Layer 4: Piece Execution（Piece実行層）

Piece実行層は、Piece定義に基づいてMovementの実行順序を制御する層です。この層の詳細は[Piece実行モデル](/architecture/02-piece-execution/)で解説します。

### 主要な責務

- **Movement間の遷移制御**: ルールに基づいて次のMovementを決定する
- **イテレーション管理**: Piece全体のイテレーション回数とMovement単位のイテレーション回数を管理する
- **テンプレート変数の解決**: `{task}`、`{previous_response}`などの変数を実際の値に置換する
- **並列実行の管理**: 並列Movementの同時実行と結果の集約を行う

### イベントアーキテクチャ

Piece Execution層は**イベント駆動**で設計されています。PieceEngineは実行の各段階でイベントを発行し、プレゼンテーション層（CLI出力）はこれらのイベントをサブスクライブして表示を更新します。

```
PieceEngine Events:
  ├── step:start       → Movement開始時
  ├── step:complete    → Movement完了時
  ├── piece:iteration  → Pieceイテレーション時
  └── piece:complete   → Piece完了時
```

この設計により、実行ロジックと表示ロジックが分離され、CLIだけでなくWeb UIやAPI経由での実行にも対応可能な拡張性が確保されています。

## Layer 5: Engine（エンジン層）

エンジン層は、個々のMovementを**3つのフェーズ**で実行する層です。この3フェーズ実行モデルは、taktの品質保証メカニズムの中核です。詳細は[Piece実行モデル](/architecture/02-piece-execution/)で解説します。

| フェーズ | 目的 | 概要 |
|---|---|---|
| Phase 1: Main | メイン実行 | AIエージェントがタスクを実行する |
| Phase 2: Report | レポート出力 | 実行結果のレポートを生成する（オプション） |
| Phase 3: Status | ステータス判定 | 実行結果を評価し、次の遷移を決定する |

## Layer 6: Instruction Building（命令構築層）

命令構築層は、各Movementの実行に必要な**プロンプト**を構築する層です。ファセットプロンプティングの5つの関心事（Persona、Policy、Instruction、Knowledge、Output Contract）を統合し、最終的なプロンプトを組み立てます。

### 構築プロセス

```
Persona定義 ─────┐
Policy定義 ──────┤
Instruction ─────┤──→ Instruction Builder ──→ 最終プロンプト
Knowledge ───────┤
Output Contract ─┘
```

命令構築層の詳細は[ファセットプロンプティング](/architecture/03-faceted-prompting/)で解説します。

## Layer 7: Provider（プロバイダー層）

最下位層は、実際のAIプロバイダーとの通信を担います。taktは複数のAIプロバイダーに対応しており、Provider層がその差異を吸収します。

### 対応プロバイダー

| プロバイダー | 接続方式 | 備考 |
|---|---|---|
| **Claude Code** | claude-agent-sdk | デフォルト |
| **OpenAI Codex** | codex-sdk | Codex CLIが必要 |
| **OpenCode** | opencode-sdk | OpenCode CLIが必要 |
| **Cursor** | Cursor Agent | Cursor IDEが必要 |
| **Copilot** | GitHub Copilot | GitHub Copilotが必要 |
| **Claude API** | Anthropic API直接 | API Keyで直接呼び出し |
| **OpenAI API** | OpenAI API直接 | API Keyで直接呼び出し |

Provider層の詳細は[プロバイダーとエンジン](/architecture/04-providers-and-engine/)で解説します。

## ソースコードの構成

taktのソースコードは、7層アーキテクチャを反映したディレクトリ構成になっています。

```
src/
├── app/cli/           → Layer 1: CLI Input
├── commands/          → Layer 1: コマンド定義
│   └── repertoire/    → レパートリーシステム
├── core/              → Layer 3-5: コアロジック
├── features/          → 横断的機能（Analytics等）
├── agents/            → Layer 7: Agent関連
├── infra/             → Layer 7: インフラストラクチャ
├── shared/            → 共有ユーティリティ
├── __tests__/         → テスト
└── index.ts           → エントリーポイント
```

### 主要な依存ライブラリ

| ライブラリ | 用途 |
|---|---|
| `commander` | CLI引数解析 |
| `chalk` | ターミナル出力の装飾 |
| `yaml` | YAML解析 |
| `zod` | スキーマバリデーション |
| `@anthropic-ai/claude-agent-sdk` | Claude Code連携 |
| `@openai/codex-sdk` | OpenAI Codex連携 |
| `@anthropic-ai/faceted-prompting` | ファセットプロンプティング |
| `wanakana` | 日本語テキスト変換 |

## データフローの全体像

ユーザーがtaktにタスクを指示してから結果が得られるまでの全体的なデータフローを示します。

```
ユーザー入力: "認証機能を実装して"
    │
    ▼
[Layer 1: CLI Input]
    │ コマンド解析・バリデーション
    ▼
[Layer 2: Interactive Processing]
    │ コードベース調査 → 計画立案 → ユーザー承認
    ▼
[Layer 3: Orchestration]
    │ Piece定義読み込み → 実行コンテキスト構築
    ▼
[Layer 4: Piece Execution]
    │ Movement 1: write-code (coder)
    │   ├── [Layer 5: Engine] → Phase 1 → Phase 2 → Phase 3
    │   ├── [Layer 6: Instruction Building] → プロンプト構築
    │   └── [Layer 7: Provider] → Claude Code実行
    │
    │ Movement 2: review (supervisor)
    │   ├── [Layer 5-7: 同上]
    │   └── ルール評価 → "問題あり" → Movement 1に戻る
    │              → "問題なし" → COMPLETE
    ▼
[Layer 3: Orchestration]
    │ レポート生成 → PR作成
    ▼
完了: PR + レポート
```

この一方向のデータフローにより、各層の責務が明確に分離され、デバッグやテストが容易になっています。また、各層がインターフェースで接続されているため、特定の層だけを差し替えることも可能です（例: Provider層のみを変更して別のAIを使う）。
