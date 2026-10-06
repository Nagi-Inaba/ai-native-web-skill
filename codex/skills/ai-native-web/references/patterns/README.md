# Practical UI Patterns

This directory contains implementation and verification patterns for UI whose state can be read from the DOM and accessibility tree. Component pattern pages include a complete HTML document and minimal React TypeScript/JSX. The UI-library and Tailwind guides explain how to preserve those contracts with specific libraries and styling tools.

## Pattern index

| ID | Use case | Main state contract |
| --- | --- | --- |
| [disclosure-menu](./disclosure-menu.md) | Expandable navigation | `aria-expanded`, `aria-controls`, `hidden` |
| [modal-dialog](./modal-dialog.md) | Modal confirmation or short input | Dialog name, initial focus, focus return |
| [tabs](./tabs.md) | Switching panels within one context | `aria-selected`, roving tabindex, tabpanel |
| [form-with-errors](./form-with-errors.md) | Input validation and recovery | Label, `aria-describedby`, `aria-invalid`, alert |
| [native-form-controls](./native-form-controls.md) | Grouped choices and dependent inputs | Native checked, selected, value, disabled and required |
| [data-table-and-images](./data-table-and-images.md) | Chart alternatives and simple data tables | Informative/empty alt, visible summary, caption, header scope |
| [repeated-items](./repeated-items.md) | Per-item actions in repeated content | Stable IDs, target-specific names, per-item state |
| [route-change-focus](./route-change-focus.md) | SPA navigation | URL, title, `aria-current`, `h1` focus |
| [async-status](./async-status.md) | Waiting states for search, save, and similar tasks | `aria-busy`, status, alert, query parameter |
| [ui-libraries](./ui-libraries.md) | Using shadcn/ui, Radix UI, and MUI | Primitive semantics, names, synchronized `data-state` and `aria-*` |
| [tailwind](./tailwind.md) | Aligning Tailwind presentation with the DOM | focus-visible, DOM order, hidden, attribute variants |

## How to read each page

Each component pattern follows this order:

1. **When to use** — How to decide whether to choose the pattern.
2. **DOM and accessibility tree contract** — DOM attributes and Playwright `ariaSnapshot()` before and after interaction.
3. **HTML** — A complete document that runs directly in a browser.
4. **React** — A client component that works with the Next.js App Router and Vite.
5. **Keyboard** — The interaction model the implementation preserves.
6. **Common mistakes and fixes** — Checks to make during review.
7. **Verify** — Exact commands for `static`, `check`, and manual interaction.
8. **References** — Primary sources such as the relevant WAI-ARIA APG guidance.

## Shared principles

- Prefer native HTML. Use ARIA to supplement state, relationships, and names.
- Synchronize presentation, DOM attributes, focus, and the accessibility tree from one state value.
- Put state that must be shareable or restorable in the URL path or query parameters.
- Use live regions only for short changes; do not apply them indiscriminately to large containers such as result lists.
- In the source repository, tests verify that the documented HTML and React examples match the fixtures and have no confirmed static findings. Browser tests exercise the HTML examples and compare their documented accessibility-tree states.

## Verify a pattern in your project

Follow the pattern page's Verify section and run the CLI from the installed skill directory:

```sh
node scripts/cli.mjs static <project-dir>
node scripts/cli.mjs check --dev <project-dir> --path <route>
```

Source-repository test instructions are in the repository's CONTRIBUTING.md; those tests are not bundled with the installed skill.
