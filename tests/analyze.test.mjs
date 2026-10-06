import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { analyzeProject, collectFiles } from "../shared/skill/scripts/lib/static/analyze.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "static");

function fixtureGit(root, args) {
  return spawnSync("git", ["-c", "core.fsmonitor=false", "-C", root, ...args], { encoding: "utf8" });
}

function requireGit(t) {
  if (spawnSync("git", ["--version"]).status === 0) return true;
  t.skip("git not available");
  return false;
}

test("source listing does not invoke repository fsmonitor hooks", (t) => {
  if (!requireGit(t)) return;
  const root = tempProject({ "kept.css": "button {}\n" });
  try {
    assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
    assert.equal(fixtureGit(root, ["add", "kept.css"]).status, 0);
    const hook = path.join(root, "fsmonitor.sh");
    fs.writeFileSync(hook, '#!/bin/sh\nprintf touched > "$0.marker"\nprintf "token\\0"\n', { mode: 0o755 });
    assert.equal(fixtureGit(root, ["config", "core.fsmonitor", hook.split(path.sep).join("/")]).status, 0);
    assert.deepEqual(collectFiles(root).map((f) => path.basename(f)), ["kept.css"]);
    assert.equal(fs.existsSync(`${hook}.marker`), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Windows source listing does not select git.exe from the caller directory", (t) => {
  if (process.platform !== "win32") { t.skip("Windows executable search"); return; }
  if (!requireGit(t)) return;
  const root = tempProject({ "kept.css": "button {}\n", ".gitignore": "ignored.css\n", "ignored.css": "button {}\n" });
  try {
    assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
    assert.equal(fixtureGit(root, ["add", ".gitignore", "kept.css"]).status, 0);
    fs.copyFileSync(path.join(process.env.SystemRoot, "System32", "hostname.exe"), path.join(root, "git.exe"));
    const moduleUrl = new URL("../shared/skill/scripts/lib/static/analyze.mjs", import.meta.url).href;
    const code = `import { collectFiles } from ${JSON.stringify(moduleUrl)}; import path from "node:path"; process.stdout.write(JSON.stringify(collectFiles(process.cwd()).map(f => path.basename(f))));`;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), ["kept.css"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Git-listed source symlinks are skipped for inside and outside targets", (t) => {
  if (!requireGit(t)) return;
  const root = tempProject({ "kept.css": "button {}\n" });
  const outside = tempProject({ "outside.css": "button {}\n" });
  try {
    assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
    try {
      fs.symlinkSync(path.join(root, "kept.css"), path.join(root, "inside.css"), "file");
      fs.symlinkSync(path.join(outside, "outside.css"), path.join(root, "outside.css"), "file");
      fs.symlinkSync(outside, path.join(root, "directory.js"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) { t.skip(`Source links unavailable: ${error.code}`); return; }
      throw error;
    }
    assert.equal(fixtureGit(root, ["add", "kept.css", "inside.css", "outside.css"]).status, 0);
    assert.deepEqual(collectFiles(root).map((f) => path.basename(f)), ["kept.css"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true }); }
});

for (const git of [false, true]) {
  test(`linked project roots preserve regular files (${git ? "Git" : "non-Git"})`, (t) => {
    if (git && !requireGit(t)) return;
    const root = tempProject({ "kept.css": "button {}\n" });
    const wrapper = tempProject({});
    try {
      if (git) {
        assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
        assert.equal(fixtureGit(root, ["add", "kept.css"]).status, 0);
      }
      const link = path.join(wrapper, "project");
      try { fs.symlinkSync(root, link, process.platform === "win32" ? "junction" : "dir"); }
      catch (error) {
        if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) { t.skip(`Directory links unavailable: ${error.code}`); return; }
        throw error;
      }
      assert.deepEqual(collectFiles(link).map((f) => path.basename(f)), ["kept.css"]);
    } finally { fs.rmSync(wrapper, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true }); }
  });
}

test("stale Git-listed missing files and paths below replaced parents are skipped", (t) => {
  if (!requireGit(t)) return;
  const root = tempProject({ "kept.css": "button {}\n", "gone.css": "button {}\n", "parent/old.css": "button {}\n" });
  try {
    assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
    assert.equal(fixtureGit(root, ["add", "."]).status, 0);
    fs.unlinkSync(path.join(root, "gone.css"));
    fs.rmSync(path.join(root, "parent"), { recursive: true });
    fs.writeFileSync(path.join(root, "parent"), "replacement\n");
    assert.deepEqual(collectFiles(root).map((f) => path.basename(f)), ["kept.css"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("looping ancestors of stale Git-listed sources are skipped", (t) => {
  if (process.platform === "win32") { t.skip("POSIX symbolic link loop"); return; }
  if (!requireGit(t)) return;
  const root = tempProject({ "kept.css": "button {}\n", "loop/old.css": "button {}\n" });
  try {
    assert.equal(fixtureGit(root, ["init", "-q"]).status, 0);
    assert.equal(fixtureGit(root, ["add", "."]).status, 0);
    fs.rmSync(path.join(root, "loop"), { recursive: true });
    fs.symlinkSync("loop", path.join(root, "loop"));
    assert.deepEqual(collectFiles(root).map((f) => path.basename(f)), ["kept.css"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("collectFiles skips dependency and build directories", () => {
  const files = collectFiles(path.join(fixtures, "ok")).map((f) => path.basename(f));
  assert.deepEqual(files.sort(), ["App.tsx", "index.html", "styles.css"]);
});

test("defects are reported with file, line, rule, recipe and certainty", async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "defects"));
  const keys = findings.map((f) => `${f.file}:${f.line} ${f.ruleId}`);
  for (const expected of [
    "App.tsx:6 jsx-a11y/alt-text",
    "App.tsx:7 anw/jsx-meaningful-alt",
    "App.tsx:8 anw/jsx-input-label",
    "App.tsx:9 jsx-a11y/control-has-associated-label",
    "App.tsx:10 jsx-a11y/no-static-element-interactions",
    "App.tsx:11 jsx-a11y/anchor-is-valid",
    "index.html:2 @html-eslint/require-lang",
    "index.html:4 @html-eslint/no-non-scalable-viewport",
    "index.html:8 @html-eslint/require-img-alt",
    "index.html:9 @html-eslint/require-input-label",
    "index.html:10 @html-eslint/require-frame-title",
    "styles.css:1 anw/focus-outline-replaced",
    "styles.css:2 anw/reduced-motion-branch"
  ]) assert.ok(keys.includes(expected), `missing ${expected}\n${keys.join("\n")}`);
  const alt = findings.find((f) => f.ruleId === "jsx-a11y/alt-text");
  assert.equal(alt.recipe, "content-equivalence");
  assert.equal(alt.certainty, "confirmed");
  assert.equal(typeof alt.message, "string");
});

test("jsx-a11y missing attribute and content findings with spreads need browser confirmation", async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "spreads"));
  const expected = [
    "jsx-a11y/alt-text",
    "jsx-a11y/anchor-has-content",
    "jsx-a11y/iframe-has-title",
    "jsx-a11y/html-has-lang",
    "jsx-a11y/heading-has-content",
    "jsx-a11y/label-has-associated-control",
    "jsx-a11y/media-has-caption",
    "jsx-a11y/click-events-have-key-events",
    "jsx-a11y/no-static-element-interactions",
    "jsx-a11y/role-has-required-aria-props"
  ];
  for (const ruleId of expected) {
    const finding = findings.find((item) => item.ruleId === ruleId);
    assert.ok(finding, `missing ${ruleId}`);
    assert.equal(finding.certainty, "needs_browser", ruleId);
  }
});

test("look-alike non-issues produce no findings", async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "ok"));
  assert.deepEqual(findings, []);
});

test("project config maps icon-only Button and unlabelled Input in real JSX", async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "components-config"));
  for (const [line, ruleId] of [
    [4, "jsx-a11y/control-has-associated-label"], [5, "anw/jsx-input-label"],
    [6, "anw/jsx-meaningful-alt"], [7, "anw/jsx-input-label"]
  ]) assert.ok(findings.some((finding) => finding.file === "App.tsx" && finding.line === line && finding.ruleId === ruleId), `missing ${line} ${ruleId}`);
  assert.ok(!findings.some((finding) => finding.line === 4 && finding.ruleId === "jsx-a11y/no-static-element-interactions"));
});

test("the identical JSX without project config has no mapped component issues", async () => {
  assert.equal(fs.readFileSync(path.join(fixtures, "components-config", "App.tsx"), "utf8"), fs.readFileSync(path.join(fixtures, "components-no-config", "App.tsx"), "utf8"));
  const { findings } = await analyzeProject(path.join(fixtures, "components-no-config"));
  assert.deepEqual(findings, []);
});

test("analyzeProject throws invalid config errors naming the bad key even with no source files", async () => {
  await assert.rejects(analyzeProject(path.join(fixtures, "invalid-config")), /ai-native-web\.config\.json.*components\.Button/u);
});

test("project ignore globs exclude JSX and CSS files from collection and analysis", async () => {
  const root = path.join(fixtures, "ignore-config");
  assert.deepEqual(collectFiles(root, ["src/legacy/**", "**/*.ignored.tsx"]).map((file) => path.relative(root, file).split(path.sep).join("/")), ["src/App.tsx"]);
  const result = await analyzeProject(root);
  assert.equal(result.files, 1);
  assert.deepEqual(result.findings.map((finding) => [finding.file, finding.ruleId]), [["src/App.tsx", "anw/jsx-input-label"]]);
});

test("project ignore treats deeply nested braces as literal text", async () => {
  const root = tempProject({
    "ai-native-web.config.json": JSON.stringify({ ignore: ["{".repeat(4000) + "a" + "}".repeat(4000)] }),
    "styles.css": "button:focus { outline: none; }\n"
  });
  try {
    const { files, findings } = await analyzeProject(root);
    assert.equal(files, 1);
    assert.ok(findings.some((item) => item.file === "styles.css" && item.ruleId === "anw/focus-outline-replaced"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CSS filenames containing braces and brackets are analyzed literally", async () => {
  const root = tempProject(Object.fromEntries(["{a,b}.css", "[ab].css", "a.css"].map((name) => [name, "button:focus { outline: none; }\n"])));
  try {
    const { files, findings } = await analyzeProject(root);
    assert.equal(files, 3);
    assert.deepEqual(findings.filter((item) => item.ruleId === "anw/focus-outline-replaced").map((item) => item.file).sort(), ["[ab].css", "a.css", "{a,b}.css"].sort());
    fs.writeFileSync(path.join(root, "ai-native-web.config.json"), JSON.stringify({ ignore: ["{a,b}.css"] }), "utf8");
    const ignored = await analyzeProject(root);
    assert.equal(ignored.files, 2);
    assert.deepEqual(ignored.findings.map((item) => item.file).sort(), ["[ab].css", "a.css"].sort());
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Tailwind findings are emitted through the analyzer with locations and classifications", async () => {
  const { findings } = await analyzeProject(path.join(fixtures, "tailwind"));
  assert.deepEqual(findings.map(({ file, line, ruleId, recipe, certainty }) => ({ file, line, ruleId, recipe, certainty })), [
    { file: "App.tsx", line: 4, ruleId: "anw/jsx-tailwind-focus", recipe: "visual-perception", certainty: "confirmed" },
    { file: "App.tsx", line: 5, ruleId: "anw/jsx-tailwind-order", recipe: "discoverable-structure", certainty: "needs_browser" },
    { file: "App.tsx", line: 6, ruleId: "anw/jsx-tailwind-fixed-text", recipe: "visual-perception", certainty: "needs_browser" }
  ]);
});

function tempProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "anw-analyze-"));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content, "utf8");
  }
  return root;
}

test("project eslint directives for rules the analyzer does not load are not reported", async () => {
  const root = tempProject({
    "App.tsx": [
      "// eslint-disable-next-line react-hooks/exhaustive-deps",
      "export const a = 1;",
      "/* eslint-disable @typescript-eslint/no-require-imports */",
      "export const b = <main><h1>ok</h1></main>;",
      "// eslint-disable-next-line jsx-a11y/alt-text",
      "export const c = 2;"
    ].join("\n")
  });
  try {
    const { findings } = await analyzeProject(root);
    assert.deepEqual(findings.map((f) => f.ruleId), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("inside a git repository, gitignored files are skipped and untracked files are analyzed", (t) => {
  if (spawnSync("git", ["--version"]).status !== 0) {
    t.skip("git not available");
    return;
  }
  const root = tempProject({
    ".gitignore": "generated/\n",
    "src/Tracked.tsx": "export const A = () => <img src=\"a.png\" />;\n",
    "src/New.tsx": "export const B = () => <img src=\"b.png\" />;\n",
    "generated/Report.tsx": "export const C = () => <img src=\"c.png\" />;\n",
    "generated/index.html": "<html><body></body></html>\n"
  });
  try {
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
    assert.equal(spawnSync("git", ["add", ".gitignore", "src/Tracked.tsx"], { cwd: root }).status, 0);
    const files = collectFiles(root).map((f) => path.relative(root, f).split(path.sep).join("/"));
    assert.deepEqual(files, ["src/New.tsx", "src/Tracked.tsx"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("git-listed files outside the physical project root are not read through directory links", async (t) => {
  if (spawnSync("git", ["--version"]).status !== 0) {
    t.skip("git not available");
    return;
  }
  const root = tempProject({ "src/styles.css": "button:focus { outline: none; }\n" });
  const outside = tempProject({ "styles.css": "button:focus { outline: none; }\n" });
  try {
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
    assert.equal(spawnSync("git", ["add", "src/styles.css"], { cwd: root }).status, 0);
    fs.rmSync(path.join(root, "src"), { recursive: true });
    try {
      fs.symlinkSync(outside, path.join(root, "src"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) {
        t.skip(`Directory links unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.deepEqual(collectFiles(root), []);
    assert.deepEqual(await analyzeProject(root), { kind: "static", root, files: 0, findings: [] });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("git-listed regular files remain analyzed while paths replaced by directories are skipped", async (t) => {
  if (spawnSync("git", ["--version"]).status !== 0) {
    t.skip("git not available");
    return;
  }
  const root = tempProject({
    "kept.css": "button:focus { outline: none; }\n",
    "replaced.css": "button:focus { outline: none; }\n"
  });
  try {
    assert.equal(spawnSync("git", ["init", "-q"], { cwd: root }).status, 0);
    assert.equal(spawnSync("git", ["add", "."], { cwd: root }).status, 0);
    fs.rmSync(path.join(root, "replaced.css"));
    fs.mkdirSync(path.join(root, "replaced.css"));
    assert.deepEqual(collectFiles(root).map((file) => path.basename(file)), ["kept.css"]);
    const { files, findings } = await analyzeProject(root);
    assert.equal(files, 1);
    assert.ok(findings.some((item) => item.file === "kept.css" && item.ruleId === "anw/focus-outline-replaced"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("empty click-to-close backdrops need review while clickable content stays confirmed", async () => {
  const root = tempProject({
    "Menu.tsx": [
      "export function Menu({ close }: { close: () => void }) {",
      "  return (",
      "    <>",
      "      <div className=\"fixed inset-0 z-40\" onClick={close} />",
      "      <div aria-hidden=\"true\" onClick={close}></div>",
      "      <div onClick={close}>閉じる</div>",
      "      <div className=\"popover\" onClick={(e) => e.stopPropagation()}><p>本文</p></div>",
      "    </>",
      "  );",
      "}"
    ].join("\n")
  });
  try {
    const { findings } = await analyzeProject(root);
    const byLine = (line) => findings.filter((f) => f.line === line && f.ruleId === "jsx-a11y/no-static-element-interactions");
    assert.equal(byLine(4)[0]?.certainty, "needs_review");
    assert.match(byLine(4)[0].message, /Escape/u);
    // jsx-a11y already skips aria-hidden elements; the point is that nothing is confirmed there.
    assert.ok(!findings.some((f) => f.line === 5 && f.certainty === "confirmed"));
    assert.equal(byLine(6)[0]?.certainty, "confirmed");
    assert.equal(byLine(7)[0]?.certainty, "needs_review", "a click guard that only stops propagation is not a control");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
