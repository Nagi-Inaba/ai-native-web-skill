# Native form controls (`native-form-controls`)

## When to use

Use this pattern for a small group of preferences or choices. Keep radio buttons, checkboxes, and select options native so browsers expose their values, checked state, selected options, and disabled state without a parallel ARIA implementation.

## DOM and accessibility tree contract

Use fieldset and legend to name a radio group, and the same name for its mutually exclusive choices. Connect every label to its input. Derive disabled and required from the same checkbox state; a disabled field is unavailable to keyboard interaction and is omitted from FormData. Read submission values from the form. In React, keep checked, value, disabled, and required controlled by the same state. Announce a saved result with a short status without moving focus.

### Before

```yaml
- main:
  - heading "Delivery preferences" [level=1]
  - radio
  - radio
  - checkbox
  - textbox
  - combobox
```

### After

```yaml
- main:
  - heading "Delivery preferences" [level=1]
  - group "Delivery speed":
    - text: Delivery speed
    - radio "Standard"
    - text: Standard
    - radio "Express" [checked]
    - text: Express
  - checkbox "Email updates" [checked]
  - text: Email updates Email address (required with updates)
  - textbox "Email address (required with updates)": reader@example.com
  - text: Region
  - combobox "Region":
    - option "Europe"
    - option "Asia" [selected]
  - paragraph:
    - button "Save preferences"
  - status: Saved Express delivery in Asia with email updates.
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delivery preferences</title>
  <style>body{font:1rem/1.5 system-ui;margin:1.5rem;max-width:42rem}fieldset{margin:1rem 0}label{display:block;margin:.5rem 0}button,input,select{font:inherit}button{min-height:2rem}:focus-visible{outline:3px solid #005fcc;outline-offset:3px}img{max-width:100%;height:auto}table{border-collapse:collapse}th,td{padding:.5rem;border:1px solid #666;text-align:left}</style>
</head>
<body>
  <main>
    <h1>Delivery preferences</h1>
    <form id="preferences">
      <fieldset>
        <legend>Delivery speed</legend>
        <label><input type="radio" name="delivery" value="Standard" checked> Standard</label>
        <label><input type="radio" name="delivery" value="Express"> Express</label>
      </fieldset>
      <label><input id="updates" type="checkbox" name="updates" value="yes"> Email updates</label>
      <label for="email">Email address (required with updates)</label>
      <input id="email" type="email" name="email" autocomplete="email" disabled>
      <label for="region">Region</label>
      <select id="region" name="region"><option>Europe</option><option>Asia</option></select>
      <p><button type="submit">Save preferences</button></p>
      <p id="save-status" role="status"></p>
    </form>
  </main>
  <script>
    const form = document.querySelector("#preferences");
    const updates = document.querySelector("#updates");
    const email = document.querySelector("#email");
    updates.addEventListener("change", () => {
      email.disabled = !updates.checked;
      email.required = updates.checked;
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = new FormData(form);
      const result = values.has("updates") ? "with email updates" : "without email updates";
      document.querySelector("#save-status").textContent = `Saved ${values.get("delivery")} delivery in ${values.get("region")} ${result}.`;
    });
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useState } from "react";

export default function NativeFormControls() {
  const [delivery, setDelivery] = useState("Standard");
  const [updates, setUpdates] = useState(false);
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("Europe");
  const [status, setStatus] = useState("");
  return (
    <main>
      <h1>Delivery preferences</h1>
      <form onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const result = values.has("updates") ? "with email updates" : "without email updates";
        setStatus(`Saved ${values.get("delivery")} delivery in ${values.get("region")} ${result}.`);
      }}>
        <fieldset>
          <legend>Delivery speed</legend>
          {["Standard", "Express"].map((choice) => (
            <label key={choice}>
              <input type="radio" name="delivery" value={choice} checked={delivery === choice} onChange={() => setDelivery(choice)} />
              {choice}
            </label>
          ))}
        </fieldset>
        <label><input type="checkbox" name="updates" value="yes" checked={updates} onChange={(event) => setUpdates(event.target.checked)} /> Email updates</label>
        <label htmlFor="email">Email address (required with updates)</label>
        <input id="email" type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={!updates} required={updates} />
        <label htmlFor="region">Region</label>
        <select id="region" name="region" value={region} onChange={(event) => setRegion(event.target.value)}><option>Europe</option><option>Asia</option></select>
        <p><button type="submit">Save preferences</button></p>
        <p role="status">{status}</p>
      </form>
    </main>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Reach the selected radio, checkbox, enabled email field, select, and submit button. |
| Arrow keys | Choose a radio within its group or a select option using native behavior. |
| Space | Toggle the checkbox or choose the focused radio. |
| Enter | Submit a valid form. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Replacing choices with clickable divs or CSS-only check marks. | Keep native inputs and their checked/value properties. |
| Giving each radio a different name. | Use one name within a fieldset so only one choice can be selected. |
| Styling a field as disabled while it remains usable. | Set the native disabled property from the same state as the presentation. |
| Adding aria-checked alongside a native checked state. | Let native semantics expose the state; avoid two state stores. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route>
```

Choose Express, enable email updates, enter reader@example.com, select Asia, and save to produce the After snapshot. Then disable updates and confirm that email becomes disabled and is absent from FormData. Check radio arrow-key behavior, labels, submitted values, and focus staying on the submit button. The CLI tab check is an observation aid; it does not submit this form.

## References

- [HTML: form controls](https://html.spec.whatwg.org/multipage/forms.html)
- [HTML: input element states](https://html.spec.whatwg.org/multipage/input.html)
- [WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
- [WAI-ARIA APG: Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
