import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import yaml from "js-yaml";

const workflow = fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

test("CI parses as YAML with a scalar Chrome availability command", () => {
  const parsed = yaml.load(workflow);
  const chrome = parsed.jobs.test.steps.find((step) => step.name === "Report Chrome availability");
  assert.equal(typeof chrome.run, "string");
});

test("CI pins external actions to full commit SHAs with version comments", () => {
  const lines = workflow.split(/\r?\n/u).filter((line) => /^\s*- uses: actions\//u.test(line));
  assert.equal(lines.length, 2);
  for (const line of lines) assert.match(line, /actions\/(?:checkout|setup-node)@[a-f0-9]{40}\s+# v\d+\.\d+\.\d+$/u);
});

test("CI checks distribution status including staged and untracked files", () => {
  const step = workflow.split("- name: Distribution copies are in sync")[1];
  assert.match(step, /status="\$\(git status --porcelain --untracked-files=all -- claude codex\)"/u);
  assert.match(step, /if \[ -n "\$status" \]; then[\s\S]*exit 1[\s\S]*fi/u);
});

test("CI distribution check rejects modified, staged and untracked files", async (t) => {
  const step = workflow.split("- name: Distribution copies are in sync")[1];
  const script = step.match(/run: \|\r?\n([\s\S]*)$/u)[1].split(/\r?\n/u).map((line) => line.replace(/^ {10}/u, "")).join("\n");
  assert.match(script, /npm run sync/u);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anw-ci-"));
  const repo = path.join(temp, "repo");
  fs.mkdirSync(repo);
  const run = (command, args) => {
    const stdout = path.join(temp, "stdout.txt");
    const stderr = path.join(temp, "stderr.txt");
    const outFd = fs.openSync(stdout, "w");
    const errFd = fs.openSync(stderr, "w");
    let result;
    try {
      result = spawnSync(command, args, { cwd: repo, stdio: ["ignore", outFd, errFd], timeout: 10000 });
    } finally {
      fs.closeSync(outFd);
      fs.closeSync(errFd);
    }
    if (result.error) throw result.error;
    return { status: result.status, stdout: fs.readFileSync(stdout, "utf8"), stderr: fs.readFileSync(stderr, "utf8") };
  };
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
  };
  // Exercise the actual workflow script; sync is stubbed only in this temp repo.
  const bash = process.platform === "win32"
    ? [process.env.ProgramFiles, path.join(process.env.LOCALAPPDATA, "Programs")].map((base) => path.join(base, "Git", "bin", "bash.exe")).find((file) => fs.existsSync(file)) ?? "bash"
    : "bash";
  const check = () => run(bash, ["-c", `set -e\nnpm() { [[ "$*" == "run sync" ]]; }\n${script}`]);
  try {
    const probe = run(bash, ["-c", "exit 0"]);
    if (process.platform === "win32" && probe.status !== 0 && /CreateFileMapping|Win32 error 5/u.test(probe.stderr)) {
      t.skip("The Windows sandbox denies Git Bash shared-memory access");
      return;
    }
    assert.equal(probe.status, 0, probe.stderr);
    git("init", "--quiet");
    for (const platform of ["claude", "codex"]) {
      fs.mkdirSync(path.join(repo, platform, "nested"), { recursive: true });
      fs.writeFileSync(path.join(repo, platform, "tracked.txt"), "baseline\n", "utf8");
    }
    git("add", "--", "claude", "codex");
    git("-c", "user.name=CI test", "-c", "user.email=ci-test@users.noreply.github.com", "commit", "--quiet", "-m", "test: establish distribution fixture");
    await t.test("clean distributions pass", () => {
      const result = check();
      assert.equal(result.status, 0, result.stderr);
    });
    for (const platform of ["claude", "codex"]) {
      const tracked = path.join(repo, platform, "tracked.txt");
      const untracked = path.join(repo, platform, "nested", "new.txt");
      await t.test(`${platform}: modified file fails`, () => {
        fs.writeFileSync(tracked, "modified\n", "utf8");
        assert.equal(check().status, 1);
        fs.writeFileSync(tracked, "baseline\n", "utf8");
      });
      await t.test(`${platform}: staged file fails`, () => {
        fs.writeFileSync(tracked, "staged\n", "utf8");
        git("add", "--", `${platform}/tracked.txt`);
        assert.equal(check().status, 1);
        fs.writeFileSync(tracked, "baseline\n", "utf8");
        git("add", "--", `${platform}/tracked.txt`);
      });
      await t.test(`${platform}: nested untracked file fails`, () => {
        fs.writeFileSync(untracked, "new\n", "utf8");
        assert.equal(check().status, 1);
        fs.rmSync(untracked);
      });
    }
    fs.writeFileSync(path.join(repo, "unrelated.txt"), "unrelated\n", "utf8");
    await t.test("unrelated untracked files pass", () => {
      const result = check();
      assert.equal(result.status, 0, result.stderr);
    });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
