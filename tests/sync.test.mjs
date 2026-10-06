import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncDistributions } from "../scripts/sync-distributions.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("sync bundles the repository license and third-party notices byte-for-byte", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "anw-sync-"));
  try {
    syncDistributions({ outRoot: out });
    for (const platform of ["claude", "codex"]) {
      for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) {
        assert.deepEqual(fs.readFileSync(path.join(out, platform, "skills", "ai-native-web", name)), fs.readFileSync(path.join(repoRoot, name)), `${platform} ${name}`);
      }
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("sync copies the skill to claude and codex without node_modules", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "anw-sync-"));
  try {
    syncDistributions({ outRoot: out });
    for (const platform of ["claude", "codex"]) {
      const base = path.join(out, platform, "skills", "ai-native-web");
      assert.ok(fs.existsSync(path.join(base, "SKILL.md")), `${platform} SKILL.md`);
      assert.ok(fs.existsSync(path.join(base, "scripts", "cli.mjs")), `${platform} cli`);
      assert.ok(fs.existsSync(path.join(base, "references", "recipes.json")), `${platform} recipes`);
      assert.equal(fs.existsSync(path.join(base, "node_modules")), false, `${platform} node_modules`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("only the Codex distribution receives the agents/openai.yaml overlay", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "anw-sync-"));
  try {
    syncDistributions({ outRoot: out });
    const codexYaml = path.join(out, "codex", "skills", "ai-native-web", "agents", "openai.yaml");
    const text = fs.readFileSync(codexYaml, "utf8");
    for (const key of ["display_name:", "short_description:", "default_prompt:", "$ai-native-web"]) assert.ok(text.includes(key), key);
    assert.equal(fs.existsSync(path.join(out, "claude", "skills", "ai-native-web", "agents")), false);
    assert.equal(fs.existsSync(path.join("shared", "skill", "agents")), false, "overlay must not live in the shared source");
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test("sync refuses an output root inside the skill source", () => {
  assert.throws(() => syncDistributions({ outRoot: path.resolve("shared", "skill", "nested") }), /inside the skill source/u);
});

test("sync refuses linked ancestors before touching either distribution", async (t) => {
  for (const platform of ["claude", "codex"]) {
    for (const depth of [0, 1, 2, 3]) {
      await t.test(`${platform} ancestor depth ${depth}`, (t) => {
        const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anw-sync-link-"));
        const out = path.join(temp, "out");
        const outside = path.join(temp, "out-sibling");
        const link = path.join(out, ...[platform, "skills", "ai-native-web"].slice(0, depth));
        fs.mkdirSync(outside);
        const sentinel = path.join(outside, "sentinel.txt");
        fs.writeFileSync(sentinel, "preserve", "utf8");
        try {
          fs.mkdirSync(path.dirname(link), { recursive: true });
          try {
            fs.symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
          } catch (error) {
            if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP"].includes(error.code)) {
              t.skip(`Directory links unavailable: ${error.code}`);
              return;
            }
            throw error;
          }
          assert.throws(() => syncDistributions({ outRoot: out }), /symbolic link|junction|outside/iu);
          assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve");
          assert.deepEqual(fs.readdirSync(outside), ["sentinel.txt"]);
          if (depth > 0) {
            const other = platform === "claude" ? "codex" : "claude";
            assert.equal(fs.existsSync(path.join(out, other)), false, "validate both targets before writing");
          }
        } finally {
          fs.rmSync(temp, { recursive: true, force: true });
        }
      });
    }
  }
});
