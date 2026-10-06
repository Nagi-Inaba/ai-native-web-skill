import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../shared/skill/scripts/lib/static/analyze.mjs";
import { openSession } from "../shared/skill/scripts/lib/browser/session.mjs";
import { runAxe, toggleCheck } from "../shared/skill/scripts/lib/browser/probes.mjs";
import { loadRecipes } from "../shared/skill/scripts/lib/recipes.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";
import { serveDirectory } from "./helpers/serve.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const patternsDir = path.join(root, "..", "shared", "skill", "references", "patterns");
const fixturesDir = path.join(root, "fixtures", "patterns");
const patternIds = [
  "disclosure-menu",
  "modal-dialog",
  "tabs",
  "form-with-errors",
  "native-form-controls",
  "data-table-and-images",
  "repeated-items",
  "route-change-focus",
  "async-status"
];
const skipBrowser = !(await chromeAvailable()) && "Chrome not available";

function exampleUnder(markdown, heading, language) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const fence = "```";
  const match = markdown.match(new RegExp(`^## ${escapedHeading}\\r?\\n\\r?\\n${fence}${language}\\r?\\n([\\s\\S]*?)\\r?\\n${fence}`, "mu"));
  assert.ok(match, `${heading} ${language} code block not found`);
  return `${match[1].replaceAll("\r\n", "\n")}\n`;
}

function documentedAfterSnapshot(id) {
  const markdown = fs.readFileSync(path.join(patternsDir, `${id}.md`), "utf8");
  const snapshots = [...markdown.matchAll(/```yaml\r?\n([\s\S]*?)\r?\n```/gu)];
  assert.equal(snapshots.length, 2, `${id}: before/after YAML snapshots`);
  return snapshots[1][1].replaceAll("\r\n", "\n");
}

for (const id of patternIds) {
  test(`${id}: documented examples and fixtures are byte-identical`, () => {
    const markdown = fs.readFileSync(path.join(patternsDir, `${id}.md`), "utf8");
    const headings = [
      "## When to use",
      "## DOM and accessibility tree contract",
      "## HTML",
      "## React",
      "## Keyboard",
      "## Common mistakes and fixes",
      "## Verify",
      "## References"
    ];
    let previous = -1;
    for (const heading of headings) {
      const position = markdown.indexOf(heading);
      assert.ok(position > previous, `${id}: missing or out-of-order ${heading}`);
      previous = position;
    }
    assert.equal((markdown.match(/```yaml/gu) ?? []).length, 2, `${id}: before/after YAML snapshots`);
    assert.match(markdown, /https:\/\/www\.w3\.org\/WAI\/ARIA\/apg\//u);
    const html = exampleUnder(markdown, "HTML", "html");
    const react = exampleUnder(markdown, "React", "tsx");
    assert.match(html, /^<!doctype html>/u);
    assert.match(react, /export default function/u);
    assert.equal(fs.readFileSync(path.join(fixturesDir, id, "index.html"), "utf8"), html);
    assert.equal(fs.readFileSync(path.join(fixturesDir, id, "Example.tsx"), "utf8"), react);
  });
}

test("pattern fixtures have no confirmed static findings", async () => {
  const { findings } = await analyzeProject(fixturesDir);
  assert.deepEqual(findings.filter((finding) => finding.certainty === "confirmed"), []);
});

test("recipe pattern ids and pattern files reference each other", () => {
  const recipes = loadRecipes();
  const referenced = new Set(recipes.flatMap((recipe) => recipe.patterns));
  for (const recipe of recipes) {
    assert.ok(Array.isArray(recipe.patterns), `${recipe.id} patterns`);
    for (const id of recipe.patterns) {
      assert.ok(fs.existsSync(path.join(patternsDir, `${id}.md`)), `${recipe.id}: missing ${id}.md`);
    }
  }
  for (const id of patternIds) assert.ok(referenced.has(id), `${id} is not referenced by a recipe`);
});

async function withPattern(id, run) {
  const server = await serveDirectory(fixturesDir);
  const session = await openSession(`${server.url}/${id}/index.html`);
  try {
    await run(session);
  } finally {
    await session.close();
    await server.close();
  }
}

const afterChecks = {
  "native-form-controls": async (session) => {
    const page = session.page;
    const email = page.getByRole("textbox", { name: "Email address" });
    assert.equal(await email.isDisabled(), true);
    assert.equal(await page.locator("#preferences").evaluate((form) => new FormData(form).has("email")), false);
    await page.getByRole("radio", { name: "Standard", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.getByRole("radio", { name: "Express", exact: true }).isChecked(), true);
    assert.equal(await page.getByRole("radio", { name: "Standard", exact: true }).isChecked(), false);
    const updates = page.getByRole("checkbox", { name: "Email updates" });
    await updates.focus();
    await page.keyboard.press("Space");
    assert.equal(await email.isDisabled(), false);
    assert.equal(await email.getAttribute("required"), "");
    await email.fill("reader@example.com");
    await page.getByRole("combobox", { name: "Region" }).selectOption("Asia");
    const save = page.getByRole("button", { name: "Save preferences" });
    await save.click();
    assert.equal(await save.evaluate((node) => node === document.activeElement), true);
    assert.equal(await page.locator("#preferences").evaluate((form) => new FormData(form).get("email")), "reader@example.com");
    await updates.uncheck();
    assert.equal(await email.isDisabled(), true);
    assert.equal(await email.getAttribute("required"), null);
    assert.equal(await page.locator("#preferences").evaluate((form) => new FormData(form).has("email")), false);
    await save.click();
    assert.equal(await page.getByRole("status").textContent(), "Saved Express delivery in Asia without email updates.");
    await updates.check();
    await save.click();
  },
  "data-table-and-images": async (session) => {
    const page = session.page;
    assert.equal(await page.getByRole("img").count(), 1);
    assert.equal(await page.locator('img[alt=""]').count(), 1);
    assert.equal(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true);
    const table = page.getByRole("table", { name: "Completed tasks by month" });
    assert.equal(await table.getByRole("columnheader").count(), 2);
    assert.equal(await table.getByRole("rowheader").count(), 2);
    assert.deepEqual(await table.locator("th").evaluateAll((headers) => headers.map((header) => header.getAttribute("scope"))), ["col", "col", "row", "row"]);
    assert.equal(await table.getByRole("row", { name: "May 7", exact: true }).count(), 1);
  },
  "disclosure-menu": async (session) => {
    const toggle = await toggleCheck(session, "#menu-button");
    assert.deepEqual(toggle.issues, []);
    assert.deepEqual([toggle.before.expanded, toggle.after.expanded, toggle.after.visible], [false, true, true]);
    await session.page.locator("#menu-button").click();
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /button "Categories" \[expanded\]/u);
    assert.match(snapshot, /link "New arrivals"/u);
  },
  "modal-dialog": async (session) => {
    await session.page.locator("#open-dialog").click();
    assert.equal(await session.page.locator("#dialog-title").evaluate((node) => node === document.activeElement), true);
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /dialog "Confirm shipping address"/u);
    assert.match(snapshot, /button "Confirm"/u);
    await session.page.keyboard.press("Escape");
    assert.equal(await session.page.locator("#open-dialog").evaluate((node) => node === document.activeElement), true);
    await session.page.locator("#open-dialog").click();
  },
  tabs: async (session) => {
    await session.page.locator("#tab-overview").focus();
    await session.page.keyboard.press("ArrowRight");
    assert.equal(await session.page.locator("#tab-specs").getAttribute("aria-selected"), "true");
    assert.equal(await session.page.locator("#tab-specs").getAttribute("tabindex"), "0");
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /tab "Specifications" \[selected\]/u);
    assert.match(snapshot, /tabpanel "Specifications"/u);
    assert.match(snapshot, /It weighs 1\.2 kg\./u);
  },
  "form-with-errors": async (session) => {
    await session.page.locator("#submit-button").click();
    assert.equal(await session.page.locator("#email").getAttribute("aria-invalid"), "true");
    assert.equal(await session.page.locator("#email").evaluate((node) => node === document.activeElement), true);
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /alert/u);
    assert.match(snapshot, /Enter your email address\./u);
  },
  "repeated-items": async (session) => {
    await session.page.locator('[aria-label="Edit: Product A"]').click();
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /button "Edit: Product A" \[pressed\]/u);
    assert.match(snapshot, /status/u);
    assert.match(snapshot, /Editing Product A\./u);
  },
  "route-change-focus": async (session) => {
    await session.page.locator('a[href="/products"]').click();
    assert.equal(await session.page.title(), "Product list | Example Store");
    assert.match(session.page.url(), /\/products$/u);
    assert.equal(await session.page.locator("h1").evaluate((node) => node === document.activeElement), true);
    assert.equal(await session.page.locator('a[href="/products"]').getAttribute("aria-current"), "page");
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /link "Products"/u);
    assert.match(snapshot, /heading "Product list" \[level=1\]/u);
    assert.match(snapshot, /Showing all products\./u);
  },
  "async-status": async (session) => {
    await session.page.locator("#category").selectOption("sale");
    const busy = await session.page.locator("#filter-form").evaluate((form) => {
      form.requestSubmit();
      return document.querySelector("#results")?.getAttribute("aria-busy");
    });
    assert.equal(busy, "true");
    await session.page.waitForFunction(() => document.querySelector("#results")?.getAttribute("aria-busy") === "false");
    assert.match(session.page.url(), /[?&]category=sale(?:&|$)/u);
    const snapshot = await session.page.locator("body").ariaSnapshot();
    assert.match(snapshot, /status/u);
    assert.match(snapshot, /2 results found\./u);
    assert.match(snapshot, /Sale product A/u);
    await session.page.reload();
    await session.page.waitForFunction(() => document.querySelector("#results")?.getAttribute("aria-busy") === "false");
    assert.equal(await session.page.locator("#category").inputValue(), "sale");
    assert.match(await session.page.locator("body").ariaSnapshot(), /2 results found\./u);
  }
};

for (const id of patternIds) {
  test(`${id}: documented after state is exposed and axe passes`, { skip: skipBrowser }, async () => {
    await withPattern(id, async (session) => {
      await afterChecks[id](session);
      assert.equal((await session.page.locator("body").ariaSnapshot()).trimEnd(), documentedAfterSnapshot(id).trimEnd());
      assert.deepEqual(await runAxe(session), []);
    });
  });
}
