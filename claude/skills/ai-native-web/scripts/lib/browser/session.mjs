import { chromium } from "playwright-core";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isLoopbackUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && LOOPBACK_HOSTS.has(url.hostname);
}

export async function settle(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

// Playwright does not hand redirect hops back to route handlers, so a loopback
// request could otherwise be redirected to any host. Loopback requests are
// fetched without following redirects; each Location is checked before the
// browser is allowed to follow it. Streaming responses (EventSource) are
// passed through because route.fetch buffers the whole body.
async function routeLoopbackOnly(route, blocked) {
  const request = route.request();
  const target = request.url();
  if (!isLoopbackUrl(target)) {
    blocked.push(target);
    return route.abort();
  }
  if ((request.headers().accept ?? "").includes("text/event-stream")) return route.continue();
  let response;
  try {
    response = await route.fetch({ maxRedirects: 0 });
  } catch {
    return route.abort();
  }
  if (REDIRECT_STATUSES.has(response.status())) {
    const location = response.headers().location;
    const next = location ? new URL(location, target).href : "";
    if (!isLoopbackUrl(next)) {
      blocked.push(next || `${target} (redirect without Location)`);
      return route.abort();
    }
  }
  return route.fulfill({ response });
}

export async function openSession(url, { width = 1280, height = 800, reducedMotion = "no-preference" } = {}) {
  if (!isLoopbackUrl(url)) throw new Error(`Only loopback dev servers are allowed: ${url}`);
  const browser = await chromium.launch({ channel: process.env.ANW_BROWSER_CHANNEL ?? "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
    const blocked = [];
    await context.route("**/*", (route) => routeLoopbackOnly(route, blocked));
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    await settle(page);
    const cdp = await context.newCDPSession(page);
    return { browser, context, page, cdp, blocked, close: () => browser.close() };
  } catch (error) {
    await browser.close();
    throw error;
  }
}
