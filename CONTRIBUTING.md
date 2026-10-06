# Contributing

Thanks for helping AI coding agents build UI that people and agents can operate. Issues and pull requests are welcome in English or Japanese.

## What helps most

- **A missed problem or a false finding**: a minimal code sample (HTML or React), the command you ran, what was reported, and what you expected.
- **A new or better pattern**: a component that agents keep getting wrong (combobox, toast, data table, …) with the expected accessibility-tree state and keyboard behavior.
- **Framework or library cases**: Next.js, Vite, Tailwind, shadcn/ui, Radix, MUI setups where the checks or the guidance do not fit.

## Development setup

```text
npm install
npm test
```

Browser tests use the system Google Chrome; they are skipped when Chrome cannot be launched. The Vite / Next.js E2E tests are opt-in: run `npm install` in `tests/fixtures/e2e-*`, then `ANW_E2E=1 node --test tests/e2e.test.mjs` in a POSIX shell.

PowerShell:

```powershell
$previousAnwE2e = $env:ANW_E2E
$env:ANW_E2E = '1'
try { node --test tests/e2e.test.mjs } finally { $env:ANW_E2E = $previousAnwE2e }
```

## Rules for changes

- **Edit `shared/skill/`, then run `npm run sync`.** `claude/` and `codex/` are generated copies; CI fails if they differ from the source.
- **Tests first.** A rule or probe change needs a failing test that passes after the change, plus a look-alike case that must not be reported (a negative control).
- **Patterns are tested code.** The HTML and React blocks in `shared/skill/references/patterns/*.md` must stay identical to `tests/fixtures/patterns/<id>/` and pass `static` with no confirmed findings. Browser tests exercise the HTML fixtures and compare their documented state; React examples are not exercised in a browser by this suite.
- **Prefer native elements** (`button`, `a href`, `form`, `label`, `dialog`, `details`) and keep state in DOM attributes and visible text.
- **No conformance claims.** The skill does not certify WCAG / JIS conformance.
- **Keep the safety boundary.** `check` opens loopback URLs only; do not add features that operate external sites, submit to external services, or download browsers.

## Pattern tests and distribution artifacts

From the repository root, run `node --test tests/patterns.test.mjs` for the pattern suite or `npm test` for all tests. Browser tests skip when local Chrome is unavailable.

Build public folder/zip artifacts from a clean clone or `git archive`, never from a working tree containing local-only material. Local reference material stays in the source and local distribution copies. The distribution package's `files` allowlist excludes it from `npm pack`. Run `npm pack --dry-run --json --ignore-scripts` inside each generated skill directory to inspect the package contents; this does not publish the package.

## Commits and pull requests

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`). In the pull request, describe the behavior change, the tests you added, and anything you could not verify. Security problems go through [SECURITY.md](SECURITY.md), not public issues.
