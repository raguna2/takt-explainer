---
title: カスタマイズ
description: カスタムPiece・Persona・ルールの作成方法とベストプラクティス
---

## カスタマイズの概要

taktの組み込みPieceとペルソナは多くのユースケースをカバーしますが、プロジェクト固有のワークフローが必要な場合は、独自のPiece、ペルソナ、ポリシー、ナレッジを作成できます。

### カスタマイズの3つのレベル

```
[Level 1: 設定の調整]
  │ config.yaml でモデル、Piece、言語を変更
  │ 最も簡単。コードの記述不要
  ▼
[Level 2: ペルソナのカスタマイズ]
  │ ビルトインペルソナをエジェクトして編集
  │ またはカスタムペルソナをMarkdownで作成
  ▼
[Level 3: カスタムPieceの作成]
  │ 独自のワークフローをYAMLで定義
  │ 最も柔軟。完全にカスタムなフローを構築
```

## Level 1: 設定の調整

最も簡単なカスタマイズは、設定ファイルを通じた調整です。

### プロジェクト設定の変更

```yaml
# .takt/config.yaml
piece: backend-mini         # default → backend-mini に変更
provider: claude
model: opus                # sonnet → opus に変更
language: ja
```

### Piece単位の設定

```yaml
# .takt/config.yaml
piece: default
piece_config:
  max_iterations: 5        # デフォルトの10を5に制限
```

## Level 2: ペルソナのカスタマイズ

### 方法1: ビルトインペルソナのエジェクト

既存のビルトインペルソナをベースにカスタマイズする場合は、`/eject` コマンドでプロジェクトにコピーします。

```bash
# インタラクティブモード内で
/eject coder
```

コピーされた `.takt/personas/coder.md` を編集します。

```markdown
# Persona: coder (カスタム版)

あなたはTypeScript/Reactの実装を専門とするエンジニアです。

## プロジェクト固有のルール
- 状態管理にはZustandを使用する
- UIコンポーネントはRadix UIベースで作成する
- スタイリングはTailwind CSSを使用する
- データフェッチにはTanStack Queryを使用する

## コードスタイル
- 関数コンポーネントのみ使用（classコンポーネント禁止）
- カスタムフックは`use`プレフィックスで命名
- エクスポートは名前付きエクスポートを使用
```

### 方法2: 新規ペルソナの作成

完全に新しいペルソナを作成する場合は、Markdownファイルを作成するだけです。

```markdown
# .takt/personas/api-designer.md

あなたはREST API設計の専門家です。

## 専門分野
- RESTful API設計（OpenAPI/Swagger準拠）
- レスポンスフォーマットの標準化
- エラーハンドリングパターン
- APIバージョニング戦略
- レート制限とページネーション

## レビュー観点
- エンドポイント命名がREST原則に従っているか
- HTTPメソッドの適切な使用（GET/POST/PUT/PATCH/DELETE）
- ステータスコードの適切な使用
- リクエスト/レスポンスボディのスキーマ設計
- 認証・認可の設計
- ドキュメンテーション（OpenAPI spec）

## 出力形式
レビュー結果は以下の形式で報告してください:
1. 準拠事項（良い点）
2. 違反事項（問題点と修正案）
3. 推奨事項（さらなる改善案）
4. 総合評価（approved / needs_fix）
```

### ペルソナの配置場所

| 場所 | スコープ |
|---|---|
| `~/.takt/personas/` | 全プロジェクトで利用可能 |
| `.takt/personas/` | 当該プロジェクトのみ |

プロジェクト固有のペルソナは `.takt/personas/` に、汎用的なペルソナは `~/.takt/personas/` に配置するのが推奨されます。

## Level 3: カスタムPieceの作成

### 基本構造

カスタムPieceはYAMLファイルとして `.takt/pieces/` に作成します。

```yaml
# .takt/pieces/api-development.yaml
name: api-development
description: REST API開発ワークフロー
max_iterations: 8
initial_movement: design

personas:
  designer: ../personas/api-designer.md
  coder: ../personas/coder.md
  security: ../personas/security-reviewer.md
  qa: ../personas/qa-reviewer.md
  supervisor: ../personas/supervisor.md

movements:
  - name: design
    persona: designer
    edit: false
    instruction_template: |
      以下のタスクに対するREST API設計を行ってください。

      タスク: {task}

      以下を含めてください:
      - エンドポイント一覧
      - リクエスト/レスポンスのスキーマ
      - エラーハンドリング方針
      - 認証要件
    rules:
      - condition: 設計完了
        next: implement
      - condition: 情報不足
        next: ABORT

  - name: implement
    persona: coder
    edit: true
    instruction_template: |
      以下のAPI設計に基づいて実装してください。

      元のタスク: {task}
      API設計: {previous_response}

      テストも含めて実装してください。
    rules:
      - condition: 実装完了
        next: review
      - condition: 設計に問題あり
        next: design

  - name: review
    parallel:
      - name: security-check
        persona: security
        edit: false
        instruction_template: |
          以下のAPI実装をセキュリティ観点でレビューしてください。
          {previous_response}

      - name: quality-check
        persona: qa
        edit: false
        instruction_template: |
          以下のAPI実装をテスト品質の観点でレビューしてください。
          {previous_response}
    rules:
      - condition: all("approved")
        next: finalize
      - condition: any("needs_fix")
        next: implement

  - name: finalize
    persona: supervisor
    edit: false
    instruction_template: |
      すべてのレビューが通過しました。最終確認を行ってください。

      元のタスク: {task}
      実装結果: {previous_response}
    rules:
      - condition: 承認
        next: COMPLETE
      - condition: 差し戻し
        next: implement
```

### カスタムPieceの使用

```yaml
# .takt/config.yaml
piece: api-development       # カスタムPieceを指定
```

または、コマンドラインで直接指定:

```bash
takt --piece api-development "ユーザーCRUDのAPIを実装して"
```

## ルール設計のパターン

### パターン1: 線形フロー

最も単純なパターン。各ステップが順に実行されます。

```yaml
movements:
  - name: step-1
    rules:
      - condition: 完了
        next: step-2
  - name: step-2
    rules:
      - condition: 完了
        next: step-3
  - name: step-3
    rules:
      - condition: 完了
        next: COMPLETE
```

### パターン2: レビューループ

実装→レビュー→修正のループパターン。最も一般的です。

```yaml
movements:
  - name: implement
    rules:
      - condition: 実装完了
        next: review
  - name: review
    rules:
      - condition: 問題なし
        next: COMPLETE
      - condition: 改善が必要
        next: implement     # ← 差し戻し
```

### パターン3: 並列レビュー

複数のレビュアーが同時にレビューし、結果を集約するパターン。

```yaml
movements:
  - name: implement
    rules:
      - condition: 実装完了
        next: parallel-review

  - name: parallel-review
    parallel:
      - name: arch-review
        persona: architecture-reviewer
      - name: sec-review
        persona: security-reviewer
    rules:
      - condition: all("approved")
        next: COMPLETE
      - condition: any("needs_fix")
        next: implement
```

### パターン4: 段階的承認

複数の承認ステージを持つパターン。重要な変更に適しています。

```yaml
movements:
  - name: implement
    rules:
      - condition: 実装完了
        next: tech-review
  - name: tech-review
    persona: architecture-reviewer
    rules:
      - condition: 承認
        next: security-review
      - condition: 差し戻し
        next: implement
  - name: security-review
    persona: security-reviewer
    rules:
      - condition: 承認
        next: final-review
      - condition: 差し戻し
        next: implement
  - name: final-review
    persona: supervisor
    rules:
      - condition: 承認
        next: COMPLETE
      - condition: 差し戻し
        next: implement
```

### パターン5: 条件分岐

タスクの内容に応じて異なるフローに分岐するパターン。

```yaml
movements:
  - name: analyze
    persona: planner
    rules:
      - condition: フロントエンドの変更
        next: frontend-impl
      - condition: バックエンドの変更
        next: backend-impl
      - condition: 両方の変更
        next: fullstack-impl
  - name: frontend-impl
    persona: frontend-coder
    rules:
      - condition: 完了
        next: frontend-review
  - name: backend-impl
    persona: backend-coder
    rules:
      - condition: 完了
        next: backend-review
  # ... 以下省略
```

## ポリシーとナレッジの作成

### カスタムポリシー

プロジェクトのコーディング規約をポリシーとして定義できます。

```markdown
# .takt/policies/coding-standards.md

## TypeScript規約
- strictModeを有効化
- any型の使用を禁止
- unknown型またはzodでバリデーション
- 戻り値の型を明示的に宣言

## テスト規約
- テストファイルは `*.test.ts` の命名
- describe/it パターンを使用
- テストカバレッジ80%以上
- E2Eテストは `*.e2e.ts`

## Git規約
- コミットメッセージはConventional Commitsに従う
- ブランチ名は `feature/`, `fix/`, `chore/` プレフィックス
```

### カスタムナレッジ

プロジェクトの設計知識をナレッジとして整備できます。

```markdown
# .takt/knowledge/architecture.md

## システムアーキテクチャ
本プロジェクトはクリーンアーキテクチャを採用しています。

## レイヤー構成
- domain/: ドメインモデルとビジネスルール
- application/: ユースケース（アプリケーションサービス）
- infrastructure/: 外部サービスとの連携
- presentation/: UIとAPI

## 依存関係ルール
- domain → 依存なし
- application → domain
- infrastructure → application, domain
- presentation → application

## データベース
- PostgreSQL 16
- ORMはPrismaを使用
- マイグレーションはprisma migrateで管理
```

### 設定ファイルでの参照

```yaml
# .takt/config.yaml
policies:
  - .takt/policies/coding-standards.md
  - .takt/policies/security-policy.md

knowledge:
  - .takt/knowledge/architecture.md
  - .takt/knowledge/api-specs.md
```

## テンプレート変数の活用

### 標準変数

```yaml
instruction_template: |
  タスク: {task}
  前回の出力: {previous_response}
  イテレーション: {iteration}回目
  Movement実行回数: {movement_iteration}回目
  レポートディレクトリ: {report_dir}
```

### テンプレートの設計指針

1. **必要最小限の情報を渡す**: AIのコンテキストウィンドウは有限。不要な情報で圧迫しない
2. **構造化して渡す**: 自由テキストよりも、セクション分けされた情報の方がAIが正確に理解する
3. **`{previous_response}` の活用**: Movement間の情報伝達には必ずこの変数を使い、AIの記憶に依存しない
4. **イテレーション情報の活用**: `{iteration}` と `{movement_iteration}` を含めることで、AIが「何回目の修正か」を理解できる

## ベストプラクティス

### 1. 小さく始める

最初から複雑なPieceを作るのではなく、簡単なフローから始めて段階的に拡張しましょう。

```yaml
# まずは最小限のPiece
movements:
  - name: implement
    persona: coder
    edit: true
    rules:
      - condition: 完了
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

このシンプルなPieceで運用を開始し、必要に応じてレビュアーの追加、並列レビュー、専門ペルソナの導入を行います。

### 2. max_iterationsを必ず設定する

ルール定義の不備で無限ループが発生する可能性を防ぐため、`max_iterations` を必ず設定しましょう。

```yaml
max_iterations: 10   # 安全弁
```

### 3. ABORTルールを含める

予期しない状況に対応するため、ABORT条件を含めましょう。

```yaml
rules:
  - condition: 実装完了
    next: review
  - condition: 続行不能       # ← 安全弁
    next: ABORT
```

### 4. editフラグを意識する

レビューを行うMovementでは必ず `edit: false` を設定し、レビュアーがコードを直接変更しないようにしましょう。

```yaml
- name: review
  persona: supervisor
  edit: false          # ← レビュアーは変更不可
```

### 5. ペルソナの責務を限定する

1つのペルソナに複数の責務を持たせないようにしましょう。「コードを書いてレビューもして」ではなく、「コードを書く」と「レビューする」は別のペルソナに分けます。

### 6. ポリシーとナレッジを整備する

PieceとPersonaだけでなく、PolicyとKnowledgeも整備することで、AIの出力品質が大幅に向上します。特に以下は早期に整備することを推奨します。

- **コーディング規約**: チームの共通ルール
- **アーキテクチャ知識**: システムの設計方針と制約
- **ドメイン知識**: ビジネスロジックの前提知識

### 7. バージョン管理する

`.takt/` ディレクトリ内のファイル（config.yaml、カスタムPiece、カスタムペルソナ、ポリシー、ナレッジ）はすべてGitでバージョン管理しましょう。ワークフローの変更履歴を追跡し、チーム内で共有できます。

```gitignore
# .gitignore
# taktの実行成果物は除外
.takt/logs/
.takt/reports/
.takt/tasks/
.takt/completed/

# taktの設定・定義はバージョン管理
# .takt/config.yaml       ← 含める
# .takt/pieces/            ← 含める
# .takt/personas/          ← 含める
# .takt/policies/          ← 含める
# .takt/knowledge/         ← 含める
```

## まとめ: カスタマイズの段階的アプローチ

| フェーズ | やること | 期待効果 |
|---|---|---|
| **導入期** | 組み込みPiece（default）をそのまま使用。config.yamlでモデルのみ調整 | taktのワークフローに慣れる |
| **適応期** | ペルソナをエジェクトしてプロジェクト固有にカスタマイズ。Policy/Knowledgeを整備 | 出力品質の向上 |
| **最適化期** | カスタムPieceを作成。プロジェクト固有のワークフローを定義 | ワークフローの最適化 |
| **成熟期** | チーム全体でPiece/ペルソナを共有。CI/CD統合。複数プロジェクト展開 | 組織レベルでの標準化 |
