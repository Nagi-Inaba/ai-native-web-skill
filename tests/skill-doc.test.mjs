import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "shared", "skill");
const skill = fs.readFileSync(path.join(skillRoot, "SKILL.md"), "utf8");

test("SKILL.md has name and description frontmatter", () => {
  const match = skill.match(/^---\r?\nname: ai-native-web\r?\ndescription: (.+)\r?\n---\r?\n/u);
  assert.ok(match, "frontmatter");
  assert.ok(match[1].length > 80 && match[1].length < 1024, "description length");
});

test("every relative link in SKILL.md and workflow.md resolves", () => {
  for (const file of ["SKILL.md", path.join("references", "workflow.md")]) {
    const text = fs.readFileSync(path.join(skillRoot, file), "utf8");
    for (const [, target] of text.matchAll(/\]\((?!https?:)([^)#]+)\)/gu)) {
      assert.ok(fs.existsSync(path.join(skillRoot, path.dirname(file), target)), `${file} -> ${target}`);
    }
  }
});

test("SKILL.md names both modes, both commands and the stop conditions", () => {
  for (const phrase of ["build", "improve", "scripts/cli.mjs static", "scripts/cli.mjs check", "TODO(a11y)", "external sites"]) {
    assert.ok(skill.includes(phrase), phrase);
  }
});

const JAPANESE = /[぀-ヿ㐀-鿿！-｠]/u;

test("skill instructions and references are English only", () => {
  for (const file of ["SKILL.md", path.join("references", "workflow.md"), path.join("references", "recipes.json")]) {
    const text = fs.readFileSync(path.join(skillRoot, file), "utf8");
    const line = text.split(/\r?\n/u).findIndex((value) => JAPANESE.test(value));
    assert.equal(line, -1, `${file}:${line + 1} contains Japanese text`);
  }
});

test("SKILL.md tells the agent to answer in the user's language", () => {
  assert.match(skill, /## Language/u);
  assert.match(skill, /language they use/u);
});
