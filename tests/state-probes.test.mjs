import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateLegibilityCheck } from "../shared/skill/scripts/lib/browser/state-probes.mjs";
import { openSession } from "../shared/skill/scripts/lib/browser/session.mjs";
import { serveDirectory } from "./helpers/serve.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "browser");
const skip = !(await chromeAvailable()) && "Chrome not available";

async function withPage(file, fn) {
  const server = await serveDirectory(fixtures);
  let session;
  try {
    session = await openSession(`${server.url}/${file}`);
    return await fn(session);
  } finally {
    await session?.close();
    await server.close();
  }
}

function observedSession({ before, after }) {
  let activated = false;
  const observed = () => activated ? after : before;
  const trigger = { first() { return this; }, focus: async () => {}, getAttribute: async () => "panel" };
  const page = {
    locator: (selector) => selector === "body" ? { ariaSnapshot: async () => observed().tree } : trigger,
    evaluate: async (_fn, arg) => typeof arg === "string" ? observed().dom : undefined,
    keyboard: { press: async (key) => { assert.equal(key, "Enter"); assert.equal(activated, false); activated = true; } }
  };
  const cdp = { send: async (method) => {
    if (method === "Runtime.evaluate") return { result: { objectId: "panel-object" } };
    if (method === "DOM.describeNode") return { node: { backendNodeId: 1, children: [{ backendNodeId: 2 }] } };
    if (method === "Accessibility.getFullAXTree") return { nodes: [{ ignored: true, backendDOMNodeId: 1 }, { ignored: !observed().exposed, backendDOMNodeId: 2 }] };
    if (method === "Runtime.releaseObject") return {};
    throw new Error(`Unexpected CDP method: ${method}`);
  } };
  return { page, cdp };
}

test("observed visual-only changes produce recipe issues; semantic changes suppress them", async () => {
  const before = { dom: { visualSignature: ["hidden geometry"], domSignals: [{ attributes: { "aria-controls": "panel" } }], panel: { id: "panel", visible: false } }, tree: "Panel content", exposed: true };
  const after = { ...before, dom: { ...before.dom, visualSignature: ["visible geometry"], panel: { id: "panel", visible: true } } };
  const result = await stateLegibilityCheck(observedSession({ before, after }), "#toggle");
  assert.deepEqual(result.changes, { visual: true, dom: false, accessibility: false });
  assert.ok(result.issues.some((issue) => /visual-only/iu.test(issue.message)));
  assert.ok(result.issues.every((issue) => issue.recipe === "dom-state-legibility" && issue.state === "open:#toggle"));
  for (const readableAfter of [
    { ...after, tree: "Panel content expanded" },
    { ...after, dom: { ...after.dom, domSignals: [{ attributes: { "aria-expanded": "true" } }] } }
  ]) {
    assert.deepEqual((await stateLegibilityCheck(observedSession({ before, after: readableAfter }), "#toggle")).issues, []);
  }
});

test("observed panel visibility mismatches use AX subtree identity in both directions", async () => {
  for (const [visible, exposed, message] of [[true, false, /visible.*not exposed/iu], [false, true, /invisible.*still exposed/iu]]) {
    const before = { dom: { visualSignature: [!visible], domSignals: [], panel: { id: "panel", visible: !visible } }, tree: "Before", exposed: !exposed };
    const after = { dom: { visualSignature: [visible], domSignals: [], panel: { id: "panel", visible } }, tree: "After", exposed };
    const result = await stateLegibilityCheck(observedSession({ before, after }), "#toggle");
    assert.ok(result.issues.some((issue) => message.test(issue.message)));
    assert.equal(result.after.panel.exposed, exposed);
  }
});

test("class-only visual state changes are reported even when the AX tree stays the same", { skip }, async () => {
  await withPage("state-class-only.html", async (session) => {
    const result = await stateLegibilityCheck(session, "#disclosure");
    assert.deepEqual(result.changes, { visual: true, dom: false, accessibility: false });
    assert.ok(result.issues.some((issue) => /visual-only state change/iu.test(issue.message)));
    assert.ok(result.issues.every((issue) => issue.recipe === "dom-state-legibility" && issue.state === "open:#disclosure"));
    assert.equal(result.before.panel.visible, false);
    assert.equal(result.after.panel.visible, true);
    assert.equal(result.after.panel.exposed, true);
  });
});

test("correct disclosures expose native/ARIA state, live text and accessible content", { skip }, async () => {
  await withPage("state-disclosure.html", async (session) => {
    const result = await stateLegibilityCheck(session, "#disclosure");
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.changes, { visual: true, dom: true, accessibility: true });
    assert.equal(result.before.panel.exposed, false);
    assert.equal(result.after.panel.exposed, true, "generic panels count their exposed descendants");
    assert.match(result.after.accessibilityTree, /Panel content/u);
    assert.ok(result.after.domSignals.some((signal) => signal.attributes?.["aria-expanded"] === "true"));
    assert.ok(result.after.domSignals.some((signal) => signal.statusText === "Opened"));
    assert.ok(result.before.domSignals.some((signal) => signal.attributes?.hidden !== undefined));
  });
});

test("a visible panel excluded from the AX tree is reported by DOM identity", { skip }, async () => {
  await withPage("state-disclosure.html", async (session) => {
    await session.page.locator("#panel").evaluate((panel) => panel.setAttribute("aria-hidden", "true"));
    // Duplicate text elsewhere must not be mistaken for an exposed panel.
    await session.page.evaluate(() => document.querySelector("main").insertAdjacentHTML("beforeend", "<p>Panel content</p><a href='#next'>Next step</a>"));
    const result = await stateLegibilityCheck(session, "#disclosure");
    assert.equal(result.after.panel.visible, true);
    assert.equal(result.after.panel.exposed, false);
    assert.ok(result.issues.some((issue) => /visible.*not exposed/iu.test(issue.message)));
  });
});

test("an opacity-hidden panel still exposed in the AX tree is reported", { skip }, async () => {
  await withPage("state-class-only.html", async (session) => {
    await session.page.locator("#panel").evaluate((panel) => panel.classList.add("is-open"));
    const result = await stateLegibilityCheck(session, "#disclosure");
    assert.equal(result.after.panel.visible, false);
    assert.equal(result.after.panel.exposed, true);
    assert.ok(result.issues.some((issue) => /invisible.*still exposed/iu.test(issue.message)));
  });
});

test("without aria-controls the probe measures document changes", { skip }, async () => {
  await withPage("state-class-only.html", async (session) => {
    await session.page.locator("#disclosure").evaluate((trigger) => trigger.removeAttribute("aria-controls"));
    const result = await stateLegibilityCheck(session, "#disclosure");
    assert.equal(result.after.panel, null);
    assert.ok(result.issues.some((issue) => /visual-only/iu.test(issue.message)));
    assert.ok(result.after.visualSignature.length > 0);
  });
});

test("native state properties and all ARIA attributes are captured independently of CSS classes", { skip }, async () => {
  await withPage("state-disclosure.html", async (session) => {
    await session.page.evaluate(() => {
      document.querySelector("#panel").innerHTML += `<input id="check" type="checkbox"><input id="value" value="before"><select><option id="choice">One</option><option>Two</option></select><button id="disabled">Disabled later</button><details id="details"><summary>Summary</summary>Content</details><div id="inert">Inert later</div><div role="alert">Alert before</div>`;
      document.querySelector("#disclosure").addEventListener("click", () => {
        document.querySelector("#check").checked = true;
        document.querySelector("#value").value = "after";
        document.querySelector("#choice").selected = false;
        document.querySelector("#disabled").disabled = true;
        document.querySelector("#details").open = true;
        document.querySelector("#inert").inert = true;
        document.querySelector("#panel").setAttribute("aria-busy", "true");
        document.querySelector("[role=alert]").textContent = "Alert after";
      });
    });
    const { after, issues } = await stateLegibilityCheck(session, "#disclosure");
    for (const [property, value] of [["checked", true], ["value", "after"], ["selected", false], ["disabled", true], ["open", true], ["inert", true]]) {
      assert.ok(after.domSignals.some((signal) => signal.properties?.[property] === value), property);
    }
    assert.ok(after.domSignals.some((signal) => signal.attributes?.["aria-busy"] === "true"));
    assert.ok(after.domSignals.some((signal) => signal.statusText === "Alert after"));
    assert.deepEqual(issues, []);
  });
});
