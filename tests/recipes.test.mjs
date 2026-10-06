import test from "node:test";
import assert from "node:assert/strict";
import { loadRecipes, recipeIds } from "../shared/skill/scripts/lib/recipes.mjs";

const EXPECTED = ["discoverable-structure", "action-semantics", "control-name-and-purpose", "form-guidance-and-recovery", "state-focus-sync", "content-equivalence", "visual-perception", "dom-state-legibility"];

test("all eight recipes exist in order", () => {
  assert.deepEqual(loadRecipes().map((r) => r.id), EXPECTED);
  assert.equal(recipeIds().size, 8);
});

test("every recipe has the required fields", () => {
  for (const recipe of loadRecipes()) {
    assert.equal(typeof recipe.title, "string", recipe.id);
    assert.ok(Array.isArray(recipe.wcag) && recipe.wcag.length > 0, `${recipe.id} wcag`);
    assert.ok(recipe.impact.length > 0, `${recipe.id} impact`);
    assert.ok(recipe.build.length > 0, `${recipe.id} build`);
    assert.ok(recipe.avoid.length > 0, `${recipe.id} avoid`);
    assert.ok(recipe.verify.length > 0, `${recipe.id} verify`);
    assert.ok(Array.isArray(recipe.patterns), `${recipe.id} patterns`);
  }
});
