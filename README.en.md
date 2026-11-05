[日本語](README.md) | English

# ai-native-web-skill

A Claude Code / Codex skill that makes AI coding agents build web UI that AI agents can operate, from the first line.

AI agents understand and operate a page by reading DOM attributes, visible text, current values and the accessibility tree. People using assistive technology rely on the same information. Left to itself, though, an AI coding agent tends to produce `div`s that only look like buttons and UI whose state lives only in CSS classes — invisible as something pressable, and unreadable as state, to the agents and assistive technology that have to operate it. While writing HTML, CSS and React (Next.js, Vite), this skill makes the agent get three things right:

- **The right elements**: a `<button>` for actions, `<a href>` for navigation, `<form>` for submission — reachable with Tab; buttons work with Enter/Space and links with Enter.
- **A clean accessibility tree**: regions, headings, names and roles come through as they are.
- **Readable state**: open/closed, selected, errors, busy and result counts are exposed as DOM attributes and visible text, not only as CSS classes or visuals.

Component patterns cover disclosure menus, modal dialogs, tabs, forms (error display and native controls), tables and images, asynchronous status, and focus on route changes.

> Status: v0.1.0 (in development).

## What it does

- **build**: write new UI correctly from the start, following eight recipes and component patterns.
- **improve**: find issues in existing code with `file:line` and a recipe, fix them, and re-run the same checks.
- **static**: static analysis of HTML / JSX / TSX / CSS (eslint-plugin-jsx-a11y, @html-eslint, stylelint and custom rules), including state that never reaches the DOM, such as a fixed `aria-expanded` literal.
- **check**: start a local dev server and inspect the accessibility tree, Tab reachability and names, whether open/close state reaches the DOM and the tree, axe-core, 320px reflow and `prefers-reduced-motion`.

The recipes live in [shared/skill/references/recipes.json](shared/skill/references/recipes.json). The skill itself is written in English; the agent answers in the language the user writes in.

Example (a disclosure menu):

```jsx
// Before: a div that only looks like a button — not focusable, no role, no state in the DOM
<div className="btn open" onClick={toggle}>Menu</div>

// After: with this skill — keyboard-operable, state exposed in attributes and the tree
<button type="button" aria-expanded={isOpen} aria-controls="nav-menu" onClick={toggle}>Menu</button>
```

## Requirements

- Node.js 20.19 or later (developed and tested on 22.19)
- Google Chrome for `check` (uses the Chrome installed on the system; set `ANW_BROWSER_CHANNEL` to use another channel)
- Windows / macOS / Linux (tested on Windows 11)

## Installation

Clone this repository and copy the folder for your agent — `claude/skills/ai-native-web/` for Claude Code or `codex/skills/ai-native-web/` for Codex — into your skills directory. The examples below assume a new installation.

```text
git clone https://github.com/Nagi-Inaba/ai-native-web-skill.git
cd ai-native-web-skill

# Claude Code (user-wide)
mkdir -p ~/.claude/skills
cp -r claude/skills/ai-native-web ~/.claude/skills/

# Codex (user-wide; the documented discovery path is ~/.agents/skills)
mkdir -p ~/.agents/skills
cp -r codex/skills/ai-native-web ~/.agents/skills/

# Install dependencies and verify the setup (Claude Code path; for Codex use ~/.agents/skills/ai-native-web)
cd ~/.claude/skills/ai-native-web && npm install && node scripts/cli.mjs doctor
```

For a single project, use the project's `.claude/skills/` for Claude Code and the repository's `.agents/skills/` for Codex. For a new installation in Windows PowerShell:

```powershell
# Claude Code; for Codex, change .claude to .agents and the source to codex
$skillParent = Join-Path $env:USERPROFILE '.claude/skills'
New-Item -ItemType Directory -Path $skillParent -Force | Out-Null
Copy-Item -LiteralPath './claude/skills/ai-native-web' -Destination $skillParent -Recurse
Set-Location (Join-Path $skillParent 'ai-native-web')
npm install
node scripts/cli.mjs doctor
```

## Usage

Ask the agent, for example, "build a hamburger menu", "make this modal operable by keyboard and AI agents" or "add error messages to this form"; the skill guides how to write it and how to check it. **build** and **improve** are ways of asking the agent (modes), not CLI subcommands; the actual CLI commands used for verification are **static** / **check**, plus **doctor** for the environment check. Run the CLI from the installed skill directory (where [SKILL.md](shared/skill/SKILL.md) lives), and pass the target project path as an argument. Run `node scripts/cli.mjs doctor` on first use. Commands:

```text
node scripts/cli.mjs static <project-dir> [--json]
node scripts/cli.mjs check --dev <project-dir> --toggle "#menu-button"
node scripts/cli.mjs check --url http://localhost:3000/
```

You can also invoke the CLI by its installed path (for a target project at `~/projects/my-app`):

```text
node ~/.claude/skills/ai-native-web/scripts/cli.mjs static ~/projects/my-app
node ~/.claude/skills/ai-native-web/scripts/cli.mjs check --dev ~/projects/my-app --toggle "#menu-button"
```

Exit codes: 0 = no issues, 1 = issues found, 2 = usage or runtime error. See [shared/skill/references/workflow.md](shared/skill/references/workflow.md) for details.

## Safety

- `check --dev` runs the target project's dev server (`npm run dev` by default). Use it only on projects you trust.
- The browser opens loopback URLs only (localhost / 127.0.0.1 / [::1]) and aborts ordinary page requests to non-loopback hosts, including redirect targets for non-streaming requests. Loopback requests whose `Accept` includes `text/event-stream` are passed through; their redirects are not manually checked or recorded. WebSocket, Service Worker and the dev server process's own traffic are not blocked.
- See [SECURITY.md](SECURITY.md).

## Limits

The accessibility tree and automated checks cannot judge real screen reader output, wording quality, color-only meaning or text inside images. The skill reports these as `TODO(a11y)` items and remaining checks.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute.

```text
npm install
npm test
npm run sync   # copy shared/skill into the claude/ and codex/ distributions
```

Codex UI metadata (display name, description, default prompt) lives in [platform/codex/agents/openai.yaml](platform/codex/agents/openai.yaml); `npm run sync` adds it to the Codex distribution only, as `agents/openai.yaml`.

The Vite / Next.js E2E tests are opt-in: run `npm install` in `tests/fixtures/e2e-*`, then `ANW_E2E=1 node --test tests/e2e.test.mjs` in a POSIX shell (the suite is [tests/e2e.test.mjs](tests/e2e.test.mjs)).

PowerShell:

```powershell
$previousAnwE2e = $env:ANW_E2E
$env:ANW_E2E = '1'
try { node --test tests/e2e.test.mjs } finally { $env:ANW_E2E = $previousAnwE2e }
```

## License

MIT ([LICENSE](LICENSE)). Dependencies and the W3C documents referenced are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
