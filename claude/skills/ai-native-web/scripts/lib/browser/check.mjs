import { openSession, isLoopbackUrl } from "./session.mjs";
import { runAxe, reflowCheck, tabWalk, toggleCheck, reducedMotionCheck } from "./probes.mjs";
import { stateLegibilityCheck } from "./state-probes.mjs";
import { CHROME_HELP } from "../../doctor.mjs";

async function checkedToggle(session, selector, tabSteps) {
  let stateLegibility;
  let open;
  let activations = 0;
  // toggleCheck has no callback between activations. Intercept only its first
  // Enter through a facade, leaving the real Page/Keyboard and probe unchanged.
  const keyboard = new Proxy(session.page.keyboard, {
    get(target, property) {
      if (property === "press") return async (...args) => {
        if (args[0] === "Enter" && activations++ === 0) {
          stateLegibility = await stateLegibilityCheck(session, selector);
          const state = `open:${selector}`;
          const outline = await session.page.locator("body").ariaSnapshot();
          const axeIssues = await runAxe(session);
          const tab = await tabWalk(session, { steps: tabSteps });
          const issues = [...axeIssues, ...tab.issues].map((issue) => ({ ...issue, state }));
          open = { state, outline, tab: tab.entries, issues };
          return;
        }
        return target.press(...args);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const page = new Proxy(session.page, {
    get(target, property) {
      if (property === "keyboard") return keyboard;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const result = await toggleCheck({ ...session, page }, selector);
  return { ...result, open, stateLegibility, issues: [...result.issues, ...stateLegibility.issues, ...open.issues] };
}

async function checkPage(url, { toggles, tabSteps }) {
  const session = await openSession(url);
  try {
    const outline = await session.page.locator("body").ariaSnapshot();
    const axeIssues = await runAxe(session);
    const reflowIssues = await reflowCheck(session);
    const tab = await tabWalk(session, { steps: tabSteps });
    const toggleResults = [];
    for (const selector of toggles) toggleResults.push(await checkedToggle(session, selector, tabSteps));
    const motionIssues = await reducedMotionCheck(url);
    return {
      kind: "browser",
      url,
      outline,
      tab: tab.entries,
      toggles: toggleResults,
      blockedRequests: session.blocked,
      issues: [...axeIssues, ...reflowIssues, ...tab.issues, ...toggleResults.flatMap((r) => r.issues), ...motionIssues]
    };
  } finally {
    await session.close();
  }
}

export async function runBrowserChecks(url, { paths = [], toggles = [], tabSteps = 30 } = {}) {
  if (!isLoopbackUrl(url)) throw new Error(`Only loopback dev servers are allowed: ${url}`);
  // Validate the entire set before launching or visiting the first route.
  const urls = paths.length ? paths.map((route) => {
    let resolved;
    try { resolved = new URL(route, url).href; } catch { /* Rejected below. */ }
    if (!isLoopbackUrl(resolved)) throw new Error(`Check path must resolve to a loopback URL: ${route}`);
    return resolved;
  }) : [url];
  const pages = [];
  try {
    for (const pageUrl of urls) pages.push(await checkPage(pageUrl, { toggles, tabSteps }));
  } catch (error) {
    if (/browserType\.launch/iu.test(error.message)) throw Object.assign(new Error(CHROME_HELP, { cause: error }), { code: "ANW_BROWSER_LAUNCH" });
    throw error;
  }
  // Existing single-page callers (including integrations) still read these
  // fields at the top level. New consumers use pages in every case.
  return { schema_version: "2.0.0", ...(pages.length === 1 ? pages[0] : { kind: "browser" }), pages, issues: pages.flatMap((page) => page.issues) };
}
