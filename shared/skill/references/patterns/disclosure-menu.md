# Disclosure menu (`disclosure-menu`)

## When to use

Use this pattern when part of a global navigation or category list should expand only when needed. Do not add `role="menu"` to a list of links within a website; keep the standard navigation, list, and link semantics.

## DOM and accessibility tree contract

Use a `button` as the trigger and toggle the `hidden` state of the element referenced by `aria-controls`. Keep `aria-expanded="false"` while the content is closed and synchronize it to `true` when the content opens. When Escape closes the content, return focus to the trigger.

### Before

```yaml
- banner:
  - navigation "Product categories":
    - button "Categories"
- main:
  - heading "Find products" [level=1]
```

### After

```yaml
- banner:
  - navigation "Product categories":
    - button "Categories" [expanded]
    - list:
      - listitem:
        - link "New arrivals":
          - /url: /new
      - listitem:
        - link "Sale products":
          - /url: /sale
- main:
  - heading "Find products" [level=1]
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Category menu</title>
  <style>nav a { display: inline-block; min-width: 24px; min-height: 24px; }</style>
</head>
<body>
  <header>
    <nav aria-label="Product categories">
      <button id="menu-button" type="button" aria-expanded="false" aria-controls="category-links">Categories</button>
      <ul id="category-links" hidden>
        <li><a href="/new">New arrivals</a></li>
        <li><a href="/sale">Sale products</a></li>
      </ul>
    </nav>
  </header>
  <main><h1>Find products</h1></main>
  <script>
    const button = document.querySelector("#menu-button");
    const links = document.querySelector("#category-links");

    function setOpen(open) {
      button.setAttribute("aria-expanded", String(open));
      links.hidden = !open;
    }

    button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
    links.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.focus();
      }
    });
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function DisclosureMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <nav aria-label="Product categories">
      <button
        ref={buttonRef}
        id="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="category-links"
        onClick={() => setOpen((value) => !value)}
      >
        Categories
      </button>
      <ul id="category-links" hidden={!open}>
        <li><a href="/new">New arrivals</a></li>
        <li><a href="/sale">Sale products</a></li>
      </ul>
    </nav>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Move through the button and, when expanded, the links in their normal order. |
| Enter / Space | Toggle the list from the button. |
| Escape | Close the list from within it and return focus to the button. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Toggling a clickable `div` with CSS alone. | Synchronize a `button`, `aria-expanded`, `aria-controls`, and `hidden`. |
| Adding `role="menu"` to site navigation. | Use `nav`, `ul`, and `a` unless this is an application menu. |
| Allowing Tab to enter a closed panel. | Use `hidden` when closed so visibility and operability stay aligned. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component> --toggle "#menu-button"
```

Also confirm that the names, states, and content in `ariaSnapshot()` after interaction match the YAML above.

## References

- [WAI-ARIA APG: Disclosure Navigation Menu Example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/)
- [WAI-ARIA APG: Menu Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
