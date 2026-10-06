# Changelog

All notable changes are recorded here. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `dom-state-legibility` recipe: expose UI state (open, selected, invalid, busy, results) as DOM attributes and visible text that AI agents and assistive technology read.
- Pattern library (`references/patterns/`): disclosure menu, modal dialog, tabs, form with errors, repeated items, route-change focus and async status, each with HTML and React examples, the expected accessibility-tree state, keyboard table and common mistakes. HTML and React examples have no confirmed static findings; browser tests exercise the HTML examples' documented states.
- Static rule `anw/jsx-static-aria-state`: fixed `aria-expanded`/`aria-pressed`/`aria-selected`/`aria-checked` literals on elements with interaction handlers.
- `check --path` (repeatable), re-checks of the opened state for each `--toggle`, a visual-only state change probe, and a `doctor` command. Browser reports use `schema_version` 2.0.0 with a `pages` array.
- Missing npm dependencies or an unavailable Chrome exit with code 2 and a short instruction.
- Optional `ai-native-web.config.json` (components, polymorphicPropName, ignore) so design-system components are analyzed as native elements.
- Tailwind className rules: `anw/jsx-tailwind-focus`, `anw/jsx-tailwind-order`, `anw/jsx-tailwind-fixed-text`.
- Guides for shadcn/ui, Radix UI and MUI (`patterns/ui-libraries.md`) and Tailwind (`patterns/tailwind.md`).
- Native form controls and data-table/image-alternative patterns, with HTML/React fixtures and browser checks for native state, keyboard behavior, disabled form values, image alternatives and table headers.
- CONTRIBUTING.md and issue templates for findings and pattern requests.

- English README (`README.en.md`), `SECURITY.md`, this changelog and a GitHub Actions workflow for tests and distribution sync.
- Codex UI metadata (`agents/openai.yaml`) added to the Codex distribution from `platform/codex/agents/`.
- `.gitattributes` that keeps text files LF in every checkout.
- Distributions include `LICENSE` and `THIRD_PARTY_NOTICES.md`.

### Changed

- The skill is framed as an engineering aid for AI-operable UI (correct elements, a clean accessibility tree, DOM-readable state); the description now triggers on accessibility, a11y, ARIA, keyboard and agent-operable UI requests; Codex installs point to `~/.agents/skills`.
- The skill (SKILL.md, workflow, recipes and the pattern library, including example UI text) is written in English only; the agent answers in the language the user writes in.
- `SKILL.md` states that user, project and environment instructions override the default execution policy, and describes the actual network boundary of `check`. Page-derived text in reports is to be treated as data.
- `workflow.md` links to the W3C documents instead of bundling copies.
- `toggleCheck` reads the trigger's own state and also verifies closing (second activation).
- Focus indicators are detected by comparing focused and unfocused computed styles (outline, box-shadow, border, background, text-decoration).
- JSX findings on elements with spread props are reported as `needs_browser` instead of `confirmed`.
- All axe-core rules enabled by the configured tags map to a recipe.
- CI pins actions by commit SHA and fails on untracked distribution files.
- The CLI rejects options that do not belong to the command.

### Fixed

- Distribution packages use a public-file allowlist, keeping local references and internal notes out of npm packages while preserving local source material. Folder/zip artifacts are built from a clean Git checkout.
- Installed-skill dependency errors recommend `npm install` in the skill directory. Pattern developer tests live in CONTRIBUTING; installed guidance uses the project CLI. Network guidance documents the streaming-request redirect exception.
- Build guidance limits `--toggle` to disclosure triggers with `aria-expanded`; other interactions use the relevant pattern's manual or project-test verification. UI-library and Tailwind guides link to their primary documentation.
- Form examples display the required-input rule in their labels as well as native attributes.
- Third-party notices preserve the Next.js MIT copyright and permission text for the generated AGENTS.md block in the Next.js test fixture.

- Security: source collection skips symbolic links (including links to files inside the project), non-regular entries, stale paths and symbolic link loops, and Git-listed paths resolving outside the physical project root through directory links. Regular files and linked project roots remain supported.
- Security: static source listing disables repository fsmonitor hooks and starts Git from the skill's script directory, avoiding executable lookup in the caller's project directory on Windows. Git and PATH must be trusted.
- Static analysis follows `.gitignore` inside a git work tree and skips ignored build output and no longer reports project `eslint-disable` comments that name rules the analyzer does not load.
- Click-to-close backdrops (empty full-screen overlays) and popover click guards (`onClick` that only calls `stopPropagation`) are reported as `needs_review` instead of `confirmed`.
- Security: redirects from a loopback page to a non-loopback host were followed without being blocked or recorded; redirect targets of non-streaming requests are now checked.
- Security: `check --url` contacted the host before validating that it is loopback; the URL is validated first and readiness checks no longer follow redirects.
- `waitForHttp` could hang past its timeout on a server that accepts connections but never responds.
- The dev server URL lost its path and query; the most recent `Local` URL is used.
- Dev server shutdown escalates to SIGKILL on POSIX and always settles within a bounded time.
- Static rules: empty `aria-label`/`aria-labelledby` no longer count as labels; `box-shadow: none` and similar values no longer count as focus replacements; `:not(:focus)` is not reported; only `prefers-reduced-motion: reduce` counts as a motion branch; descriptive alt text ending in a file extension is not flagged.
- Sync refuses symbolic link or junction ancestors in the output path.
- The opt-in E2E fixtures no longer depend on the repository root, which created a recursive link on `npm install`.

### Known issues

- `braces` 3.0.3 remains affected by the high-severity advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), through stylelint → micromatch (also through fast-glob). As of 2026-10-06, the npm registry still lists 3.0.3 as latest and the advisory lists no patched version. No untrusted brace-pattern path was identified in the current static CLI: stylelint escapes existing CSS file paths, its glob options are fixed, project `ignore` patterns use the analyzer's literal/star matcher, and `.stylelintignore` uses the separate `ignore` parser. The dependency advisory remains; recheck it when dependencies or input handling change.

## [0.1.0] - 2026-09-29

### Added

- Seven accessibility recipes for build and improve modes.
- `static` command: HTML / JSX / TSX / CSS analysis with eslint-plugin-jsx-a11y, @html-eslint, stylelint and custom rules (meaningless alt text, unlabelled form controls, focus outline removal, missing `prefers-reduced-motion`).
- `check` command: loopback-only Chrome session with computed accessible names, Tab walk, open/close state sync, axe-core, 320px reflow and reduced-motion probes; dev server start and stop.
- Claude Code and Codex distribution copies.
