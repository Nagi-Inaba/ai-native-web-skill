import test from "node:test";
import assert from "node:assert/strict";
import { JSX_RULES, HTML_RULES } from "../shared/skill/scripts/lib/static/eslint-config.mjs";
import { stylelintConfig } from "../shared/skill/scripts/lib/static/stylelint-rules.mjs";
import { RULE_MAP, classify } from "../shared/skill/scripts/lib/static/rule-map.mjs";
import { recipeIds } from "../shared/skill/scripts/lib/recipes.mjs";

test("every enabled rule is mapped to a known recipe", () => {
  const ids = recipeIds();
  const enabled = [...Object.keys(JSX_RULES), ...Object.keys(HTML_RULES), ...Object.keys(stylelintConfig().rules)];
  for (const ruleId of enabled) {
    assert.ok(RULE_MAP[ruleId], `${ruleId} is not mapped`);
    assert.ok(ids.has(RULE_MAP[ruleId].recipe), `${ruleId} maps to unknown recipe`);
    assert.ok(["confirmed", "needs_browser"].includes(RULE_MAP[ruleId].certainty), `${ruleId} certainty`);
  }
});

test("no enabled rule is set to off", () => {
  for (const [ruleId, value] of Object.entries({ ...JSX_RULES, ...HTML_RULES })) {
    assert.notEqual(Array.isArray(value) ? value[0] : value, "off", ruleId);
  }
});

test("unknown rules and parse errors need review", () => {
  assert.deepEqual(classify("parse-error"), { recipe: null, certainty: "needs_review" });
  assert.deepEqual(classify("jsx-a11y/alt-text"), { recipe: "content-equivalence", certainty: "confirmed" });
});

test("Tailwind rules are enabled with the requested recipe and certainty", () => {
  for (const [ruleId, recipe, certainty] of [
    ["anw/jsx-tailwind-focus", "visual-perception", "confirmed"],
    ["anw/jsx-tailwind-order", "discoverable-structure", "needs_browser"],
    ["anw/jsx-tailwind-fixed-text", "visual-perception", "needs_browser"]
  ]) {
    assert.equal(JSX_RULES[ruleId], "error", ruleId);
    assert.deepEqual(classify(ruleId), { recipe, certainty }, ruleId);
  }
});
