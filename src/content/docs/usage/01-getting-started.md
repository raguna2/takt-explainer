---
title: はじめかた
description: taktのインストールから実行までの手順と、3つの実行モードの解説
---

## インストール

taktはnpmパッケージとして公開されています。Node.js 18以上がインストールされた環境で、以下のコマンドでインストールできます。

```bash
npm install -g takt
```

### 前提条件

taktを利用するには、以下のいずれかのAIコーディングエージェントが設定済みである必要があります。

| プロバイダー | 必要な設定 |
|---|---|
| **Claude Code**（推奨） | Claude Code CLIがインストール済みで、認証設定が完了していること |
| **OpenAI Codex** | Codex CLIがインストール済みであること |
| **OpenCode** | OpenCode CLIがインストール済みであること |
| **Cursor** | Cursor IDEがインストール済みであること |
| **API直接呼び出し** | `TAKT_ANTHROPIC_API_KEY` または `TAKT_OPENAI_API_KEY` 環境変数を設定 |

### インストール確認

```bash
takt --version
# v0.32.1
```

### 初期設定

プロジェクトでtaktを使用する前に、初期設定を行うことを推奨します。

```bash
# プロジェクトルートで実行
takt init
```

`takt init` は以下を行います。

1. `.takt/` ディレクトリの作成
2. `.takt/config.yaml` の生成（デフォルト設定）
3. `.takt/tasks/` ディレクトリの作成（タスクキュー用）

### グローバル設定

ユーザー全体に適用する設定は `~/.takt/config.yaml` に記述します。

```yaml
# ~/.takt/config.yaml
language: ja               # 表示言語（ja / en）
default_piece: default      # デフォルトで使用するPiece
provider: claude            # デフォルトプロバイダー
model: sonnet              # デフォルトモデル
```

### プロジェクト設定

プロジェクト固有の設定は、プロジェクトルートの `.takt/config.yaml` に記述します。

```yaml
# .takt/config.yaml
piece: simple-review        # このプロジェクトで使用するPiece
provider: claude
model: opus                # プロジェクトではopusを使用

# プロジェクト固有のポリシー
policies:
  - .takt/policies/coding-standards.md

# プロジェクト固有のナレッジ
knowledge:
  - .takt/knowledge/architecture.md
```

## 3つの実行モード

taktには3つの主要な実行モードがあります。それぞれのモードは異なるユースケースに対応しています。

### 1. インタラクティブモード

対話的にタスクを進めるモードです。日常的な開発作業で最も多く使用されます。

```bash
# 対話モードを起動
takt

# 初期メッセージ付きで起動
takt "認証機能を実装したい"

# GitHub Issue指定で起動
takt #99
```

#### インタラクティブモードのフロー

```
takt "認証機能を実装したい"
    │
    ▼
[コードベースの調査]
    │ AIがプロジェクト構造を把握
    │ Read, Glob, Grep, Bashツールを使用
    ▼
[要件の確認]
    │ AIが質問して要件を明確化
    │ 「認証方式はJWTでよいですか？」
    │ 「セッション管理はどうしますか？」
    ▼
[計画の提示]
    │ AIが実装計画を提示
    │ 「以下の手順で実装します: 1. ユーザーモデル作成 2. ...」
    ▼
[ユーザーの承認]
    │ /go  → 実行開始
    │ /cancel → 中止
    ▼
[Pieceの実行]
    │ worktree作成 → 隔離環境で実行
    │ Piece定義に従ってMovementを順次実行
    ▼
[結果]
    │ 自動PR作成
    │ レポート生成
    ▼
完了
```

#### インタラクティブモードのコマンド

| コマンド | 説明 |
|---|---|
| `/go` | 計画を承認し、Piece実行を開始 |
| `/cancel` | 現在のタスクを中止 |
| `/plan` | 現在の計画を表示 |
| `/status` | 実行状態を表示 |
| `/eject` | ビルトインペルソナをプロジェクトにコピー（カスタマイズ用） |

#### GitHub Issue連携

`takt #99` のようにIssue番号を指定すると、taktは自動的にGitHub APIからIssueの内容を取得し、タスクとして利用します。Issue本文に記載された要件、ラベル、コメントがすべてAIのコンテキストに含まれます。

### 2. パイプラインモード

非対話型で実行するモードです。CI/CD連携やスクリプト実行に適しています。

```bash
# タスク指定でパイプライン実行
takt --pipeline --task "バグを修正して"

# 自動PR作成オプション付き
takt --pipeline --task "バグを修正して" --auto-pr

# GitHub Issue指定
takt --pipeline --issue 99 --auto-pr
```

#### パイプラインモードの特徴

- **非対話型**: ユーザーへの質問や確認は行わず、自律的にPieceを実行する
- **CI/CD統合**: GitHub Actionsなどのワークフローに組み込み可能
- **自動PR**: `--auto-pr` オプションで、完了時に自動的にプルリクエストを作成

#### GitHub Actionsとの統合

```yaml
# .github/workflows/takt.yml
name: takt AI Task
on:
  issue_comment:
    types: [created]

jobs:
  takt:
    if: contains(github.event.comment.body, '@takt')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g takt
      - run: |
          takt --pipeline \
            --issue ${{ github.event.issue.number }} \
            --auto-pr
        env:
          TAKT_ANTHROPIC_API_KEY: ${{ secrets.TAKT_ANTHROPIC_API_KEY }}
```

この設定により、GitHubのIssueコメントに `@takt` と書くだけで、taktが自動的にタスクを実行し、PRを作成します。

### 3. バッチ実行モード

複数のタスクをキューに登録し、順次実行するモードです。複数のタスクを一度に処理したい場合に使用します。

```bash
# タスクの追加
takt add                           # 対話的にタスク追加
takt add "ログイン機能を実装"       # テキストでタスク追加
takt add #28                       # Issue番号でタスク追加

# タスクの実行
takt run                           # キュー内のタスクを順次実行

# 監視モード
takt watch                         # ディレクトリ監視・常駐実行

# セッションリセット
takt clear                         # 現在のセッションをクリア
```

#### タスクキュー

タスクは `.takt/tasks/` ディレクトリにファイルとして保存されます。`takt add` で追加されたタスクは、順次実行を待つキューとして管理されます。

```
.takt/
├── tasks/           ← 実行待ちのタスク
│   ├── 001-login.yaml
│   ├── 002-auth.yaml
│   └── 003-dashboard.yaml
├── completed/       ← 完了したタスク（自動移動）
│   └── 001-login.yaml
└── logs/            ← 実行ログ
```

#### 監視モード（watch）

`takt watch` は、`.takt/tasks/` ディレクトリを監視し、新しいタスクが追加されると自動的に実行を開始します。バックグラウンドプロセスとして常駐し、開発者は他の作業をしながらtaktにタスクを投入できます。

```bash
# ターミナル1: taktを常駐起動
takt watch

# ターミナル2: タスクを追加（実行中でも追加可能）
takt add "認証機能を実装"
takt add #42
takt add "テストカバレッジを改善"
```

監視モードの利点は、**実行中でも新しいタスクを追加できる**ことです。taktが1つ目のタスクを実行している間に、2つ目、3つ目のタスクを投入できます。完了したタスクは自動的に `.takt/completed/` に移動します。

## ディレクトリ構成

taktを使用するプロジェクトの典型的なディレクトリ構成を示します。

```
プロジェクトルート/
├── .takt/
│   ├── config.yaml          # プロジェクト設定
│   ├── pieces/              # カスタムPiece定義
│   │   └── my-piece.yaml
│   ├── personas/            # カスタムペルソナ
│   │   └── my-persona.md
│   ├── policies/            # ポリシー定義
│   │   └── coding-standards.md
│   ├── knowledge/           # ナレッジ定義
│   │   └── architecture.md
│   ├── tasks/               # タスクキュー
│   ├── completed/           # 完了タスク
│   ├── logs/                # 実行ログ（NDJSON）
│   └── reports/             # 自動生成レポート（Markdown）
├── src/                     # プロジェクトのソースコード
└── ...
```

### ユーザーグローバルディレクトリ

```
~/.takt/
├── config.yaml              # グローバル設定
├── personas/                # グローバルカスタムペルソナ
└── pieces/                  # グローバルカスタムPiece
```

グローバルディレクトリに配置したペルソナやPieceは、すべてのプロジェクトで利用可能になります。

## 実行の流れ: 具体例

「ユーザー認証機能を実装する」というタスクをtaktで実行する場合の具体的な流れを示します。

### Step 1: タスクの指示

```bash
takt "JWTベースのユーザー認証機能を実装して"
```

### Step 2: コードベース調査と計画

taktのAIエージェントがプロジェクトを調査します。

```
[AI] プロジェクト構造を確認しています...
[AI] src/models/ にUser modelが見つかりました
[AI] src/middleware/ に既存のミドルウェアがあります
[AI] テストフレームワーク: Vitest

[AI] 以下の計画で実装します:
  1. src/services/auth.ts - 認証サービスの作成
  2. src/middleware/auth.ts - 認証ミドルウェアの作成
  3. src/routes/auth.ts - 認証APIルートの作成
  4. src/__tests__/auth.test.ts - テストの作成

/go で実行を開始、/cancel で中止
```

### Step 3: Piece実行

`/go` を入力すると、Piece定義に基づいた実行が開始されます。

```
[takt] worktreeを作成中...
[takt] ブランチ: feature/jwt-auth を作成

🎵 Movement 1/4: plan (planner)
   → タスクの分析と実装計画の策定
   ✓ 完了

🎵 Movement 2/4: implement (coder)
   → コードの実装
   ✓ 4ファイルを作成/変更

🎵 Movement 3/4: review (supervisor)
   → コードレビュー
   ⚠ 改善が必要: "入力バリデーションが不足しています"
   → implement に差し戻し

🎵 Movement 2/4: implement (coder) [2回目]
   → 指摘された問題の修正
   ✓ バリデーション追加

🎵 Movement 3/4: review (supervisor) [2回目]
   → 再レビュー
   ✓ 問題なし

🎵 Movement 4/4: finalize (supervisor)
   → 最終確認
   ✓ 承認

🎶 Piece完了!
   PR #42 を作成しました: https://github.com/...
   レポート: .takt/reports/2026-03-14-jwt-auth.md
```

### Step 4: レポートの確認

自動生成されたレポートが `.takt/reports/` に保存されます。

```markdown
# タスクレポート: JWTベースのユーザー認証機能

## 概要
- タスク: JWTベースのユーザー認証機能を実装
- Piece: default
- イテレーション: 5 (うち差し戻し1回)
- 所要時間: 12分

## 変更ファイル
- src/services/auth.ts (新規作成)
- src/middleware/auth.ts (新規作成)
- src/routes/auth.ts (新規作成)
- src/__tests__/auth.test.ts (新規作成)

## レビュー指摘
1. 入力バリデーション不足 → 修正済み

## 最終評価
全てのレビュー項目を通過。PR #42を作成。
```

## セッション管理

taktは**セッション**の概念を持ち、タスクの中断と再開をサポートします。

### セッションの継続

taktの実行中にプロセスが中断された場合（ネットワークエラー、手動中止など）、次回taktを起動すると前回のセッションを継続するかどうかを確認します。

```bash
takt
# [takt] 前回のセッションが見つかりました。続行しますか？ (y/n)
```

### セッションのリセット

前回のセッションを破棄して新しく始めたい場合は、`takt clear` でリセットします。

```bash
takt clear
# [takt] セッションをリセットしました
```

## トラブルシューティング

### よくある問題と対処法

| 問題 | 原因 | 対処法 |
|---|---|---|
| `takt: command not found` | npmグローバルインストールのパスが通っていない | `npm config get prefix` でパスを確認し、`PATH` に追加 |
| `No provider configured` | AIプロバイダーが設定されていない | Claude Code等をインストールするか、API Keyを設定 |
| `Piece not found` | 指定されたPieceが存在しない | `takt config` で利用可能なPieceを確認 |
| 無限ループ | ルール定義の不備 | `max_iterations` を設定し、ルール条件を見直す |
| 差し戻しが繰り返される | レビュー基準が厳しすぎる | ペルソナ定義を調整するか、`max_iterations` を制限 |
