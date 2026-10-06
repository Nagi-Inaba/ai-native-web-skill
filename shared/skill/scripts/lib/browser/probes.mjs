import axe from "axe-core";
import { axNodeFor, focusedAxNode } from "./ax.mjs";
import { openSession, settle } from "./session.mjs";

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const AXE_RECIPES = {
  "image-alt": "content-equivalence", "input-image-alt": "content-equivalence", "role-img-alt": "content-equivalence",
  "svg-img-alt": "content-equivalence", "object-alt": "content-equivalence", "area-alt": "content-equivalence",
  "image-redundant-alt": "content-equivalence", "video-caption": "content-equivalence", "audio-caption": "content-equivalence",
  "td-headers-attr": "content-equivalence", "th-has-data-cells": "content-equivalence", "empty-table-header": "content-equivalence",
  "scope-attr-valid": "content-equivalence", "server-side-image-map": "content-equivalence",
  "table-duplicate-name": "content-equivalence", "table-fake-caption": "content-equivalence", "td-has-header": "content-equivalence",
  label: "control-name-and-purpose", "button-name": "control-name-and-purpose", "link-name": "control-name-and-purpose",
  "input-button-name": "control-name-and-purpose", "select-name": "control-name-and-purpose", "frame-title": "control-name-and-purpose",
  "frame-title-unique": "control-name-and-purpose", "summary-name": "control-name-and-purpose",
  "label-title-only": "control-name-and-purpose", "label-content-name-mismatch": "control-name-and-purpose",
  "color-contrast": "visual-perception", "target-size": "visual-perception", "meta-viewport": "visual-perception",
  "meta-viewport-large": "visual-perception", "link-in-text-block": "visual-perception", "avoid-inline-spacing": "visual-perception",
  blink: "visual-perception", "css-orientation-lock": "visual-perception", marquee: "visual-perception",
  "meta-refresh": "visual-perception", "no-autoplay-audio": "visual-perception",
  "heading-order": "discoverable-structure", "empty-heading": "discoverable-structure", "page-has-heading-one": "discoverable-structure",
  region: "discoverable-structure", bypass: "discoverable-structure", "document-title": "discoverable-structure",
  "html-has-lang": "discoverable-structure", "html-lang-valid": "discoverable-structure", list: "discoverable-structure",
  listitem: "discoverable-structure", "duplicate-id-aria": "discoverable-structure", "definition-list": "discoverable-structure",
  dlitem: "discoverable-structure", "frame-tested": "discoverable-structure", "hidden-content": "discoverable-structure",
  "html-xml-lang-mismatch": "discoverable-structure", "p-as-heading": "discoverable-structure",
  "skip-link": "discoverable-structure", "valid-lang": "discoverable-structure",
  "nested-interactive": "action-semantics", "scrollable-region-focusable": "action-semantics", accesskeys: "action-semantics",
  "frame-focusable-content": "action-semantics", "presentation-role-conflict": "action-semantics",
  tabindex: "state-focus-sync", "focus-order-semantics": "state-focus-sync",
  "autocomplete-valid": "form-guidance-and-recovery", "form-field-multiple-labels": "form-guidance-and-recovery"
};

export function axeRecipe(ruleId) {
  if (AXE_RECIPES[ruleId]) return AXE_RECIPES[ruleId];
  if (ruleId.startsWith("landmark-")) return "discoverable-structure";
  if (ruleId.startsWith("aria-")) return "action-semantics";
  return null;
}

export async function runAxe(session) {
  await session.page.addScriptTag({ content: axe.source });
  const result = await session.page.evaluate((tags) => globalThis.axe.run(document, { resultTypes: ["violations"], runOnly: { type: "tag", values: tags } }), AXE_TAGS);
  return result.violations.flatMap((violation) => violation.nodes.map((node) => ({
    check: "axe", ruleId: violation.id, recipe: axeRecipe(violation.id), message: violation.help, target: node.target.join(" ")
  })));
}

export async function reflowCheck(session, { width = 320 } = {}) {
  const { page } = session;
  const original = page.viewportSize();
  await page.setViewportSize({ width, height: original.height });
  await settle(page);
  const measured = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  await page.setViewportSize(original);
  await settle(page);
  if (measured.scrollWidth <= measured.clientWidth + 1) return [];
  return [{ check: "reflow", recipe: "visual-perception", message: `Horizontal scroll at ${width}px (scrollWidth ${measured.scrollWidth} > clientWidth ${measured.clientWidth}).`, target: "document" }];
}

function describeActiveElement(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || el === document.body || el === document.documentElement) return null;
    const segments = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
      segments.unshift(`${node.tagName.toLowerCase()}:${index}`);
    }
    const focusStyles = (node) => {
      const style = getComputedStyle(node);
      return {
        outline: style.outline,
        outlineOffset: style.outlineOffset,
        boxShadow: style.boxShadow,
        borderTop: `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`,
        borderRight: `${style.borderRightWidth} ${style.borderRightStyle} ${style.borderRightColor}`,
        borderBottom: `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`,
        borderLeft: `${style.borderLeftWidth} ${style.borderLeftStyle} ${style.borderLeftColor}`,
        backgroundColor: style.backgroundColor,
        textDecoration: style.textDecoration
      };
    };
    const focusedStyles = focusStyles(el);
    el.blur();
    const unfocusedStyles = focusStyles(el);
    el.focus();
    const tag = el.tagName.toLowerCase();
    const label = el.id ? `${tag}#${el.id}` : `${tag} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
    const focusIndicator = Object.keys(focusedStyles).some((property) => focusedStyles[property] !== unfocusedStyles[property]);
    return { path: segments.join("/"), label, focusIndicator };
  });
}

export async function tabWalk(session, { steps = 30 } = {}) {
  const { page, cdp } = session;
  const entries = [];
  const issues = [];
  const seen = new Set();
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  for (let step = 1; step <= steps; step += 1) {
    await page.keyboard.press("Tab");
    const element = await describeActiveElement(page);
    if (!element || seen.has(element.path)) break;
    seen.add(element.path);
    const node = await focusedAxNode(cdp);
    const entry = { step, role: node?.role ?? null, name: node?.name ?? "", element: element.label, focusIndicator: element.focusIndicator };
    entries.push(entry);
    if (!entry.name) issues.push({ check: "tab", recipe: "control-name-and-purpose", message: `Focusable ${entry.role ?? "element"} has no accessible name.`, target: entry.element });
    if (["generic", "none", "presentation", null].includes(entry.role)) issues.push({ check: "tab", recipe: "action-semantics", message: `Focusable element exposes role '${entry.role}'.`, target: entry.element });
    if (!entry.focusIndicator) issues.push({ check: "tab", recipe: "visual-perception", message: "Focused and unfocused indicator styles are identical.", target: entry.element });
  }
  return { entries, issues };
}

export async function toggleCheck(session, selector) {
  const { page, cdp } = session;
  const trigger = page.locator(selector).first();
  const controlsId = await trigger.getAttribute("aria-controls");
  const panelVisible = () => (controlsId ? page.locator(`[id="${controlsId}"]`).isVisible() : Promise.resolve(null));
  const triggerNode = () => axNodeFor(cdp, `document.querySelector(${JSON.stringify(selector)})`);
  const state = async () => {
    const node = await triggerNode();
    return { expanded: node?.properties.expanded, visible: await panelVisible() };
  };
  const issues = [];
  const notes = [];
  await trigger.focus();
  const before = await state();
  await page.keyboard.press("Enter");
  await settle(page);
  const after = await state();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await settle(page);
  const restored = await state();
  if (before.expanded === undefined) {
    issues.push({ check: "toggle", recipe: "state-focus-sync", message: "Trigger exposes no expanded state (aria-expanded).", target: selector });
  } else {
    if (after.expanded === before.expanded) issues.push({ check: "toggle", recipe: "state-focus-sync", message: `Expanded state stayed ${before.expanded} after first activation.`, target: selector });
    if (after.visible !== null && after.expanded !== after.visible) issues.push({ check: "toggle", recipe: "state-focus-sync", message: `Expanded state (${after.expanded}) does not match panel visibility (${after.visible}) after first activation.`, target: selector });
    if (restored.expanded !== before.expanded) issues.push({ check: "toggle", recipe: "state-focus-sync", message: `Expanded state did not return to its original value after second activation (${restored.expanded} instead of ${before.expanded}).`, target: selector });
    if (restored.visible !== null && restored.visible !== before.visible) issues.push({ check: "toggle", recipe: "state-focus-sync", message: `Panel visibility did not return to its original value after second activation (${restored.visible} instead of ${before.visible}).`, target: selector });
    if (restored.visible !== null && restored.expanded !== restored.visible) issues.push({ check: "toggle", recipe: "state-focus-sync", message: `Expanded state (${restored.expanded}) does not match panel visibility (${restored.visible}) after second activation.`, target: selector });
  }
  if (!controlsId) notes.push("Trigger has no aria-controls; panel visibility was not compared.");
  return { selector, before, after, restored, issues, notes };
}

export async function reducedMotionCheck(url, options = {}) {
  const session = await openSession(url, { ...options, reducedMotion: "reduce" });
  try {
    const running = await session.page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity).length);
    if (!running) return [];
    return [{ check: "reduced-motion", recipe: "visual-perception", message: `${running} infinite animation(s) keep running with prefers-reduced-motion: reduce.`, target: "document" }];
  } finally {
    await session.close();
  }
}
