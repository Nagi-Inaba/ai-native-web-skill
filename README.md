日本語 | [English](README.en.md)

# ai-native-web-skill

AIエージェントが操作しやすいWebを、AIコーディングエージェントに最初から書かせるための Claude Code／Codex 用スキルです。

AIエージェントは、DOMの属性・見えている文字・現在値と、アクセシビリティツリーを読んで画面を理解し、操作します。支援技術を使う人も同じ情報を使います。このスキルは、HTML／CSS／React（Next.js・Vite）のコードを書く時点で、次の3つを正しく作らせます。

- **正しい要素**：押すものは `<button>`、移動は `<a href>`、送信は `<form>`。Tabで届き、Enter／Spaceで動く。
- **素直なアクセシビリティツリー**：領域・見出し・名前・役割がそのまま出る。
- **読める状態**：開閉・選択・エラー・処理中・件数を、CSSのクラスや見た目ではなく、DOMの属性と見える文字で出す。

> 状態: v0.1.0（開発中）。WCAG／JIS の適合判定や適合宣言はしません。

## できること

- **build**：8つの recipe（判断の型）と部品パターンに沿って、新しい画面を最初から正しく書く。
- **improve**：既存コードの問題を `ファイル:行` と recipe 付きで見つけて直し、同じチェックで確かめる。
- **static**：HTML／JSX／TSX／CSS の静的解析（eslint-plugin-jsx-a11y、@html-eslint、stylelint と独自ルール）。固定値のままの `aria-expanded` など、状態がDOMに出ない書き方も見つける。
- **check**：ローカル開発サーバを起動し、アクセシビリティツリー、Tabでの到達と名前、開閉UIの状態がDOMとツリーに出ているか、axe-core、320px 幅、`prefers-reduced-motion` を確かめる。

recipe は `shared/skill/references/recipes.json` にあります。スキル本体は英語で書かれていて、エージェントは利用者が使う言語（日本語で頼めば日本語）で応答します。

## 必要なもの

- Node.js 20.19 以上（開発・検証は 22.19 で実施）
- Google Chrome（`check` で使用。Playwright のブラウザはダウンロードしません。別のチャンネルは `ANW_BROWSER_CHANNEL` で指定）
- Windows／macOS／Linux（検証済みは Windows 11）

## インストール

このリポジトリのクリーンな取得元から、`claude/skills/ai-native-web/` または `codex/skills/ai-native-web/` の配布用コピーを使います。スキル本体は `shared/skill/` です。以下は新規導入の例です。フォルダ・zip配布はクリーンなcloneまたはGit archiveから作成します。ローカルの無視対象参考資料は公開スキルに含めません。

```text
# Claude Code（ユーザー共通）
mkdir -p ~/.claude/skills
cp -r claude/skills/ai-native-web ~/.claude/skills/

# Codex（ユーザー共通。公式の探索先は ~/.agents/skills）
mkdir -p ~/.agents/skills
cp -r codex/skills/ai-native-web ~/.agents/skills/

# どちらも、コピー先で依存をインストール
cd <コピー先>/ai-native-web && npm install
```

プロジェクト単位で使う場合は、Claude Code はプロジェクトの `.claude/skills/`、Codex はリポジトリの `.agents/skills/` に置いてください。Windows の PowerShell で新規導入する場合:

```powershell
# Claude Code; for Codex, change .claude to .agents and the source to codex
$skillParent = Join-Path $env:USERPROFILE '.claude/skills'
New-Item -ItemType Directory -Path $skillParent -Force | Out-Null
Copy-Item -LiteralPath './claude/skills/ai-native-web' -Destination $skillParent -Recurse
Set-Location (Join-Path $skillParent 'ai-native-web')
npm install
node scripts/cli.mjs doctor
```

## 使い方

エージェントに「ハンバーガーメニューを作って」「このモーダルをキーボードとAIで操作できるように直して」「フォームのエラー表示を作って」のように頼むと、スキルが書き方と確認の手順を案内します。CLI は導入したスキルのディレクトリ（`SKILL.md` のある場所）で実行し、対象プロジェクトのパスを引数に渡します。初回は `node scripts/cli.mjs doctor` で環境を確認します。コマンド:

```text
node scripts/cli.mjs static <project-dir> [--json]
node scripts/cli.mjs check --dev <project-dir> --toggle "#menu-button"
node scripts/cli.mjs check --url http://localhost:3000/
```

終了コードは 0＝指摘なし、1＝指摘あり、2＝使い方または実行時エラーです。詳しくは `shared/skill/references/workflow.md` を参照してください。

## 安全上の注意

- `check --dev` は対象プロジェクトの開発サーバ（既定は `npm run dev`）を実行します。信頼できるプロジェクトにだけ使ってください。
- ブラウザが開くのは loopback（localhost／127.0.0.1／[::1]）の URL だけで、ページから loopback 以外への通常のリクエストは、非ストリーミング要求のリダイレクト先も含めて遮断します。`Accept` に `text/event-stream` を含むloopback要求はそのまま通し、そのリダイレクト先は手動検査・遮断記録の対象外です。WebSocket、Service Worker、開発サーバ自体の通信も対象外です。
- 詳細は [SECURITY.md](SECURITY.md) を参照してください。

## 限界

アクセシビリティツリーと自動チェックでは、実機スクリーンリーダーでの読み上げ、文言の適切さ、色だけで意味を伝えていないか、画像内の文字は判定できません。スキルはこれらを `TODO(a11y)` と「残りの確認事項」として報告します。

## 開発

貢献の手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

```text
npm install
npm test
npm run sync   # shared/skill を claude/ と codex/ の配布コピーへ反映
```

Codex のアプリ画面用の表示名・説明・既定の依頼文は `platform/codex/agents/openai.yaml` にあり、`npm run sync` で Codex 版にだけ `agents/openai.yaml` として同梱されます。

Vite／Next.js の E2E は任意実行です。`tests/fixtures/e2e-*` で `npm install` したあと、POSIX シェルでは `ANW_E2E=1 node --test tests/e2e.test.mjs` を実行します。

PowerShell:

```powershell
$previousAnwE2e = $env:ANW_E2E
$env:ANW_E2E = '1'
try { node --test tests/e2e.test.mjs } finally { $env:ANW_E2E = $previousAnwE2e }
```

## ライセンス

MIT（[LICENSE](LICENSE)）。依存パッケージと参照している W3C 文書の情報は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) にあります。
