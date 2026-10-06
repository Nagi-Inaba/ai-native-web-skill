import { settle } from "./session.mjs";

async function panelExposed(cdp, id) {
  const { result } = await cdp.send("Runtime.evaluate", { expression: `document.getElementById(${JSON.stringify(id)})` });
  if (!result.objectId) return false;
  try {
    const { node } = await cdp.send("DOM.describeNode", { objectId: result.objectId, depth: -1, pierce: true });
    const ids = new Set();
    const collect = (domNode) => {
      ids.add(domNode.backendNodeId);
      for (const child of [...(domNode.children ?? []), ...(domNode.shadowRoots ?? [])]) collect(child);
    };
    collect(node);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    // Generic containers may be ignored while their text/controls are exposed.
    return nodes.some((axNode) => !axNode.ignored && ids.has(axNode.backendDOMNodeId));
  } finally {
    await cdp.send("Runtime.releaseObject", { objectId: result.objectId });
  }
}

async function captureState(session, controlsId) {
  const observation = await session.page.evaluate((id) => {
    const panel = id ? document.getElementById(id) : null;
    const root = panel ?? document.body;
    const elementPath = (element) => {
      const segments = [];
      for (let node = element; node; node = node.parentElement) {
        const index = node.parentElement ? [...node.parentElement.children].indexOf(node) : 0;
        segments.unshift(`${node.tagName.toLowerCase()}:${index}`);
      }
      return segments.join("/");
    };
    const visible = (element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (!bounds.width || !bounds.height || ["hidden", "collapse"].includes(style.visibility)) return false;
      for (let node = element; node; node = node.parentElement) {
        const ancestor = getComputedStyle(node);
        if (ancestor.display === "none" || ancestor.contentVisibility === "hidden" || Number(ancestor.opacity) === 0) return false;
      }
      return true;
    };
    const visualSignature = [root, ...root.querySelectorAll("*")]
      .filter((element) => !["SCRIPT", "STYLE", "LINK"].includes(element.tagName))
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          element: elementPath(element),
          bounds: [bounds.x, bounds.y, bounds.width, bounds.height].map((value) => Math.round(value * 100) / 100),
          visible: visible(element), display: style.display, visibility: style.visibility, opacity: style.opacity
        };
      });
    const domSignals = [...document.querySelectorAll("*")].flatMap((element) => {
      const attributes = Object.fromEntries([...element.attributes]
        .filter((attribute) => attribute.name.startsWith("aria-") || ["hidden", "inert", "open", "checked", "selected", "disabled", "value"].includes(attribute.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((attribute) => [attribute.name, attribute.value]));
      const properties = {};
      for (const property of ["open", "checked", "selected", "disabled", "value"]) {
        if (property in element) properties[property] = element[property];
      }
      // False defaults on every generic element are not state signals. Native
      // state and explicit boolean attributes above still preserve false values.
      for (const property of ["hidden", "inert"]) if (element[property]) properties[property] = element[property];
      const liveRegion = ["status", "alert"].includes(element.getAttribute("role"));
      let statusText;
      if (liveRegion) {
        const texts = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (visible(walker.currentNode.parentElement)) texts.push(walker.currentNode.textContent);
        }
        statusText = texts.join(" ").replace(/\s+/gu, " ").trim();
      }
      if (!Object.keys(attributes).length && !Object.keys(properties).length && !liveRegion) return [];
      return [{ element: elementPath(element), attributes, properties, ...(liveRegion ? { statusText } : {}) }];
    });
    return { visualSignature, domSignals, panel: panel ? { id, visible: visible(panel) } : null };
  }, controlsId);
  const accessibilityTree = await session.page.locator("body").ariaSnapshot();
  if (observation.panel) observation.panel.exposed = await panelExposed(session.cdp, observation.panel.id);
  return { ...observation, accessibilityTree };
}

// Activates once and leaves that state available to callers for further probes.
// The existing toggleCheck owns the second activation/restoration in check.mjs.
export async function stateLegibilityCheck(session, selector) {
  const trigger = session.page.locator(selector).first();
  await trigger.focus();
  await settle(session.page);
  const controlsId = await trigger.getAttribute("aria-controls");
  const before = await captureState(session, controlsId);
  await session.page.keyboard.press("Enter");
  await settle(session.page);
  const after = await captureState(session, controlsId);
  const changes = {
    visual: JSON.stringify(before.visualSignature) !== JSON.stringify(after.visualSignature),
    dom: JSON.stringify(before.domSignals) !== JSON.stringify(after.domSignals),
    accessibility: before.accessibilityTree !== after.accessibilityTree
  };
  const issues = [];
  const issue = (message) => ({ check: "state-legibility", recipe: "dom-state-legibility", state: `open:${selector}`, target: selector, message });
  if (changes.visual && !changes.dom && !changes.accessibility) {
    issues.push(issue("Visual-only state change: the visual signature changed but DOM state signals and the accessibility tree did not."));
  }
  if (after.panel && before.panel?.visible !== after.panel.visible) {
    if (after.panel.visible && !after.panel.exposed) issues.push(issue("Panel became visible but is not exposed in the accessibility tree."));
    if (!after.panel.visible && after.panel.exposed) issues.push(issue("Panel became invisible but is still exposed in the accessibility tree."));
  }
  return { selector, before, after, changes, issues };
}
