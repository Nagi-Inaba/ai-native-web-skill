import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { syncDistributions } from "../scripts/sync-distributions.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repoRoot, "shared", "skill");
function publicFiles(directory, prefix = "") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.name === "node_modules" || /^references\/(source|licenses)(\/|$)/u.test(relative)) return [];
    return entry.isDirectory() ? publicFiles(path.join(directory, entry.name), relative) : [relative];
  });
}

test("npm packages preserve public runtime/docs/licenses and exclude local material", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "anw-pack-"));
  try {
    syncDistributions({ outRoot: out });
    for (const platform of ["claude", "codex"]) {
      const target = path.join(out, platform, "skills", "ai-native-web");
      const localFiles = ["references/source/synthetic-review.txt", "references/licenses/synthetic-license.txt", "internal-notes.txt"];
      for (const file of localFiles) {
        fs.mkdirSync(path.dirname(path.join(target, file)), { recursive: true });
        fs.writeFileSync(path.join(target, file), "Synthetic local-only fixture.\n");
      }
      const npm = process.platform === "win32" ? "npm.cmd" : "npm";
      const result = spawnSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
        cwd: target, encoding: "utf8", timeout: 30000, shell: process.platform === "win32", windowsHide: true,
        env: { ...process.env, npm_config_offline: "true", npm_config_audit: "false", npm_config_fund: "false", npm_config_cache: path.join(out, "npm-cache") }
      });
      if (result.error) throw result.error;
      assert.equal(result.status, 0, result.stderr);
      const packed = new Set(JSON.parse(result.stdout)[0].files.map((file) => file.path));
      for (const file of [...publicFiles(source), "LICENSE", "THIRD_PARTY_NOTICES.md"]) assert.ok(packed.has(file), `${platform}: missing ${file}`);
      for (const file of localFiles) {
        assert.equal(packed.has(file), false, `${platform}: packed local material ${file}`);
        assert.equal(fs.readFileSync(path.join(target, file), "utf8"), "Synthetic local-only fixture.\n", "packing preserves the original");
      }
      assert.equal([...packed].some((file) => /^references\/(source|licenses)\//u.test(file)), false);
      assert.equal(packed.has("agents/openai.yaml"), platform === "codex", "platform overlay");
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
