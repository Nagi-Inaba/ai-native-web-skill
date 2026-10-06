import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isLoopbackUrl, openSession } from "../shared/skill/scripts/lib/browser/session.mjs";
import { focusedAxNode } from "../shared/skill/scripts/lib/browser/ax.mjs";
import { serveDirectory } from "./helpers/serve.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";

const browserFixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "browser");
const hasChrome = await chromeAvailable();

test("only loopback http(s) URLs are accepted", () => {
  assert.equal(isLoopbackUrl("http://localhost:3000/"), true);
  assert.equal(isLoopbackUrl("http://127.0.0.1:5173/x"), true);
  assert.equal(isLoopbackUrl("http://[::1]:8080/"), true);
  assert.equal(isLoopbackUrl("https://example.com/"), false);
  assert.equal(isLoopbackUrl("http://192.168.0.2:3000/"), false);
  assert.equal(isLoopbackUrl("file:///C:/x.html"), false);
});

test("openSession rejects non-loopback targets before launching", async () => {
  await assert.rejects(openSession("https://example.com/"), /Only loopback/u);
});

// 127.0.0.2 is loopback at the OS level but outside the allow list, so it stands
// in for an external host without leaving the machine.
async function redirectFixture() {
  const hits = [];
  const outside = http.createServer((req, res) => {
    hits.push(req.url);
    res.writeHead(200, { "content-type": "image/gif" });
    res.end();
  });
  await new Promise((resolve) => outside.listen(0, "127.0.0.2", resolve));
  const outsideUrl = `http://127.0.0.2:${outside.address().port}`;
  const page = http.createServer((req, res) => {
    if (req.url === "/to-outside") {
      res.writeHead(302, { location: `${outsideUrl}/via-redirect` });
      res.end();
      return;
    }
    if (req.url === "/to-inside") {
      res.writeHead(302, { location: "/pixel.gif" });
      res.end();
      return;
    }
    if (req.url === "/pixel.gif") {
      hits.push("inside:/pixel.gif");
      res.writeHead(200, { "content-type": "image/gif" });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html lang="en"><title>r</title><main><h1>r</h1>
<img alt="" src="/to-outside"><img alt="" src="/to-inside"><img alt="" src="${outsideUrl}/direct"></main></html>`);
  });
  await new Promise((resolve) => page.listen(0, "127.0.0.1", resolve));
  return {
    hits,
    url: `http://127.0.0.1:${page.address().port}/`,
    outsideUrl,
    close: () => Promise.all([new Promise((r) => outside.close(r)), new Promise((r) => page.close(r))])
  };
}

test("redirects to non-loopback hosts are blocked and recorded; loopback redirects still work", { skip: !hasChrome && "Chrome not available" }, async () => {
  const fixture = await redirectFixture();
  const session = await openSession(fixture.url);
  try {
    await session.page.waitForTimeout(300);
    assert.deepEqual(fixture.hits.filter((hit) => !hit.startsWith("inside:")), [], "nothing may reach the non-allowed host");
    assert.ok(fixture.hits.includes("inside:/pixel.gif"), "loopback-to-loopback redirect is followed");
    assert.ok(session.blocked.includes(`${fixture.outsideUrl}/direct`), "direct request is recorded");
    assert.ok(session.blocked.includes(`${fixture.outsideUrl}/via-redirect`), "redirect target is recorded");
  } finally {
    await session.close();
    await fixture.close();
  }
});

test("focused element exposes its computed accessible name and external requests are blocked", { skip: !hasChrome && "Chrome not available" }, async () => {
  const server = await serveDirectory(browserFixtures);
  const session = await openSession(`${server.url}/names.html`);
  try {
    await session.page.keyboard.press("Tab");
    const node = await focusedAxNode(session.cdp);
    assert.equal(node.role, "button");
    assert.equal(node.name, "メニュー");
    assert.ok(session.blocked.some((url) => url.startsWith("https://example.com/")));
  } finally {
    await session.close();
    await server.close();
  }
});
