import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import axe from "axe-core";
import { fileURLToPath } from "node:url";
import { openSession } from "../shared/skill/scripts/lib/browser/session.mjs";
import { tabWalk, toggleCheck, runAxe, reflowCheck, reducedMotionCheck, axeRecipe } from "../shared/skill/scripts/lib/browser/probes.mjs";
import { serveDirectory } from "./helpers/serve.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";

const browserFixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "browser");
const skip = !(await chromeAvailable()) && "Chrome not available";

async function withPage(file, fn) {
  const server = await serveDirectory(browserFixtures);
  const session = await openSession(`${server.url}/${file}`);
  try {
    return await fn(session, `${server.url}/${file}`);
  } finally {
    await session.close();
    await server.close();
  }
}

test("axe rule ids map to recipes", () => {
  assert.equal(axeRecipe("image-alt"), "content-equivalence");
  assert.equal(axeRecipe("button-name"), "control-name-and-purpose");
  assert.equal(axeRecipe("color-contrast"), "visual-perception");
  assert.equal(axeRecipe("landmark-one-main"), "discoverable-structure");
  assert.equal(axeRecipe("aria-allowed-attr"), "action-semantics");
  assert.equal(axeRecipe("unknown-rule"), null);
});

test("every axe rule enabled by runAxe maps to a recipe", () => {
  const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
  const unmapped = axe.getRules(tags).map((rule) => rule.ruleId).filter((ruleId) => axeRecipe(ruleId) === null);
  assert.deepEqual(unmapped, []);
});

test("good page passes every probe", { skip }, async () => {
  await withPage("good.html", async (session, url) => {
    assert.deepEqual(await runAxe(session), []);
    assert.deepEqual(await reflowCheck(session), []);
    const tab = await tabWalk(session);
    assert.deepEqual(tab.entries.map((e) => [e.role, e.name]), [["link", "本文へ"], ["button", "メニュー"], ["searchbox", "検索"]]);
    assert.deepEqual(tab.issues, []);
    const toggle = await toggleCheck(session, "#menu");
    assert.deepEqual(toggle.issues, []);
    assert.deepEqual([toggle.before.expanded, toggle.after.expanded, toggle.after.visible], [false, true, true]);
    assert.deepEqual(await reducedMotionCheck(url), []);
  });
});

test("toggle check reads the trigger after focus moves and verifies restoration", { skip }, async () => {
  await withPage("toggle-focus-move.html", async (session) => {
    const toggle = await toggleCheck(session, "#disclosure");
    assert.deepEqual(toggle.issues, []);
    assert.deepEqual(toggle.before, { expanded: false, visible: false });
    assert.deepEqual(toggle.after, { expanded: true, visible: true });
    assert.deepEqual(toggle.restored, { expanded: false, visible: false });
  });
});

test("toggle check reports a disclosure that opens but cannot close", { skip }, async () => {
  await withPage("toggle-cannot-close.html", async (session) => {
    const toggle = await toggleCheck(session, "#disclosure");
    assert.deepEqual(toggle.after, { expanded: true, visible: true });
    assert.deepEqual(toggle.restored, { expanded: true, visible: true });
    assert.ok(toggle.issues.some((issue) => /second activation|original/u.test(issue.message)));
  });
});

test("tab walk compares focused and unfocused computed styles", { skip }, async () => {
  await withPage("focus-indicators.html", async (session) => {
    const tab = await tabWalk(session);
    assert.deepEqual(tab.entries.map((entry) => [entry.element, entry.focusIndicator]), [
      ["button#border-focus", true],
      ["button#constant-shadow", false]
    ]);
    assert.ok(tab.issues.some((issue) => issue.target === "button#constant-shadow" && issue.recipe === "visual-perception"));
    assert.ok(!tab.issues.some((issue) => issue.target === "button#border-focus"));
  });
});

test("bad page reports each seeded defect with its recipe", { skip }, async () => {
  await withPage("bad.html", async (session, url) => {
    const axeIssues = await runAxe(session);
    assert.ok(axeIssues.some((i) => i.ruleId === "image-alt" && i.recipe === "content-equivalence"));
    const reflow = await reflowCheck(session);
    assert.equal(reflow[0].recipe, "visual-perception");
    const tab = await tabWalk(session);
    assert.ok(tab.issues.some((i) => i.target === "button#icon-btn" && i.recipe === "control-name-and-purpose"));
    assert.ok(tab.issues.some((i) => i.target === "button#plain-btn" && i.recipe === "visual-perception"));
    const toggle = await toggleCheck(session, "#stuck");
    assert.ok(toggle.issues.length >= 2);
    assert.ok(toggle.issues.every((i) => i.recipe === "state-focus-sync"));
    assert.ok(toggle.issues.some((i) => /first activation/u.test(i.message)));
    assert.ok(toggle.issues.some((i) => /second activation/u.test(i.message)));
    const motion = await reducedMotionCheck(url);
    assert.equal(motion[0].recipe, "visual-perception");
  });
});
