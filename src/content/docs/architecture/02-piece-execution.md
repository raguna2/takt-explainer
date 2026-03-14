---
title: Piece実行モデル
description: taktのPiece定義、3フェーズ実行、ルールベースルーティングの詳細
---

## Pieceの構造

Piece（ピース）は、taktにおけるワークフロー定義の中心的な概念です。YAML形式で記述され、以下の要素で構成されます。

```yaml
name: code-review
description: コードを書いてレビューするワークフロー
max_iterations: 10
initial_movement: write-code

personas:
  coder: ../personas/coder.md
  supervisor: ../personas/supervisor.md

movements:
  - name: write-code
    persona: coder
    edit: true
    instruction_template: |
      次のタスクを実行してください。
      {task}
    rules:
      - condition: 実装完了
        next: review
      - condition: 続行不能
        next: ABORT

  - name: review
    persona: supervisor
    edit: false
    instruction_template: |
      前のMovementで書かれたコードをレビューしてください。
      {previous_response}
    rules:
      - condition: 問題なし
        next: COMPLETE
      - condition: 改善が必要
        next: write-code
```

### Piece定義の各要素

| 要素 | 必須 | 説明 |
|---|---|---|
| `name` | はい | Pieceの識別名 |
| `description` | いいえ | Pieceの説明文 |
| `max_iterations` | いいえ | Piece全体のイテレーション上限（デフォルト: 10） |
| `initial_movement` | いいえ | 最初に実行するMovement（デフォルト: 最初のMovement） |
| `personas` | はい | 使用するペルソナの定義（名前→ファイルパスのマッピング） |
| `movements` | はい | Movementの定義リスト |

### `max_iterations` による安全弁

`max_iterations` は、Pieceの実行が無限ループに陥ることを防ぐための安全弁です。レビューで問題が検出されるたびにcoderに差し戻すフローでは、理論上は無限にループする可能性があります。`max_iterations` を設定することで、指定回数を超えた場合に実行が自動的に停止します。

## Movementの定義

Movement（ムーブメント）は、Piece内の個々のステップです。各Movementは以下の要素を持ちます。

```yaml
- name: write-code
  persona: coder
  edit: true
  instruction_template: |
    次のタスクを実行してください。
    {task}
  report_template: |
    実行した変更の概要を報告してください。
  rules:
    - condition: 実装完了
      next: review
    - condition: 続行不能
      next: ABORT
```

### Movement定義の各要素

| 要素 | 必須 | 説明 |
|---|---|---|
| `name` | はい | Movementの識別名 |
| `persona` | はい | このMovementで使用するペルソナ名 |
| `edit` | いいえ | ファイル編集権限（`true`/`false`、デフォルト: `false`） |
| `instruction_template` | はい | AIへの指示テンプレート |
| `report_template` | いいえ | Phase 2のレポート出力テンプレート |
| `rules` | はい | 遷移ルールのリスト |

### `edit` フラグの意味

`edit` フラグは、AIエージェントがファイルを変更できるかどうかを制御します。

- `edit: true`: コードの実装や修正を行うMovement。AIはファイルの作成・編集・削除が可能
- `edit: false`: レビューや検証を行うMovement。AIはファイルの読み取りのみ可能で、変更はできない

この区分は重要な設計判断です。レビューを行うMovementでは、レビュアーが勝手にコードを修正してしまうことを防ぎます。レビュアーは問題を**指摘**することのみが許され、修正はcoderペルソナに差し戻されます。人間のコードレビューと同じプロセスを構造的に強制しています。

## テンプレート変数

Movementの `instruction_template` と `report_template` では、以下のテンプレート変数が使用できます。

| 変数 | 説明 |
|---|---|
| `{task}` | 元のタスク内容（ユーザーが指定した指示） |
| `{previous_response}` | 前のMovementの出力結果 |
| `{iteration}` | Piece全体のイテレーション回数 |
| `{movement_iteration}` | 当該Movementの実行回数 |
| `{report_dir}` | レポート出力先ディレクトリ |

### テンプレート変数の活用例

```yaml
movements:
  - name: implement
    persona: coder
    edit: true
    instruction_template: |
      以下のタスクを実装してください。

      タスク: {task}

      これは{iteration}回目のイテレーションです。
      このMovementは{movement_iteration}回目の実行です。

  - name: review
    persona: supervisor
    edit: false
    instruction_template: |
      以下の実装結果をレビューしてください。

      元のタスク: {task}

      実装結果:
      {previous_response}
```

テンプレート変数の重要な役割は、**AIが文脈を忘れた場合のセーフティネット**です。AIのコンテキストウィンドウには制限があり、長い会話の中で初期の指示が失われることがあります。テンプレート変数を通じてPieceエンジンが明示的にコンテキストを注入することで、各Movementが必要な情報を常に利用可能になります。

## 3フェーズ実行モデル

taktのEngine層は、各Movementを3つのフェーズで実行します。これはtaktの品質保証メカニズムの中核です。

### Phase 1: Main Execution（メイン実行）

Phase 1は、AIエージェントがMovementのタスクを実際に実行するフェーズです。

- coderペルソナの場合: コードの実装
- reviewerペルソナの場合: コードのレビューとフィードバック
- supervisorペルソナの場合: 全体の検証と承認判断

このフェーズでは、`instruction_template` で定義された指示がAIに送信され、AIが自由に応答します。

### Phase 2: Report Output（レポート出力）

Phase 2は、Phase 1の実行結果に基づいてレポートを生成するオプショナルなフェーズです。`report_template` が定義されている場合にのみ実行されます。

レポートは `.takt/reports/` に保存され、タスクの監査証跡として機能します。

### Phase 3: Status Judgment（ステータス判定）

Phase 3は、Phase 1の出力を解析し、次の遷移先を決定するフェーズです。このフェーズがtaktの**確定的遷移**を実現する核心部分です。

```
Phase 1の出力
    │
    ▼
[ステータス判定プロンプト生成]
    │ rules定義から自動生成
    ▼
[AI によるステータス判定]
    │ condition に該当するものを選択
    ▼
[遷移先の決定]
    │ next に指定されたMovementへ
    ▼
次のMovement or COMPLETE or ABORT
```

### ステータス判定の仕組み

Piece定義の `rules` から、taktは自動的にステータス判定用のプロンプトを生成します。

例えば、以下のルール定義から:

```yaml
rules:
  - condition: 問題なし
    next: COMPLETE
  - condition: 改善が必要
    next: write-code
```

taktは以下のようなステータス判定プロンプトを自動生成します（簡略化した例）:

```
前のステップの出力を分析し、以下のいずれかのステータスを選択してください:
- 問題なし
- 改善が必要

ステータスタグで回答してください: <<STATUS:選択したステータス>>
```

AIの応答からステータスタグを解析し、対応する `next` の値に基づいて遷移を実行します。

## ルールベースルーティング

taktのルールベースルーティングは、5段階のフォールバックシステムを持っています。

### 5段階フォールバック

```
[Tier 1] 集約条件（all(), any()）
    │ 並列Movementの結果を集約
    ▼ マッチしない場合
[Tier 2] Phase 3タグ
    │ ステータス判定フェーズの出力タグを解析
    ▼ マッチしない場合
[Tier 3] Phase 1タグ
    │ メイン実行フェーズの出力タグを解析
    ▼ マッチしない場合
[Tier 4] AI判断
    │ AIに明示的に遷移先を判断させる
    ▼ マッチしない場合
[Tier 5] 包括的フォールバック
    │ デフォルト遷移先に進む
    ▼
遷移先決定
```

この多段階フォールバックにより、どのような状況でも遷移先が必ず決定されます。上位のTierでマッチすれば、より確定的な遷移が実現されます。下位のTierに行くほどAIの判断に依存しますが、最後のフォールバックがあるため、遷移が不定になることはありません。

### 特殊な遷移先

| 遷移先 | 意味 |
|---|---|
| `COMPLETE` | Pieceの正常完了 |
| `ABORT` | Pieceの異常終了 |
| Movement名 | 指定されたMovementに遷移 |

## 並列Movement

taktは複数のMovementを**並列に実行**する機能を持っています。これは、異なる観点からの同時レビューを実現するための機能です。

```yaml
- name: reviewers
  parallel:
    - name: arch-review
      persona: architecture-reviewer
      edit: false
      instruction_template: |
        アーキテクチャの観点からレビューしてください。
        {previous_response}

    - name: security-review
      persona: security-reviewer
      edit: false
      instruction_template: |
        セキュリティの観点からレビューしてください。
        {previous_response}

    - name: qa-review
      persona: qa-reviewer
      edit: false
      instruction_template: |
        品質とテストの観点からレビューしてください。
        {previous_response}
  rules:
    - condition: all("approved")
      next: COMPLETE
    - condition: any("needs_fix")
      next: implement
```

### 集約条件

並列Movementでは、複数のレビュアーの結果を集約するための特殊な条件式が使用できます。

| 条件 | 意味 |
|---|---|
| `all("approved")` | 全レビュアーが"approved"ステータスを返した場合 |
| `any("needs_fix")` | いずれかのレビュアーが"needs_fix"ステータスを返した場合 |

この集約条件は、5段階フォールバックの**Tier 1**で評価されます。並列レビューの結果を統合して次の遷移を決定する、taktの強力な機能です。

### 並列実行の利点

1. **時間短縮**: 3つのレビューを順次実行すると3倍の時間がかかるが、並列実行なら1回分の時間で完了
2. **独立した観点**: 各レビュアーは他のレビュアーの結果に影響されずに独自の評価を行う
3. **網羅的な検証**: アーキテクチャ、セキュリティ、品質のすべての観点が確実にカバーされる

## Piece実行のライフサイクル

Pieceの実行は以下のライフサイクルで進行します。

```
Piece開始
    │
    ▼
initial_movementの実行
    │
    ▼
┌──→ Movement実行
│       ├── Phase 1: メイン実行
│       ├── Phase 2: レポート出力（オプション）
│       └── Phase 3: ステータス判定
│           │
│           ├── next = "COMPLETE" → Piece正常完了
│           ├── next = "ABORT"    → Piece異常終了
│           └── next = Movement名 → そのMovementへ遷移
│                   │
│                   ├── iteration < max_iterations → 続行
└───────────────────┤
                    └── iteration >= max_iterations → 強制終了
```

### イテレーションカウンター

taktは2種類のイテレーションカウンターを管理します。

1. **Piece全体のイテレーション**: Piece開始からの総Movement実行回数。`max_iterations` で上限を設定
2. **Movement単位のイテレーション**: 特定のMovementが実行された回数。レビュー→修正のループ回数の把握に有用

これらのカウンターは、テンプレート変数 `{iteration}` と `{movement_iteration}` を通じてAIに伝達されます。AIは「これが3回目の修正です」という文脈を把握できるため、より効率的な対応が可能になります。

## ログとトレーサビリティ

taktは全ての実行を**NDJSON形式**（Newline Delimited JSON）でログに記録します。

```json
{"event":"piece:start","piece":"code-review","timestamp":"2026-03-14T10:00:00Z"}
{"event":"step:start","movement":"write-code","persona":"coder","timestamp":"2026-03-14T10:00:01Z"}
{"event":"step:complete","movement":"write-code","status":"実装完了","next":"review","timestamp":"2026-03-14T10:05:00Z"}
{"event":"step:start","movement":"review","persona":"supervisor","timestamp":"2026-03-14T10:05:01Z"}
{"event":"step:complete","movement":"review","status":"問題なし","next":"COMPLETE","timestamp":"2026-03-14T10:08:00Z"}
{"event":"piece:complete","piece":"code-review","result":"success","timestamp":"2026-03-14T10:08:01Z"}
```

ログは `.takt/logs/` ディレクトリに保存され、以下の用途に利用できます。

- **デバッグ**: ワークフローのどのステップで問題が発生したかを特定する
- **監査**: 誰が（どのペルソナが）、いつ、何をしたかの証跡を残す
- **最適化**: 各ステップの実行時間を分析し、ボトルネックを特定する
- **再現**: 同じ入力で同じフローが再現されることを検証する
