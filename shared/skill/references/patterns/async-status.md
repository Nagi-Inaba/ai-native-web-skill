# Asynchronous status (`async-status`)

## When to use

Use this pattern for searches, filters, saves, and other operations with a delay between the action and its result. Distinguish loading, success, empty results, and failure in both the visual display and DOM state.

## DOM and accessibility tree contract

Set `aria-busy="true"` only on the results region while it is loading, and place a short progress or completion message in a separate `role="status"`. Use `role="alert"` for failure messages. Keep the result content as a regular heading and list. Do not add `aria-live` to the entire results region. Store the filter value in a URL query parameter so reloads, sharing, and history navigation can restore the state.

### Before

```yaml
- main:
  - heading "Product search" [level=1]
  - text: Category
  - combobox "Category":
    - option "All" [selected]
    - option "Sale"
    - option "Simulate an error"
  - button "Filter"
  - status: 3 results found.
  - region "Search results":
    - heading "Search results" [level=2]
    - list:
      - listitem: Regular product
      - listitem: Sale product A
      - listitem: Sale product B
```

### After

```yaml
- main:
  - heading "Product search" [level=1]
  - text: Category
  - combobox "Category":
    - option "All"
    - option "Sale" [selected]
    - option "Simulate an error"
  - button "Filter"
  - status: 2 results found.
  - region "Search results":
    - heading "Search results" [level=2]
    - list:
      - listitem: Sale product A
      - listitem: Sale product B
```

While loading, the results region has `aria-busy="true"` and the status reads “Searching.” On completion, busy returns to false and the status reports the result count. The HTML example also restores the query parameter on initial load and back or forward navigation. In the React example, `category` is read from the URL and `updateCategory` is a router adapter that updates the URL. Use `useSearchParams` with `router.push` in the Next.js App Router, or `useSearchParams` in React Router, to preserve the same query parameter contract.

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product search</title>
</head>
<body>
  <main>
    <h1>Product search</h1>
    <form id="filter-form">
      <label for="category">Category</label>
      <select id="category" name="category">
        <option value="all">All</option>
        <option value="sale">Sale</option>
        <option value="error">Simulate an error</option>
      </select>
      <button type="submit">Filter</button>
    </form>
    <p id="search-status" role="status">3 results found.</p>
    <p id="search-error" role="alert" hidden></p>
    <section id="results" aria-labelledby="results-heading" aria-busy="false">
      <h2 id="results-heading">Search results</h2>
      <ul><li>Regular product</li><li>Sale product A</li><li>Sale product B</li></ul>
    </section>
  </main>
  <script>
    const form = document.querySelector("#filter-form");
    const category = document.querySelector("#category");
    const results = document.querySelector("#results");
    const list = results.querySelector("ul");
    const status = document.querySelector("#search-status");
    const error = document.querySelector("#search-error");

    function categoryFromUrl() {
      const value = new URLSearchParams(location.search).get("category");
      return ["all", "sale", "error"].includes(value) ? value : "all";
    }

    function runSearch(value, updateUrl) {
      if (updateUrl) history.pushState({}, "", `?category=${encodeURIComponent(value)}`);
      results.setAttribute("aria-busy", "true");
      status.textContent = "Searching.";
      error.hidden = true;

      setTimeout(() => {
        results.setAttribute("aria-busy", "false");
        if (value === "error") {
          error.textContent = "Search failed. Try again.";
          error.hidden = false;
          status.textContent = "Search could not be completed.";
          return;
        }
        const items = value === "sale" ? ["Sale product A", "Sale product B"] : ["Regular product", "Sale product A", "Sale product B"];
        list.replaceChildren(...items.map((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          return li;
        }));
        status.textContent = `${items.length} results found.`;
      }, 50);
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch(category.value, true);
    });
    window.addEventListener("popstate", () => {
      category.value = categoryFromUrl();
      runSearch(category.value, false);
    });

    category.value = categoryFromUrl();
    if (category.value !== "all") runSearch(category.value, false);
  </script>
</body>
</html>
```

## React

```tsx
"use client";

import { useState } from "react";
import type { FormEvent } from "react";

type Category = "all" | "sale" | "error";
type Props = {
  category: Category;
  updateCategory: (category: Category) => void;
};

const allItems = ["Regular product", "Sale product A", "Sale product B"];

async function search(category: Category) {
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (category === "error") throw new Error("Search failed");
  return category === "sale" ? allItems.slice(1) : allItems;
}

export default function AsyncStatus({ category, updateCategory }: Props) {
  const [items, setItems] = useState(allItems);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("3 results found.");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Searching.");
    setError("");
    try {
      const nextItems = await search(category);
      setItems(nextItems);
      setStatus(`${nextItems.length} results found.`);
    } catch {
      setError("Search failed. Try again.");
      setStatus("Search could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={submit}>
        <label htmlFor="category">Category</label>
        <select id="category" name="category" value={category} onChange={(event) => updateCategory(event.target.value as Category)}>
          <option value="all">All</option>
          <option value="sale">Sale</option>
          <option value="error">Simulate an error</option>
        </select>
        <button type="submit">Filter</button>
      </form>
      <p role="status">{status}</p>
      <p role="alert" hidden={!error}>{error}</p>
      <section aria-labelledby="results-heading" aria-busy={loading}>
        <h2 id="results-heading">Search results</h2>
        <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
    </>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Move through the filter and submit button. |
| ArrowUp / ArrowDown | Change the selected option in the `select`. |
| Enter / Space | Submit and receive status updates without moving focus. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Making the entire results container `aria-live`. | Make only a short, dedicated status a live region and keep results in their normal structure. |
| Showing a loading indicator without updating `aria-busy`. | Synchronize network start and completion with the DOM attribute in `try/finally`. |
| Keeping the filter only in component state. | Reflect it in a query parameter and restore the initial value from the URL. |
| Leaving a stale “Searching” message after failure. | Return busy to false and update both the status and alert to a completed state. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route-containing-this-component>
```

Delay requests and force failures. Check every state—loading, success, empty results, and failure—along with the query parameter.

## References

- [WAI-ARIA APG: Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- [WAI-ARIA APG: Feed Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)
