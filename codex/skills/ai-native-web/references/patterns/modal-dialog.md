# Modal dialog (`modal-dialog`)

## When to use

Use this pattern when a confirmation or short input task must temporarily interrupt interaction with the content behind it. Do not use a modal for content that can be completed within the regular page.

## DOM and accessibility tree contract

Use the native `dialog.showModal()` method to make the background inert, and provide a name and description with `aria-labelledby` and, when needed, `aria-describedby`. Immediately after opening, move focus to an element that helps the user understand the content. On close, return focus to the button that opened the dialog. The native dialog handles Tab containment and Escape.

### Before

```yaml
- main:
  - heading "Order" [level=1]
  - button "Check shipping address"
```

### After

```yaml
- main:
  - heading "Order" [level=1]
  - button "Check shipping address"
  - dialog "Confirm shipping address":
    - heading "Confirm shipping address" [level=2]
    - paragraph: Your order will be delivered to 1-1 Chiyoda, Chiyoda-ku, Tokyo.
    - button "Back"
    - button "Confirm"
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shipping address</title>
</head>
<body>
  <main>
    <h1>Order</h1>
    <button id="open-dialog" type="button">Check shipping address</button>
    <dialog id="address-dialog" aria-labelledby="dialog-title" aria-describedby="dialog-description">
      <h2 id="dialog-title" tabindex="-1">Confirm shipping address</h2>
      <p id="dialog-description">Your order will be delivered to 1-1 Chiyoda, Chiyoda-ku, Tokyo.</p>
      <form method="dialog">
        <button value="cancel">Back</button>
        <button value="confirm">Confirm</button>
      </form>
    </dialog>
  </main>
  <script>
    const opener = document.querySelector("#open-dialog");
    const dialog = document.querySelector("#address-dialog");
    const title = document.querySelector("#dialog-title");

    opener.addEventListener("click", () => {
      dialog.showModal();
      title.focus();
    });
    dialog.addEventListener("close", () => opener.focus());
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useRef } from "react";

export default function ModalDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  function openDialog() {
    dialogRef.current?.showModal();
    titleRef.current?.focus();
  }

  return (
    <>
      <button ref={openerRef} type="button" onClick={openDialog}>Check shipping address</button>
      <dialog
        ref={dialogRef}
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        onClose={() => openerRef.current?.focus()}
      >
        <h2 ref={titleRef} id="dialog-title" tabIndex={-1}>Confirm shipping address</h2>
        <p id="dialog-description">Your order will be delivered to 1-1 Chiyoda, Chiyoda-ku, Tokyo.</p>
        <form method="dialog">
          <button value="cancel">Back</button>
          <button value="confirm">Confirm</button>
        </form>
      </dialog>
    </>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Enter / Space | Open the dialog from its trigger button. |
| Tab / Shift+Tab | Cycle only within the open dialog. |
| Escape | Close the dialog and return to its trigger button. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Placing a visually styled `div` in front of the page. | Use `dialog` and `showModal()` so the browser also knows the content is modal. |
| Allowing Tab to reach the background after the dialog opens. | Use a native modal dialog, or implement a reliable focus trap and make the background inert. |
| Letting focus disappear to the body after closing. | Return focus to the original trigger after `close`. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

Exercise open, close, Escape, and focus return, then confirm that `ariaSnapshot()` after interaction matches the YAML above.

## References

- [WAI-ARIA APG: Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [HTML: dialog element](https://html.spec.whatwg.org/multipage/interactive-elements.html#the-dialog-element)
