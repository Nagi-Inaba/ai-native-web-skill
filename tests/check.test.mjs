import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBrowserChecks } from "../shared/skill/scripts/lib/browser/check.mjs";
import { serveDirectory } from "./helpers/serve.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";
import { toMarkdown, issueCount } from "../shared/skill/scripts/lib/report.mjs";
import { chromium } from "playwright-core";

const browserFixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "browser");
const skip = !(await chromeAvailable()) && "Chrome not available";

test("runBrowserChecks returns outline, tab path, toggles and merged issues", { skip }, async () => {
  const server = await serveDirectory(browserFixtures);
  try {
    const result = await runBrowserChecks(`${server.url}/bad.html`, { toggles: ["#stuck"] });
    assert.equal(result.kind, "browser");
    assert.equal(result.schema_version, "2.0.0");
    assert.equal(result.pages.length, 1);
    const report = result.pages[0];
    for (const field of ["url", "outline", "tab", "toggles", "blockedRequests", "issues"]) {
      assert.deepEqual(result[field], report[field], `single-page compatibility: ${field}`);
    }
    assert.match(report.outline, /heading "悪い例" \[level=1\]/u);
    assert.ok(report.tab.length >= 3);
    assert.equal(report.toggles.length, 1);
    const checks = new Set(report.issues.map((i) => i.check));
    for (const check of ["axe", "reflow", "tab", "toggle", "reduced-motion"]) assert.ok(checks.has(check), check);
  } finally {
    await server.close();
  }
});

test("check resolves each path against the base URL and retains per-page results", { skip }, async () => {
  const server = await serveDirectory(browserFixtures);
  try {
    const report = await runBrowserChecks(`${server.url}/nested/`, { paths: ["../good.html", "/bad.html?case=2"], tabSteps: 5 });
    assert.equal(report.schema_version, "2.0.0");
    assert.deepEqual(report.pages.map((page) => page.url), [`${server.url}/good.html`, `${server.url}/bad.html?case=2`]);
    assert.deepEqual(report.pages[0].issues, []);
    assert.ok(report.pages[1].issues.length > 0);
    assert.equal(issueCount(report), report.pages[1].issues.length);
  } finally {
    await server.close();
  }
});

test("check rejects non-loopback paths before opening any browser", async () => {
  for (const route of ["https://example.com/", "//example.com/", "http://127.0.0.2/", "file:///tmp/page.html"]) {
    await assert.rejects(runBrowserChecks("http://localhost:3000/", { paths: ["/good", route] }), /loopback/u);
  }
});

test("opened toggles have fresh outline, axe and Tab results, then close exactly once", { skip }, async () => {
  const server = await serveDirectory(browserFixtures);
  try {
    const { pages: [page] } = await runBrowserChecks(`${server.url}/state-open-defects.html`, { toggles: ["#disclosure", "#second"] });
    assert.ok(!page.tab.some((entry) => entry.element === "button#unnamed"));
    const toggle = page.toggles[0];
    assert.match(toggle.open.outline, /textbox/u);
    assert.ok(toggle.open.tab.some((entry) => entry.element === "button#unnamed"));
    assert.ok(toggle.open.issues.some((issue) => issue.check === "axe" && issue.ruleId === "button-name"));
    assert.ok(toggle.open.issues.some((issue) => issue.check === "tab" && issue.recipe === "control-name-and-purpose"));
    assert.ok(toggle.open.issues.every((issue) => issue.state === "open:#disclosure"));
    assert.ok(toggle.open.issues.every((issue) => page.issues.includes(issue)));
    assert.deepEqual(toggle.restored, { expanded: false, visible: false });
    // Each activation appends a number to this live region. The next toggle
    // observes it, so extra activations cannot silently pass this assertion.
    const signals = page.toggles[1].stateLegibility.before.domSignals;
    assert.ok(signals.some((signal) => signal.statusText === "2 activations"));
    assert.equal(page.toggles[1].open.state, "open:#second");
  } finally {
    await server.close();
  }
});

test("Markdown renders every page and its opened toggle state; issueCount sums pages", () => {
  const issue = { check: "axe", recipe: "control-name-and-purpose", target: "#inside", message: "Needs a name", state: "open:#menu" };
  const page = (url) => ({ kind: "browser", url, outline: '- heading "Closed"', tab: [], blockedRequests: [], issues: [], toggles: [] });
  const first = page("http://localhost/a");
  first.issues = [issue];
  first.toggles = [{ selector: "#menu", notes: [], issues: [issue], open: { state: "open:#menu", outline: '- button "Inside"', tab: [{ step: 1, role: "button", name: "Inside", element: "#inside", focusIndicator: true }], issues: [issue] }, stateLegibility: { changes: { visual: true, dom: true, accessibility: true }, issues: [] } }];
  const report = { schema_version: "2.0.0", kind: "browser", pages: [first, page("http://localhost/b")] };
  const md = toMarkdown(report);
  assert.match(md, /## Page: http:\/\/localhost\/a/u);
  assert.match(md, /## Page: http:\/\/localhost\/b/u);
  assert.match(md, /### Toggle state: open:#menu/u);
  assert.match(md, /button "Inside"/u);
  assert.match(md, /\| 1 \| button \| Inside \|/u);
  assert.match(md, /Needs a name/u);
  assert.match(md, /Visual changed: yes.*DOM signals changed: yes.*Accessibility tree changed: yes/u);
  assert.equal(issueCount(report), 1);
  assert.equal(issueCount(first), 1, "legacy per-page reports still render/count");
});

// Exercise the public runner and actual probes without spawning Chrome. This
// driver supplies observations, while navigation, activation and cleanup are
// asserted below; the HTML integration tests above cover real browser readings.
function browserDriver(t) {
  const visits = [];
  const activations = [];
  let closes = 0;
  t.mock.method(chromium, "launch", async () => {
    let url;
    let open = false;
    let focused = "trigger";
    let tabIndex = 0;
    const page = {
      goto: async (target) => { url = target; visits.push(target); },
      viewportSize: () => ({ width: 1280, height: 800 }),
      setViewportSize: async () => {},
      addScriptTag: async () => {},
      locator: (selector) => {
        if (selector === "body") return { ariaSnapshot: async () => open ? '- button "Inside"' : '- heading "Closed"' };
        if (selector.startsWith("[id=")) return { isVisible: async () => open };
        return { first() { return this; }, focus: async () => { focused = "trigger"; tabIndex = 0; }, getAttribute: async () => "panel" };
      },
      keyboard: { press: async (key) => {
        if (key === "Enter") { open = !open; activations.push(open); }
        if (key === "Tab") { tabIndex += 1; focused = open && tabIndex === 1 ? "inside" : "trigger"; }
      } },
      evaluate: async (fn, arg) => {
        if (arg === "panel") return { visualSignature: [open], domSignals: [{ attributes: { "aria-expanded": String(open) } }], panel: { id: "panel", visible: open } };
        if (Array.isArray(arg)) return { violations: open || url.includes("bad") ? [{ id: "button-name", help: "Needs a name", nodes: [{ target: ["#inside"] }] }] : [] };
        if (fn.toString().includes("scrollWidth")) return { scrollWidth: 320, clientWidth: 320 };
        if (fn.toString().includes("getAnimations")) return 0;
        if (fn.toString().includes("const el = document.activeElement")) return { path: focused, label: focused === "inside" ? "button#inside" : "button#trigger", focusIndicator: true };
        return undefined;
      }
    };
    const cdp = { send: async (method, options) => {
      if (method === "Runtime.evaluate") return { result: { objectId: options.expression.includes("getElementById") ? "panel" : options.expression.includes("activeElement") ? focused : "trigger" } };
      if (method === "Accessibility.getPartialAXTree") return { nodes: [{ role: { value: "button" }, name: { value: options.objectId === "inside" ? "" : "Details" }, properties: [{ name: "expanded", value: { value: open } }] }] };
      if (method === "DOM.describeNode") return { node: { backendNodeId: 1 } };
      if (method === "Accessibility.getFullAXTree") return { nodes: [{ backendDOMNodeId: 1, ignored: !open }] };
      if (method === "Runtime.releaseObject") return {};
      throw new Error(`Unexpected CDP method: ${method}`);
    } };
    return {
      newContext: async () => ({ route: async () => {}, newPage: async () => page, newCDPSession: async () => cdp }),
      close: async () => { closes += 1; }
    };
  });
  return { visits, activations, get closes() { return closes; } };
}

test("runner resolves all routes, aggregates findings and closes every session", async (t) => {
  const driver = browserDriver(t);
  const report = await runBrowserChecks("http://localhost/nested/", { paths: ["../good", "/bad?x=1"], tabSteps: 3 });
  assert.equal(report.schema_version, "2.0.0");
  assert.deepEqual(report.pages.map((page) => page.url), ["http://localhost/good", "http://localhost/bad?x=1"]);
  assert.equal(report.pages[0].issues.length, 0);
  assert.equal(report.pages[1].issues.length, 1);
  assert.equal(issueCount(report), 1);
  assert.deepEqual(driver.visits, ["http://localhost/good", "http://localhost/good", "http://localhost/bad?x=1", "http://localhost/bad?x=1"]);
  assert.equal(driver.closes, 4, "normal and reduced-motion sessions close for each page");
});

test("runner rechecks the first activation and preserves single-page API fields", async (t) => {
  const driver = browserDriver(t);
  const report = await runBrowserChecks("http://localhost/good", { toggles: ["#trigger"], tabSteps: 3 });
  assert.equal(report.pages.length, 1);
  for (const field of ["url", "outline", "tab", "toggles", "blockedRequests", "issues"]) assert.deepEqual(report[field], report.pages[0][field]);
  const toggle = report.toggles[0];
  assert.deepEqual(driver.activations, [true, false]);
  assert.equal(toggle.open.outline, '- button "Inside"');
  assert.equal(toggle.open.tab[0].element, "button#inside");
  assert.deepEqual(new Set(toggle.open.issues.map((issue) => issue.check)), new Set(["axe", "tab"]));
  assert.ok(toggle.open.issues.every((issue) => issue.state === "open:#trigger"));
  assert.deepEqual(toggle.stateLegibility.issues, []);
  assert.deepEqual(toggle.restored, { expanded: false, visible: false });
  assert.equal(driver.closes, 2);
});
