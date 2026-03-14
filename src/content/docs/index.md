---
title: taktとは
description: AIエージェントオーケストレーションツール takt の包括的解説サイト
---

## takt — AIエージェントを指揮する、ワークフローオーケストレーター

taktは、AIコーディングエージェントをYAML定義のパイプラインで統率するオーケストレーションツールです。「AIに判断を委ねるのではなく、仕組みとして行動を強制する」という設計思想のもと、複数のAIエージェントを確定的なワークフローで協調動作させます。

### なぜtaktが必要なのか

AIコーディングエージェント（Claude Code、OpenAI Codex等）は、単体では非常に強力です。しかし、実際のソフトウェア開発では次のような課題が浮上します。

- **品質の不安定さ**: AIが生成するコードの品質にばらつきがある
- **レビュープロセスの欠如**: 生成されたコードが十分にレビューされないまま採用される
- **並行作業の管理困難**: 複数のAIエージェントを同時に動かすと、人間がボトルネックになる
- **再現性の欠如**: 同じ指示でも異なる結果が得られることがある

taktはこれらの課題を、**音楽の演奏**に着想を得た独自のアーキテクチャで解決します。

### 音楽メタファによる直感的な設計

taktの名前はドイツ語で「拍子」「指揮棒の振り」を意味します。オーケストラの指揮者が楽譜（スコア）に従って演奏者を統率するように、taktは**Piece（楽曲）**と呼ばれるYAMLファイルに従ってAIエージェントを統率します。

| 音楽用語 | taktの概念 | 役割 |
|---|---|---|
| Piece（楽曲） | ワークフロー定義 | タスク全体の流れを記述するYAMLファイル |
| Movement（楽章） | 実行ステップ | Piece内の個別の処理単位 |
| Persona（演奏者） | AIエージェントの役割 | 各Movementで使用するAIの専門性定義 |

### 主な特徴

#### YAML駆動のワークフロー定義

```yaml
name: code-review
movements:
  - name: implement
    persona: coder
    edit: true
    instruction_template: |
      次のタスクを実装してください。
      {task}
    rules:
      - condition: 実装完了
        next: review
  - name: review
    persona: supervisor
    edit: false
    rules:
      - condition: 問題なし
        next: COMPLETE
      - condition: 改善が必要
        next: implement
```

#### マルチエージェント協調

25を超える組み込みペルソナ（coder、supervisor、architecture-reviewer、security-reviewer等）を使い分け、計画・実装・レビュー・修正のサイクルを自動化します。

#### マルチプロバイダー対応

Claude Code、OpenAI Codex、OpenCode、Cursor、Copilotなど主要なAIコーディングエージェントに対応。Movement単位でプロバイダーやモデルを切り替えることも可能です。

#### ファセットプロンプティング

プロンプトを5つの独立した関心事（Persona、Policy、Instruction、Knowledge、Output Contract）に分離し、保守性と再利用性を高めます。

#### 確定的な状態遷移

AIの判断ではなく、ルールベースの条件分岐によってワークフローの遷移を制御します。これにより、毎回同じ品質基準でのレビューサイクルが保証されます。

### taktの実績

- **GitHub**: [nrslib/takt](https://github.com/nrslib/takt)
- **ライセンス**: MIT
- **スター数**: 760以上
- **最新バージョン**: v0.32.1
- **Self-dogfooding**: takt自身がtaktを使って開発されている

### このサイトの構成

このサイトでは、taktを以下の観点から詳しく解説します。

1. **[背景と思想](/takt-explainer/background/01-why-takt-exists/)** — なぜtaktが生まれたのか、その設計哲学
2. **[アーキテクチャ](/takt-explainer/architecture/01-overview/)** — 内部構造の詳細な解説
3. **[利用方法](/takt-explainer/usage/01-getting-started/)** — インストールから実践的な使い方まで

taktを使いこなすことで、AIエージェントとの協業を「場当たり的な対話」から「体系的なワークフロー」へと進化させることができます。
