# Data tables and image alternatives (`data-table-and-images`)

## When to use

Use this pattern when an image or chart conveys information that also needs to be readable as text, or when values form a simple data table. Decide what an image means in its page context before writing its alternative. Decorative images have an empty alt; informative images have a useful alternative and a nearby summary or data table when details matter.

## DOM and accessibility tree contract

Keep the summary visible. Give a data table a caption, column headers with scope="col", and row headers with scope="row". Use real table markup rather than a visual grid of divs. The chart image has an alt that identifies its purpose and points readers to the adjacent values; the decorative dot has alt="". This example uses two small SVG images authored for this project and embedded as data URLs, with no external request. The React version has the same relationships. Complex or sortable tables need additional design beyond this simple example.

### Before

```yaml
- main:
  - heading "Completed tasks" [level=1]
  - img
  - text: April 4 May 7
```

### After

```yaml
- main:
  - heading "Completed tasks" [level=1]
  - figure "Completed tasks increased from 4 in April to 7 in May.":
    - img "Completed tasks by month; exact values are in the table."
    - text: Completed tasks increased from 4 in April to 7 in May.
  - table "Completed tasks by month":
    - caption: Completed tasks by month
    - rowgroup:
      - row "Month Completed tasks":
        - columnheader "Month"
        - columnheader "Completed tasks"
    - rowgroup:
      - row "April 4":
        - rowheader "April"
        - cell "4"
      - row "May 7":
        - rowheader "May"
        - cell "7"
```

## HTML

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Completed tasks</title>
  <style>body{font:1rem/1.5 system-ui;margin:1.5rem;max-width:42rem}fieldset{margin:1rem 0}label{display:block;margin:.5rem 0}button,input,select{font:inherit}button{min-height:2rem}:focus-visible{outline:3px solid #005fcc;outline-offset:3px}img{max-width:100%;height:auto}table{border-collapse:collapse}th,td{padding:.5rem;border:1px solid #666;text-align:left}</style>
</head>
<body>
  <main>
    <h1><img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%226%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E" alt="" width="16" height="16"> Completed tasks</h1>
    <figure>
      <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20100%22%3E%3Crect%20x%3D%2220%22%20y%3D%2255%22%20width%3D%2250%22%20height%3D%2240%22%20fill%3D%22%23234%22%2F%3E%3Crect%20x%3D%22110%22%20y%3D%2225%22%20width%3D%2250%22%20height%3D%2270%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E" alt="Completed tasks by month; exact values are in the table." width="200" height="100">
      <figcaption>Completed tasks increased from 4 in April to 7 in May.</figcaption>
    </figure>
    <table>
      <caption>Completed tasks by month</caption>
      <thead><tr><th scope="col">Month</th><th scope="col">Completed tasks</th></tr></thead>
      <tbody>
        <tr><th scope="row">April</th><td>4</td></tr>
        <tr><th scope="row">May</th><td>7</td></tr>
      </tbody>
    </table>
  </main>
</body>
</html>
```

## React

```tsx
"use client";

const chart = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20100%22%3E%3Crect%20x%3D%2220%22%20y%3D%2255%22%20width%3D%2250%22%20height%3D%2240%22%20fill%3D%22%23234%22%2F%3E%3Crect%20x%3D%22110%22%20y%3D%2225%22%20width%3D%2250%22%20height%3D%2270%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E";
const decoration = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Ccircle%20cx%3D%228%22%20cy%3D%228%22%20r%3D%226%22%20fill%3D%22%23234%22%2F%3E%3C%2Fsvg%3E";

export default function DataTableAndImages() {
  return (
    <main>
      <h1><img src={decoration} alt="" width="16" height="16" /> Completed tasks</h1>
      <figure>
        <img src={chart} alt="Completed tasks by month; exact values are in the table." width="200" height="100" />
        <figcaption>Completed tasks increased from 4 in April to 7 in May.</figcaption>
      </figure>
      <table>
        <caption>Completed tasks by month</caption>
        <thead><tr><th scope="col">Month</th><th scope="col">Completed tasks</th></tr></thead>
        <tbody>
          <tr><th scope="row">April</th><td>4</td></tr>
          <tr><th scope="row">May</th><td>7</td></tr>
        </tbody>
      </table>
    </main>
  );
}
```

## Keyboard

| Key | Behavior |
| --- | --- |
| Tab / Shift+Tab | Skip these static images and cells; do not give them tabindex. |
| Assistive technology reading commands | Inspect the image alternative, summary, caption, and row/column headers. |

## Common mistakes and fixes

| Mistake | Fix |
| --- | --- |
| Naming an image only by its filename or saying "chart". | Describe the information needed in this context and expose detailed values nearby. |
| Removing all alt attributes to avoid repetition. | Use alt="" only for decoration; keep informative alternatives. |
| Styling ordinary cells as headers. | Use th with scope and a caption for a simple table. |
| Using a table to arrange page layout. | Use CSS for layout and table markup for tabular data. |

## Verify

Run the skill directory's `scripts/cli.mjs` against your project.

```sh
node <skill-dir>/scripts/cli.mjs static <project-dir>
node <skill-dir>/scripts/cli.mjs check --dev <project-dir> --path <route>
```

This example has no state-changing interaction: the After snapshot is the fixed document after the semantic repair. Confirm that there is one named image, the decorative image is absent from the accessibility tree, and each value has row and column headers. Review whether the alternative and summary convey the intended meaning in the actual product; automated checks cannot judge that wording. Check a real screen reader and zoom manually. Do not treat the simple table as a complete pattern for complex headers, sorting, or video captions.

## References

- [WAI: Images Tutorial](https://www.w3.org/WAI/tutorials/images/)
- [WAI: Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/)
- [WAI-ARIA APG: Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- [HTML: table element](https://html.spec.whatwg.org/multipage/tables.html#the-table-element)
