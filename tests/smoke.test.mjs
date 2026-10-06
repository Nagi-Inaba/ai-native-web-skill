import test from "node:test";
import assert from "node:assert/strict";

test("pinned dependencies resolve", async () => {
  const modules = ["eslint", "eslint-plugin-jsx-a11y", "@typescript-eslint/parser", "@html-eslint/eslint-plugin", "@html-eslint/parser", "stylelint", "playwright-core", "axe-core"];
  for (const name of modules) {
    const imported = await import(name);
    assert.ok(imported, `${name} should import`);
  }
});
