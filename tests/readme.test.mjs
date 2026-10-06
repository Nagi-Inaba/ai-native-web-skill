import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of ["README.md", "README.en.md"]) {
  test(`${name} documents distributions, commands, safety and opt-in E2E`, () => {
    const readme = fs.readFileSync(path.join(repoRoot, name), "utf8");
    assert.match(readme, /claude\/skills\/ai-native-web/u);
    assert.match(readme, /codex\/skills\/ai-native-web/u);
    assert.match(readme, /node scripts\/cli\.mjs static/u);
    assert.match(readme, /node scripts\/cli\.mjs check/u);
    assert.match(readme, /ANW_E2E=1/u);
    assert.match(readme, /SECURITY\.md/u);
    assert.match(readme, /THIRD_PARTY_NOTICES\.md/u);
  });
}

test("every relative link in the READMEs and SECURITY.md resolves", () => {
  for (const name of ["README.md", "README.en.md", "SECURITY.md"]) {
    const text = fs.readFileSync(path.join(repoRoot, name), "utf8");
    for (const [, target] of text.matchAll(/\]\((?!https?:)([^)#]+)\)/gu)) {
      assert.ok(fs.existsSync(path.join(repoRoot, target)), `${name} -> ${target}`);
    }
  }
});
