# Repeated items (`repeated-items`)

## When to use

Use this pattern when products, notifications, users, or other items share the same structure and each item has actions with the same visible label, such as Edit or Delete.

## DOM and accessibility tree contract

Use `ul` / `li` for the list and an `article` named by its heading for each group. Include the target in each action name so that, even when the visible label is only “Edit,” its accessible name is unique, such as “Edit: Product A.” Reflect the selected or editing state with `aria-pressed` and a nearby `status`. Use stable data IDs for React keys and DOM IDs.

### Before

```yaml
- main:
  - heading "Product list" [level=1]
  - list:
    - listitem:
      - article "Product A":
        - heading "Product A" [level=2]
        - paragraph: In stock
        - 'button "Edit: Product A"': Edit
    - listitem:
      - article "Product B":
        - heading "Product B" [level=2]
        - paragraph: Only 2 left
        - 'button "Edit: Product B"': Edit
  - status: Select a product to edit.
```

### After

```yaml
- main:
  - heading "Product list" [level=1]
  - list:
    - listitem:
      - article "Product A":
        - heading "Product A" [level=2]
        - paragraph: In stock
        - 'button "Edit: Product A" [pressed]': Edit
    - listitem:
      - article "Product B":
        - heading "Product B" [level=2]
        - paragraph: Only 2 left
        - 'button "Edit: Product B"': Edit
  - status: Editing Product A.
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product list</title>
</head>
<body>
  <main>
    <h1>Product list</h1>
    <ul>
      <li>
        <article aria-labelledby="product-a-name">
          <h2 id="product-a-name">Product A</h2>
          <p>In stock</p>
          <button type="button" aria-label="Edit: Product A" aria-pressed="false">Edit</button>
        </article>
      </li>
      <li>
        <article aria-labelledby="product-b-name">
          <h2 id="product-b-name">Product B</h2>
          <p>Only 2 left</p>
          <button type="button" aria-label="Edit: Product B" aria-pressed="false">Edit</button>
        </article>
      </li>
    </ul>
    <p id="edit-status" role="status">Select a product to edit.</p>
  </main>
  <script>
    const buttons = [...document.querySelectorAll('button[aria-label^="Edit: "]')];
    const status = document.querySelector("#edit-status");

    for (const button of buttons) {
      button.addEventListener("click", () => {
        for (const candidate of buttons) candidate.setAttribute("aria-pressed", String(candidate === button));
        const name = button.getAttribute("aria-label").replace("Edit: ", "");
        status.textContent = `Editing ${name}.`;
      });
    }
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useState } from "react";

const products = [
  { id: "a", name: "Product A", stock: "In stock" },
  { id: "b", name: "Product B", stock: "Only 2 left" }
];

export default function RepeatedItems() {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <>
      <ul>
        {products.map((product) => (
          <li key={product.id}>
            <article aria-labelledby={`product-${product.id}-name`}>
              <h2 id={`product-${product.id}-name`}>{product.name}</h2>
              <p>{product.stock}</p>
              <button
                type="button"
                aria-label={`Edit: ${product.name}`}
                aria-pressed={editing === product.id}
                onClick={() => setEditing(product.id)}
              >
                Edit
              </button>
            </article>
          </li>
        ))}
      </ul>
      <p role="status">
        {editing ? `Editing ${products.find((product) => product.id === editing)?.name}.` : "Select a product to edit."}
      </p>
    </>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Move through each item's actions in DOM order. |
| Enter / Space | Activate the button whose name includes its target. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Naming every button only “Edit.” | Include the item name in `aria-label` or the visible text. |
| Using an array index as a key or ID. | Use a data ID whose identity remains stable after reordering. |
| Making the entire list a live region. | Announce only the short result in a `status` to avoid rereading the list. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

Confirm that every button has a unique name and that only the activated item gains the pressed state while a short result message appears.

## References

- [WAI-ARIA APG: Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [WAI-ARIA APG: Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
