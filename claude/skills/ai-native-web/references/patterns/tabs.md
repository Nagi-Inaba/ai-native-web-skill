# Tabs (`tabs`)

## When to use

Use this pattern to show one at a time from a small set of content within the same context. Use regular links and routing for content that should have a shareable URL or participate in browser history.

## DOM and accessibility tree contract

Give the `tablist` a name. Match each tab's `aria-controls` to a panel, and each `tabpanel`'s `aria-labelledby` back to its tab. Only the selected tab has `aria-selected="true"` and `tabindex="0"`; all other tabs have `-1`. Keep the selection and visible panel synchronized in the same interaction.

### Before

```yaml
- main:
  - heading "Product information" [level=1]
  - tablist "Product information":
    - tab "Overview" [selected]
    - tab "Specifications"
  - tabpanel "Overview":
    - paragraph: A lightweight model for everyday use.
```

### After

```yaml
- main:
  - heading "Product information" [level=1]
  - tablist "Product information":
    - tab "Overview"
    - tab "Specifications" [selected]
  - tabpanel "Specifications":
    - paragraph: It weighs 1.2 kg.
```

This example uses automatic activation because it can display content immediately. If selecting a tab requires a network request, use manual activation: arrow keys move focus only, and Enter / Space selects the tab.

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product information</title>
</head>
<body>
  <main>
    <h1>Product information</h1>
    <div role="tablist" aria-label="Product information">
      <button id="tab-overview" type="button" role="tab" aria-selected="true" aria-controls="panel-overview" tabindex="0">Overview</button>
      <button id="tab-specs" type="button" role="tab" aria-selected="false" aria-controls="panel-specs" tabindex="-1">Specifications</button>
    </div>
    <section id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0">
      <p>A lightweight model for everyday use.</p>
    </section>
    <section id="panel-specs" role="tabpanel" aria-labelledby="tab-specs" tabindex="0" hidden>
      <p>It weighs 1.2 kg.</p>
    </section>
  </main>
  <script>
    const tabs = [...document.querySelectorAll('[role="tab"]')];

    function activate(nextTab) {
      for (const tab of tabs) {
        const selected = tab === nextTab;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
      }
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : index + (event.key === "ArrowRight" ? 1 : -1);
        next = (next + tabs.length) % tabs.length;
        activate(tabs[next]);
        tabs[next].focus();
      });
    });
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useRef, useState } from "react";

const tabs = [
  { id: "overview", label: "Overview", content: "A lightweight model for everyday use." },
  { id: "specs", label: "Specifications", content: "It weighs 1.2 kg." }
] as const;

export default function Tabs() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveFocus(index: number) {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <>
      <div role="tablist" aria-label="Product information">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(node) => { tabRefs.current[index] = node; }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active === index}
            aria-controls={`panel-${tab.id}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") moveFocus(index + 1);
              else if (event.key === "ArrowLeft") moveFocus(index - 1);
              else if (event.key === "Home") moveFocus(0);
              else if (event.key === "End") moveFocus(tabs.length - 1);
              else return;
              event.preventDefault();
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <section
          key={tab.id}
          id={`panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab.id}`}
          tabIndex={0}
          hidden={active !== index}
        >
          <p>{tab.content}</p>
        </section>
      ))}
    </>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab | Enter the selected tab, then move to the visible panel with the next Tab. |
| ArrowLeft / ArrowRight | Cycle through the tabs and, in this automatic activation example, select each tab as focus moves. |
| Home / End | Move to and select the first or last tab. |
| Enter / Space | Select the focused tab using the button's native behavior. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Giving every tab `tabindex="0"`. | Use a roving tabindex so the tablist has one Tab stop. |
| Changing only the visual style while `aria-selected` remains fixed. | Update selection, tabindex, and `hidden` from one state value. |
| Using tabs as links to separate pages. | Use links and URLs for shareable pages. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

In addition to clicking, exercise the arrow, Home, and End keys. Confirm that the selected tab and visible panel change together as shown in the YAML above.

## References

- [WAI-ARIA APG: Tabs Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WAI-ARIA APG: Automatic Activation Tabs Example](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/examples/tabs-automatic/)
