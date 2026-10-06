import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function loadRecipes() {
  const file = path.join(skillRoot, "references", "recipes.json");
  return JSON.parse(fs.readFileSync(file, "utf8")).recipes;
}

export function recipeIds() {
  return new Set(loadRecipes().map((recipe) => recipe.id));
}
