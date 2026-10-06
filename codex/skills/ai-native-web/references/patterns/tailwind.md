# Preserve focus, order, and state with Tailwind

Tailwind utilities affect not only presentation but also focus indicators, reading order, and hidden state. Before adding class names, establish the correct DOM order and state attributes, then make the styles follow that contract.

## Always pair `outline-none` with a visible focus indicator

Using `outline-none` alone makes keyboard users lose track of their current position. When replacing it with a custom outline or ring, use `focus-visible` with enough thickness and offset to contrast against the background.

**Incorrect**

```tsx
export function SaveButton() {
  return (
    <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white outline-none">
      Save
    </button>
  );
}
```

**Fixed**

```tsx
export function SaveButton() {
  return (
    <button
      type="submit"
      className="rounded bg-blue-700 px-4 py-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
    >
      Save
    </button>
  );
}
```

If the theme changes the `ring` color, confirm that it remains visible against both light and dark backgrounds.

## Do not separate visual order from DOM order

`order-*`, `flex-row-reverse`, and `flex-col-reverse` change only the visual order. Screen reader reading order and Tab order still follow the DOM. Do not use them in layouts where the order changes how content is understood or operated; arrange the JSX in the intended order instead.

**Incorrect**

```tsx
export function AccountActions() {
  return (
    <nav className="flex flex-row-reverse gap-4" aria-label="Account">
      <a href="/profile">Profile</a>
      <a href="/billing">Billing</a>
      <a href="/support">Support</a>
    </nav>
  );
}
```

The screen shows Support → Billing → Profile, but Tab moves through Profile → Billing → Support.

**Fixed**

```tsx
export function AccountActions() {
  return (
    <nav className="flex gap-4" aria-label="Account">
      <a href="/support">Support</a>
      <a href="/billing">Billing</a>
      <a href="/profile">Profile</a>
    </nav>
  );
}
```

Keep one valid DOM order even in responsive layouts, except when changing only the position of a decorative image or making another change that does not affect meaning, reading order, or focus order.

## Use `sr-only` for visually hidden labels

Do not remove labels even from forms with limited display space. `sr-only` visually hides a label while preserving it in the accessibility tree. A placeholder disappears when users enter a value, so it cannot replace a name.

**Incorrect**

```tsx
export function SearchField() {
  return <input type="search" name="query" placeholder="Search" className="rounded border px-3 py-2" />;
}
```

**Fixed**

```tsx
export function SearchField() {
  return (
    <div>
      <label htmlFor="site-search" className="sr-only">Search the site</label>
      <input
        id="site-search"
        name="query"
        type="search"
        className="rounded border px-3 py-2"
      />
    </div>
  );
}
```

## Do not leave closed panels focusable

Animation utilities such as `opacity-0` and `pointer-events-none` do not reliably remove elements from the Tab order or accessibility tree. Do not rely on `invisible` alone to convey display state either. Hide a closed interactive panel with the HTML `hidden` attribute, conditional rendering, or a `hidden` class synchronized with state.

**Incorrect**

```tsx
export function ActionPanel({ open }: { open: boolean }) {
  return (
    <div className={open ? "opacity-100" : "pointer-events-none opacity-0"}>
      <a href="/settings">Settings</a>
      <button type="button">Sign out</button>
    </div>
  );
}
```

**Fixed**

```tsx
export function ActionPanel({ open }: { open: boolean }) {
  return (
    <div
      hidden={!open}
      data-state={open ? "open" : "closed"}
      className="transition-opacity data-[state=open]:opacity-100"
    >
      <a href="/settings">Settings</a>
      <button type="button">Sign out</button>
    </div>
  );
}
```

`className={open ? "block" : "hidden"}` can also switch from the same state. However, do not make the HTML `hidden` attribute compete with a `block` or `flex` utility on the same element. Derive visibility, operability, and DOM state from one value.

## Avoid small text in fixed pixels

A fixed pixel value such as `text-[12px]` falls outside the project's type scale and may not respond well to the user's base font size. Use Tailwind's standard rem-based sizes, and specify custom values in rem when necessary.

**Incorrect**

```tsx
export function HelpText() {
  return <p className="text-[12px] text-slate-600">Passwords must contain 12 characters.</p>;
}
```

**Fixed**

```tsx
export function HelpText() {
  return <p className="text-sm text-slate-600">Passwords must contain 12 characters.</p>;
}
```

If the existing scale does not include the value, express it in rem, such as `text-[0.75rem]`. Do not make text too small, and test browser zoom and a changed default font size.

## Make styles follow DOM state attributes

Do not create a separate, presentation-only `isOpen` class. Reference meaningful `aria-*` attributes or library-generated `data-*` attributes from Tailwind variants. This gives the state visible to users and the state read by agents the same source of truth.

**Incorrect**

```tsx
import { ChevronDown } from "lucide-react";

export function DisclosureButton({ open }: { open: boolean }) {
  return (
    <button type="button" className="flex items-center gap-2">
      Details
      <ChevronDown className={open ? "rotate-180" : "rotate-0"} />
    </button>
  );
}
```

The presentation changes, but neither the DOM nor the accessibility tree exposes the button's expanded state.

**Fixed**

```tsx
import { ChevronDown } from "lucide-react";

export function DisclosureButton({ open }: { open: boolean }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="details-panel"
      className="group flex items-center gap-2"
    >
      Details
      <ChevronDown
        aria-hidden="true"
        className="transition-transform group-aria-expanded:rotate-180"
      />
    </button>
  );
}
```

Use `aria-expanded:rotate-180` when rotating the same element. For primitives such as Radix, you can use `data-[state=open]:...` directly.

```tsx
import * as Accordion from "@radix-ui/react-accordion";

export function DetailsAccordion() {
  return (
    <Accordion.Root type="single" collapsible>
      <Accordion.Item value="details" className="data-[state=open]:border-blue-600">
        <Accordion.Header>
          <Accordion.Trigger>Details</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="data-[state=open]:animate-accordion-down">
          Project details
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
```

Tailwind variants do not generate attributes. First emit the correct `aria-*` / `data-*` attributes from a primitive or React state, then use those attributes as styling conditions.

## Static rules

`static` reports common problems with these rules.

| Rule | Main finding |
| --- | --- |
| `anw/jsx-tailwind-focus` | `outline-none` without an alternative visible focus indicator |
| `anw/jsx-tailwind-order` | `order-*`, `flex-row-reverse`, or `flex-col-reverse` that can separate visual order from reading or Tab order |
| `anw/jsx-tailwind-fixed-text` | An arbitrary fixed-pixel font size such as `text-[12px]` |

Run the skill directory's CLI against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
```

After fixing findings, also inspect keyboard interaction and the final DOM in the browser. Static rules alone cannot establish ring contrast, semantically correct reading order, or whether a closed panel is actually unreachable by focus.

## References

- [Tailwind CSS: Hover, focus, and other states](https://tailwindcss.com/docs/hover-focus-and-other-states)
- [Tailwind CSS: Display, including sr-only](https://tailwindcss.com/docs/display)
- [Radix UI: Accordion](https://www.radix-ui.com/primitives/docs/components/accordion)
