# Workflow

## Commands

```text
node scripts/cli.mjs static <project-dir> [--json]
node scripts/cli.mjs check (--url <loopback-url> | --dev <project-dir> [--dev-command "<command>"]) [--path <route>]... [--toggle <selector>]... [--tab-steps <n>] [--json]
node scripts/cli.mjs doctor [--json]
```

Exit codes: 0 = no findings, 1 = findings, 2 = usage or runtime error, missing dependencies, or Chrome cannot be launched.

- `--path` can be repeated; results are returned per page in `pages` (browser JSON uses `schema_version: "2.0.0"`).
- `--toggle` takes a CSS selector. In the opened state the accessibility tree, axe and the Tab walk run again, and a state change that alters only the visuals while the DOM and tree stay the same is reported (`dom-state-legibility`). Do not use it on elements without `aria-expanded`, such as a button that opens a modal dialog.
- On first use or when something fails, run `doctor` to check the Node version, the dependencies and whether Chrome launches.

Component-by-component code is in [patterns/](patterns/README.md).

## What `static` analyzes

- `.html` (@html-eslint), `.js` / `.jsx` / `.tsx` (eslint-plugin-jsx-a11y), `.css` (custom stylelint rules).
- In a git work tree it follows `.gitignore` (tracked files plus untracked files that are not ignored); otherwise it walks the folder. Either way it skips `node_modules`, `.git`, `.next`, `dist`, `build`, `out`, `coverage`, `.vite` and `.turbo`.
- Tailwind `className` values (string literals and string arguments of `clsx` / `cn` / `twMerge` / `classNames`) are checked for `outline-none` without a focus replacement (`anw/jsx-tailwind-focus`), visual reordering with `order-*` / `*-reverse` (`anw/jsx-tailwind-order`) and fixed pixel sizes such as `text-[12px]` (`anw/jsx-tailwind-fixed-text`).
- The project's `eslint-disable` comments are respected. Comments that name rules this tool does not load are ignored.
- `.ts` files without JSX and CSS-in-JS style definitions are not analyzed.

## Project config (optional)

Put `ai-native-web.config.json` at the project root to analyze design-system components as native elements.

```json
{
  "components": { "Button": "button", "IconButton": "button", "Link": "a", "Input": "input", "Image": "img" },
  "polymorphicPropName": "as",
  "ignore": ["src/legacy/**"]
}
```

`components` maps component names to native elements, `polymorphicPropName` is the prop that switches the rendered element, and `ignore` lists globs to skip. Unknown keys or wrong types stop with exit code 2. See [patterns/ui-libraries.md](patterns/ui-libraries.md).

## Reading `certainty`

| Value | Meaning | What to do |
| --- | --- | --- |
| `confirmed` | The code alone shows the problem | Fix it |
| `needs_browser` | Another file or the rendered result may already solve it | Confirm with `check` |
| `needs_review` | A rule without a recipe mapping, a parse error, or likely intentional code | Read the code and decide |

Click-to-close backdrops (empty full-screen overlays such as `inset-0`) and popover wrappers whose `onClick` only calls `stopPropagation()` are not controls, so they are reported as `needs_review`. They are fine when the menu or dialog also closes with Escape and a close button.

## What AI agents read

| Reader | Main input |
| --- | --- |
| Playwright MCP, Claude browser use | The accessibility tree (role, name, state, value, hierarchy) and page text |
| DOM-reading agents such as Browser Use | HTML attributes, visible text, current input values, accessibility properties |
| Screenshot-reading agents | The visuals (labels, focus indicators, contrast) |

What works for every reader: use the right elements and expose state as DOM attributes and visible text. The `build` list of the `dom-state-legibility` recipe spells this out.

The static rule `anw/jsx-static-aria-state` reports state attributes written as fixed literals, such as `aria-expanded="false"`, on elements with `onClick` or other handlers (the typical case where the visuals change but the DOM and tree do not). Rendering separate elements for the open and closed states is fine, so it is reported as `needs_browser`.

## What `check` looks at

| Check | What it does | Recipe |
| --- | --- | --- |
| outline | The page's accessibility tree (ariaSnapshot) | discoverable-structure |
| tab | Computed role and name of each element reached with Tab, and its focus indicator | action-semantics, control-name-and-purpose, visual-perception |
| toggle | Whether `aria-expanded` and panel visibility agree before and after Enter on each `--toggle` trigger, and after closing again | state-focus-sync |
| state-legibility | Whether an opened state changes only the visuals while the DOM and tree stay the same | dom-state-legibility |
| axe | axe-core 4.13 rules tagged wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa and best-practice; violations only (`incomplete` results are not reported) | Per rule |
| reflow | Whether a 320px-wide viewport scrolls horizontally | visual-perception |
| reduced-motion | Whether infinite animations stop under `prefers-reduced-motion: reduce` | visual-perception |

## Framework notes

- Next.js (App Router): `<html lang>` in `app/layout.tsx`, `metadata.title` on each page, `alt` on `next/image`, link text of `next/link`. The default `--dev` command is `npm run dev`.
- Vite + React: `lang` and `<title>` in `index.html`; on route changes update `document.title` and move focus to the main heading.

## Background

Each recipe maps to WCAG 2.2 success criterion numbers (`wcag` in `recipes.json`). When a decision needs more detail, see W3C [WCAG 2.2 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/), the [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/) and [ARIA in HTML](https://www.w3.org/TR/html-aria/).
