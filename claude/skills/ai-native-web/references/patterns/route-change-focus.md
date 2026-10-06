# Focus on route change (`route-change-focus`)

## When to use

Use this pattern in client-side routing when the URL changes but the context change is not announced automatically as it would be during regular browser navigation.

## DOM and accessibility tree contract

After the route resolves, update `document.title`, the navigation's `aria-current="page"`, and the main heading from the same route state. Do not move focus on initial display. Move focus to the `h1` with `tabindex="-1"` only when the route changes. Apply the same process to back and forward navigation.

### Before

```yaml
- banner:
  - navigation "Main":
    - link "Home":
      - /url: /
    - link "Products":
      - /url: /products
- main:
  - heading "Home" [level=1]
  - paragraph: Explore our featured products.
```

In the DOM, only the “Home” link has `aria-current="page"`.

### After

```yaml
- banner:
  - navigation "Main":
    - link "Home":
      - /url: /
    - link "Products":
      - /url: /products
- main:
  - heading "Product list" [level=1]
  - paragraph: Showing all products.
```

In the DOM, the URL is `/products`, the title is “Product list | Example Store,” the “Products” link has `aria-current="page"`, and `document.activeElement` is the `h1`. Playwright's YAML does not expose `aria-current` or focus itself in current browsers, so use DOM assertions for these conditions.

The React example is router-independent. With the Next.js App Router, pass `currentPath={usePathname()}` and `navigate={router.push}`. With Vite and React Router, pass `currentPath={location.pathname}` and `navigate={navigate}`. Also set the initial title with the Metadata API in Next.js or route data in Vite so it matches client-side updates.

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Home | Example Store</title>
</head>
<body>
  <header>
    <nav aria-label="Main">
      <a href="/" aria-current="page">Home</a>
      <a href="/products">Products</a>
    </nav>
  </header>
  <main id="main">
    <h1 tabindex="-1">Home</h1>
    <p>Explore our featured products.</p>
  </main>
  <script>
    const routes = {
      "/": { title: "Home | Example Store", heading: "Home", body: "Explore our featured products." },
      "/products": { title: "Product list | Example Store", heading: "Product list", body: "Showing all products." }
    };
    const heading = document.querySelector("h1");
    const description = document.querySelector("main p");

    function render(path, moveFocus) {
      const route = routes[path] || routes["/"];
      document.title = route.title;
      heading.textContent = route.heading;
      description.textContent = route.body;
      for (const link of document.querySelectorAll("nav a")) {
        if (link.getAttribute("href") === path) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
      if (moveFocus) heading.focus();
    }

    document.querySelector("nav").addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      event.preventDefault();
      const path = link.getAttribute("href");
      history.pushState({}, "", path);
      render(path, true);
    });
    window.addEventListener("popstate", () => render(location.pathname, true));
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";

type RoutePath = "/" | "/products";
type Props = {
  currentPath: string;
  navigate: (path: RoutePath) => void;
};

const routes = {
  "/": { title: "Home | Example Store", heading: "Home", body: "Explore our featured products." },
  "/products": { title: "Product list | Example Store", heading: "Product list", body: "Showing all products." }
};

export default function RouteChangeFocus({ currentPath, navigate }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(currentPath);
  const route = currentPath === "/products" ? routes["/products"] : routes["/"];

  useEffect(() => {
    document.title = route.title;
    if (previousPath.current !== currentPath) headingRef.current?.focus();
    previousPath.current = currentPath;
  }, [currentPath, route.title]);

  function follow(event: MouseEvent<HTMLAnchorElement>, path: RoutePath) {
    event.preventDefault();
    navigate(path);
  }

  return (
    <>
      <nav aria-label="Main">
        <a href="/" aria-current={currentPath === "/" ? "page" : undefined} onClick={(event) => follow(event, "/")}>Home</a>
        <a href="/products" aria-current={currentPath === "/products" ? "page" : undefined} onClick={(event) => follow(event, "/products")}>Products</a>
      </nav>
      <main>
        <h1 ref={headingRef} tabIndex={-1}>{route.heading}</h1>
        <p>{route.body}</p>
      </main>
    </>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Move through links in their normal order. |
| Enter | Follow the link and move focus to the new `h1` when navigation completes. |
| Alt+Left / Alt+Right | Restore the corresponding title, current location, and `h1` after history navigation. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Leaving focus on the activated link after the route changes. | Move it to the new main heading after rendering completes. |
| Focusing the `h1` on every render. | Compare the previous route key and do not move focus on initial render or same-route updates. |
| Leaving either the title or `aria-current` stale. | Treat the URL as the single route state and synchronize all three locations. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

After following links and navigating through history, check the URL, title, `aria-current`, `h1`, and `activeElement`.

## References

- [WAI-ARIA APG: Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [WCAG 2.2: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
