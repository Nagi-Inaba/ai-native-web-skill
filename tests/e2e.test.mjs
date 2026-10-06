import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../shared/skill/scripts/lib/static/analyze.mjs";
import { runBrowserChecks } from "../shared/skill/scripts/lib/browser/check.mjs";
import { startDevServer, waitForHttp } from "../shared/skill/scripts/lib/browser/dev-server.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const skip = process.env.ANW_E2E !== "1" && "set ANW_E2E=1 after installing fixture dependencies";

async function withDev(dir, fn) {
  const dev = await startDevServer({ cwd: path.join(fixtures, dir), timeoutMs: 120000 });
  try {
    await waitForHttp(dev.url, { timeoutMs: 120000 });
    return await fn(dev.url);
  } finally {
    await dev.stop();
  }
}

test("Vite: static and browser checks find the seeded defects", { skip, timeout: 240000 }, async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "e2e-vite"));
  assert.ok(findings.some((f) => f.file === "src/App.jsx" && f.ruleId === "jsx-a11y/control-has-associated-label"));
  await withDev("e2e-vite", async (url) => {
    const report = await runBrowserChecks(url, { toggles: ["#more"] });
    assert.ok(report.issues.some((i) => i.check === "tab" && i.target === "button#icon" && i.recipe === "control-name-and-purpose"));
    assert.ok(report.issues.some((i) => i.check === "toggle" && i.recipe === "state-focus-sync"));
  });
});

test("Next.js: static and browser checks find the seeded defects", { skip, timeout: 300000 }, async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "e2e-next"));
  const keys = findings.map((f) => `${f.file} ${f.ruleId}`);
  assert.ok(keys.includes("app/layout.jsx jsx-a11y/html-has-lang"), keys.join("\n"));
  assert.ok(keys.includes("app/page.jsx jsx-a11y/alt-text"), keys.join("\n"));
  await withDev("e2e-next", async (url) => {
    const report = await runBrowserChecks(url);
    assert.ok(report.issues.some((i) => i.check === "axe" && i.ruleId === "html-has-lang"));
  });
});
