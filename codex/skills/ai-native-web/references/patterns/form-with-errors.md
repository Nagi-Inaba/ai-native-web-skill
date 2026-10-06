# Form with errors (`form-with-errors`)

## When to use

Use this pattern for a form that validates input and must help users identify and correct problems. Keep the label, input purpose, description, field-level error, and submission result in the DOM.

## DOM and accessibility tree contract

Associate each `label` with its input, and reference the IDs of help and error text with `aria-describedby`. Add `aria-invalid="true"` only when an error is present, and add a specific error with `role="alert"`. After an unsuccessful submission, focus the first invalid field. Announce success with `role="status"`.

### Before

```yaml
- main:
  - heading "Register notification address" [level=1]
  - text: Email address (required)
  - paragraph: We will send order notifications to this address.
  - textbox "Email address (required)"
  - button "Register"
```

### After

```yaml
- main:
  - heading "Register notification address" [level=1]
  - text: Email address (required)
  - paragraph: We will send order notifications to this address.
  - textbox "Email address (required)" [invalid]
  - alert: Enter your email address.
  - button "Register"
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Register notification address</title>
</head>
<body>
  <main>
    <h1>Register notification address</h1>
    <form id="notification-form" novalidate>
      <label for="email">Email address (required)</label>
      <p id="email-help">We will send order notifications to this address.</p>
      <input id="email" name="email" type="email" autocomplete="email" required aria-describedby="email-help email-error">
      <p id="email-error" role="alert" hidden></p>
      <button id="submit-button" type="submit">Register</button>
      <p id="form-status" role="status" hidden></p>
    </form>
  </main>
  <script>
    const form = document.querySelector("#notification-form");
    const email = document.querySelector("#email");
    const error = document.querySelector("#email-error");
    const status = document.querySelector("#form-status");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!email.validity.valid) {
        email.setAttribute("aria-invalid", "true");
        error.textContent = email.validity.valueMissing ? "Enter your email address." : "Check the email address format.";
        error.hidden = false;
        status.hidden = true;
        email.focus();
        return;
      }
      email.removeAttribute("aria-invalid");
      error.hidden = true;
      status.textContent = "Notification address registered.";
      status.hidden = false;
    });
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";

export default function FormWithErrors() {
  const emailRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = emailRef.current;
    if (!input?.validity.valid) {
      setError(input?.validity.valueMissing ? "Enter your email address." : "Check the email address format.");
      setStatus("");
      input?.focus();
      return;
    }
    setError("");
    setStatus("Notification address registered.");
  }

  return (
    <form noValidate onSubmit={submit}>
      <label htmlFor="email">Email address (required)</label>
      <p id="email-help">We will send order notifications to this address.</p>
      <input
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        aria-describedby="email-help email-error"
        aria-invalid={error ? true : undefined}
        onChange={() => setError("")}
      />
      <p id="email-error" role="alert" hidden={!error}>{error}</p>
      <button type="submit">Register</button>
      <p role="status" hidden={!status}>{status}</p>
    </form>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Move in order through the labeled input and submit button. |
| Enter | Submit from the input or submit button. |
| Standard browser editing keys | Correct the input value. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Indicating an error with color and a border alone. | Associate specific text with the input and synchronize `aria-invalid`. |
| Replacing all text in an always-present empty live region on every validation. | Present only newly relevant field errors as alerts, and use a separate status for success. |
| Leaving focus on the submit button after an error. | Move focus to the first input that needs correction so its description can be read. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

Try an empty value, an invalid format, and a valid submission. Confirm that the attributes, messages, and focus on error follow the contract above.

## References

- [WAI-ARIA APG: Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [WAI-ARIA APG: Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
