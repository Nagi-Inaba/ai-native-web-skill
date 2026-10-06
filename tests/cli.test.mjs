import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, main } from "../shared/skill/scripts/cli.mjs";
import { toMarkdown } from "../shared/skill/scripts/lib/report.mjs";
import { serveDirectory } from "./helpers/serve.mjs";
import { chromeAvailable } from "./helpers/chrome.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "shared", "skill", "scripts", "cli.mjs");
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
const skip = !(await chromeAvailable()) && "Chrome not available";
const fixtures = path.join(here, "fixtures", "browser");
// --experimental-loader needs a file: URL on Windows, not a drive path.
const missingLoader = pathToFileURL(path.join(fixtures, "missing-dependency-loader.mjs")).href;

function runAsync(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (data) => { stdout += data; });
    child.stderr.setEncoding("utf8").on("data", (data) => { stderr += data; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("parseArgs reads check options", () => {
  const options = parseArgs(["check", "--url", "http://localhost:3000", "--toggle", "#a", "--toggle", "#b", "--tab-steps", "5", "--json"]);
  assert.deepEqual([options.command, options.url, options.toggles, options.tabSteps, options.json], ["check", "http://localhost:3000", ["#a", "#b"], 5, true]);
});

test("parseArgs rejects invalid combinations", () => {
  assert.throws(() => parseArgs(["check"]), /--url or --dev/u);
  assert.throws(() => parseArgs(["check", "--url", "http://localhost:1", "--dev", "."]), /either --url or --dev/u);
  assert.throws(() => parseArgs(["static"]), /project directory/u);
  assert.throws(() => parseArgs(["nope"]), /Unknown command/u);
  assert.throws(() => parseArgs(["static", ".", "--bogus"]), /Unknown option/u);
});

test("parseArgs rejects options that do not belong to the command", () => {
  assert.throws(() => parseArgs(["static", ".", "--url", "http://localhost:1"]), /--url is not valid for static/u);
  assert.throws(() => parseArgs(["static", ".", "--toggle", "#a"]), /--toggle is not valid for static/u);
  assert.throws(() => parseArgs(["check", "junk", "--url", "http://localhost:1"]), /check takes no positional/u);
  assert.throws(() => parseArgs(["check", "--url", "http://localhost:1", "--dev-command", "x"]), /--dev-command requires --dev/u);
  assert.doesNotThrow(() => parseArgs(["check", "--dev", ".", "--dev-command", "npm start"]));
});

test("check --url is validated as loopback before any network access", async () => {
  assert.throws(() => parseArgs(["check", "--url", "https://example.com/"]), /loopback/u);
  const hits = [];
  const server = http.createServer((req, res) => { hits.push(req.url); res.end("x"); });
  await new Promise((resolve) => server.listen(0, "127.0.0.2", resolve));
  try {
    const result = spawnSync(process.execPath, [cli, "check", "--url", `http://127.0.0.2:${server.address().port}/before-guard`], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /loopback/u);
    assert.deepEqual(hits, []);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("static command exits 1 with JSON findings for defects and 0 for ok", () => {
  const defects = run("static", path.join(here, "fixtures", "static", "defects"), "--json");
  assert.equal(defects.status, 1, defects.stderr);
  assert.ok(JSON.parse(defects.stdout).findings.length > 0);
  const ok = run("static", path.join(here, "fixtures", "static", "ok"));
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /## Static findings \(0\)/u);
});

test("usage errors exit 2", () => {
  const result = run("check");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage:/u);
});

test("markdown escapes table pipes", () => {
  const md = toMarkdown({ kind: "static", root: "/x", files: 1, findings: [{ file: "a.tsx", line: 1, column: 1, ruleId: "r", recipe: "content-equivalence", certainty: "confirmed", message: "a | b" }] });
  assert.match(md, /a \\\| b/u);
});

test("--path is repeatable with --url and --dev and is rejected by other commands", () => {
  for (const base of [["--url", "http://localhost:3000/base/"], ["--dev", "."]]) {
    const options = parseArgs(["check", ...base, "--path", "/a", "--path", "../b?x=1"]);
    assert.deepEqual(options.paths, ["/a", "../b?x=1"]);
  }
  assert.deepEqual(parseArgs(["check", "--url", "http://localhost:3000/"]).paths, []);
  assert.throws(() => parseArgs(["static", ".", "--path", "/a"]), /--path is not valid for static/u);
  assert.throws(() => parseArgs(["doctor", "--path", "/a"]), /--path is not valid for doctor/u);
  assert.throws(() => parseArgs(["check", "--url", "http://localhost:3000/", "--path"]), /needs a value/u);
});

test("non-loopback paths are rejected by the parser with --url and --dev", () => {
  for (const base of [["--url", "http://localhost:3000/"], ["--dev", "."]]) {
    for (const route of ["https://example.com/a", "//example.com/a", "http://127.0.0.2/", "file:///tmp/a"]) {
      assert.throws(() => parseArgs(["check", ...base, "--path", route]), /loopback/u);
    }
  }
  assert.doesNotThrow(() => parseArgs(["check", "--url", "http://localhost:3000/", "--path", "http://[::1]:3001/a"]));
});

test("non-loopback paths exit before starting --dev", () => {
  const result = run("check", "--dev", ".", "--dev-command", "should-never-run", "--path", "https://example.com/");
  assert.equal(result.status, 2);
  assert.match(result.stderr, /loopback/u);
  assert.doesNotMatch(result.stderr, /Dev server/u);
});

test("check --url returns pages and exits 1 when any route has issues", { skip }, async () => {
  const server = await serveDirectory(fixtures);
  try {
    const result = await runAsync(["check", "--url", `${server.url}/good.html`, "--path", "/good.html", "--path", "/bad.html", "--json"]);
    assert.equal(result.status, 1, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.schema_version, "2.0.0");
    assert.deepEqual(report.pages.map((page) => page.url), [`${server.url}/good.html`, `${server.url}/bad.html`]);
    assert.deepEqual(report.pages[0].issues, []);
    assert.ok(report.pages[1].issues.length > 0);
    const good = await runAsync(["check", "--url", `${server.url}/good.html`, "--json"]);
    assert.equal(good.status, 0, good.stderr);
    assert.equal(JSON.parse(good.stdout).pages.length, 1);
  } finally {
    await server.close();
  }
});

test("check --dev applies paths against its detected URL and stops its process", { skip }, async () => {
  // Reuse the existing dev fixture, which prints its URL and serves every route.
  const project = path.join(here, "fixtures", "dev-app");
  const result = await runAsync(["check", "--dev", project, "--path", "/first", "--path", "/second?q=1", "--json"]);
  // The fixture page is nearly clean; this test is about path resolution and shutdown, not findings.
  assert.ok([0, 1].includes(result.status), `exit ${result.status}: ${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.pages.map((page) => new URL(page.url).pathname), ["/first", "/second"]);
  assert.equal(new URL(report.pages[1].url).search, "?q=1");
  await assert.rejects(fetch(report.pages[0].url));
});

test("missing npm dependencies exit 2 with a skill-directory npm install instruction", () => {
  for (const [command, dependency] of [["check", "playwright-core"], ["static", "eslint"]]) {
    const args = command === "check" ? ["--url", "http://localhost:3000/"] : [path.join(here, "fixtures", "static", "ok")];
    const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-loader", missingLoader, cli, command, ...args], {
      encoding: "utf8", env: { ...process.env, ANW_TEST_MISSING_PACKAGE: dependency }
    });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /npm install in the skill directory/u);
    assert.doesNotMatch(result.stderr, /npm ci|project or skill directory/u);
    assert.doesNotMatch(result.stderr, /\n\s+at |ERR_MODULE_NOT_FOUND/u);
    assert.ok(result.stderr.trim().split("\n").length <= 2, result.stderr);
  }
});

test("Chrome launch failure exits 2 and never recommends Playwright downloads", async () => {
  const server = await serveDirectory(fixtures);
  try {
    const result = await runAsync(["check", "--url", `${server.url}/good.html`], { ...process.env, ANW_BROWSER_CHANNEL: "anw-missing-channel" });
    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /install Google Chrome or set ANW_BROWSER_CHANNEL/iu);
    assert.doesNotMatch(result.stderr, /playwright install|download.*browser|\n\s+at /iu);
    assert.ok(result.stderr.trim().split("\n").length <= 2, result.stderr);
  } finally {
    await server.close();
  }
});

test("doctor accepts only its own arguments", () => {
  assert.equal(parseArgs(["doctor", "--json"]).command, "doctor");
  assert.throws(() => parseArgs(["doctor", "extra"]), /doctor takes no positional/u);
  assert.throws(() => parseArgs(["doctor", "--toggle", "#x"]), /--toggle is not valid for doctor/u);
});

test("usage documents paths and doctor", () => {
  const usage = run();
  assert.match(usage.stderr, /--path <route>/u);
  assert.match(usage.stderr, /ai-native-web doctor/u);
});

test("doctor reports Node, every dependency and browser failure as exit 2", () => {
  const result = spawnSync(process.execPath, [cli, "doctor", "--json"], { encoding: "utf8", env: { ...process.env, ANW_BROWSER_CHANNEL: "anw-missing-channel" } });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.kind, "doctor");
  assert.equal(report.node.version, process.versions.node);
  assert.equal(report.node.minimum, "20.19.0");
  assert.equal(report.node.ok, true);
  assert.equal(report.dependencies.length, 9);
  assert.ok(report.dependencies.every((dependency) => dependency.ok));
  assert.equal(report.browser.ok, false);
  assert.match(report.browser.message, /install Google Chrome or set ANW_BROWSER_CHANNEL/iu);
  assert.doesNotMatch(result.stdout, /playwright install/iu);
});

test("doctor exits 0 only when the environment is ready and renders its checks", { skip }, () => {
  const result = run("doctor");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Node.*20\.19/u);
  assert.match(result.stdout, /playwright-core/u);
  assert.match(result.stdout, /Chrome/u);
});

test("doctor can diagnose missing packages without crashing during import", () => {
  const result = spawnSync(process.execPath, ["--no-warnings", "--experimental-loader", missingLoader, cli, "doctor", "--json"], {
    encoding: "utf8", env: { ...process.env, ANW_TEST_MISSING_PACKAGE: "playwright-core" }
  });
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.dependencies.find((dependency) => dependency.name === "playwright-core").ok, false);
  assert.equal(report.browser.ok, false);
  assert.match(report.browser.message, /npm install in the skill directory/u);
});

test("doctor enforces the Node minimum and closes a launched browser", async () => {
  const { runDoctor } = await import("../shared/skill/scripts/doctor.mjs");
  let closes = 0;
  const launchBrowser = async () => ({ close: async () => { closes += 1; } });
  for (const [nodeVersion, expected] of [["20.18.9", false], ["20.19.0", true], ["22.0.0", true], ["19.99.0", false]]) {
    const report = await runDoctor({ nodeVersion, launchBrowser });
    assert.equal(report.node.ok, expected, nodeVersion);
    assert.equal(report.ok, expected, nodeVersion);
  }
  assert.equal(closes, 4);
});

test("main handles Chrome launch failure and doctor errors without a stack trace", async (t) => {
  const stdout = [];
  const stderr = [];
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  t.mock.method(process.stdout, "write", (chunk, ...args) => {
    if (String(chunk).startsWith("{")) { stdout.push(String(chunk)); return true; }
    return stdoutWrite(chunk, ...args);
  });
  t.mock.method(process.stderr, "write", (chunk, ...args) => {
    if (String(chunk).startsWith("Cannot launch Chrome:")) { stderr.push(String(chunk)); return true; }
    return stderrWrite(chunk, ...args);
  });
  const originalChannel = process.env.ANW_BROWSER_CHANNEL;
  process.env.ANW_BROWSER_CHANNEL = "anw-missing-channel";
  const server = await serveDirectory(fixtures);
  try {
    assert.equal(await main(["check", "--url", `${server.url}/good.html`]), 2);
    assert.match(stderr.join(""), /install Google Chrome or set ANW_BROWSER_CHANNEL/iu);
    assert.doesNotMatch(stderr.join(""), /playwright install|\n\s+at /iu);
    assert.equal(await main(["doctor", "--json"]), 2);
    const report = JSON.parse(stdout.join(""));
    assert.equal(report.browser.ok, false);
    assert.equal(report.dependencies.length, 9);
  } finally {
    if (originalChannel === undefined) delete process.env.ANW_BROWSER_CHANNEL;
    else process.env.ANW_BROWSER_CHANNEL = originalChannel;
    await server.close();
  }
});
