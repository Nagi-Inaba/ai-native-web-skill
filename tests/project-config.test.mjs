import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadProjectConfig, createIgnoreMatcher } from "../shared/skill/scripts/lib/static/project-config.mjs";
import { eslintConfig } from "../shared/skill/scripts/lib/static/eslint-config.mjs";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "static");
const jsxEntry = (configs) => configs.find((entry) => entry.files?.some((glob) => glob.includes("jsx")));

function temporaryProject(t, source) {
  const root = fs.mkdtempSync(path.join(fixtures, "config-test-"));
  t.after(() => {
    assert.equal(path.dirname(root), fixtures);
    assert.ok(path.basename(root).startsWith("config-test-"));
    fs.rmSync(root, { recursive: true, force: true });
  });
  if (source !== undefined) fs.writeFileSync(path.join(root, "ai-native-web.config.json"), source, "utf8");
  return root;
}

test("missing config preserves the built-in Image mapping without enabling polymorphism", (t) => {
  const config = loadProjectConfig(temporaryProject(t));
  assert.deepEqual(config, { components: { Image: "img" }, ignore: [] });
  assert.deepEqual(jsxEntry(eslintConfig()).settings["jsx-a11y"], { components: { Image: "img" } });
});

test("project config passes components and polymorphicPropName to jsx-a11y settings", () => {
  const config = loadProjectConfig(path.join(fixtures, "components-config"));
  assert.deepEqual(config, { components: { Image: "img", Button: "button", Input: "input", Photo: "img" }, polymorphicPropName: "as", ignore: [] });
  assert.deepEqual(jsxEntry(eslintConfig(config)).settings["jsx-a11y"], {
    components: config.components,
    polymorphicPropName: "as"
  });
  assert.equal(jsxEntry(eslintConfig(config)).settings["jsx-a11y"].ignore, undefined);
});

test("config fields are optional and explicit mappings override defaults", (t) => {
  assert.deepEqual(loadProjectConfig(temporaryProject(t, "{}")), { components: { Image: "img" }, ignore: [] });
  assert.deepEqual(loadProjectConfig(temporaryProject(t, '{"components":{"Image":"span"},"ignore":["src/legacy/**"]}')), {
    components: { Image: "span" }, ignore: ["src/legacy/**"]
  });
});

for (const [source, badKey] of [
  ['{"component":{}}', "component"], ['{"extra":true}', "extra"], ['{"ignore":[],"execute":"build.js"}', "execute"],
  ['{"components":[]}', "components"], ['{"components":null}', "components"], ['{"components":"button"}', "components"],
  ['{"components":{"Button":false}}', "components.Button"], ['{"components":{"Input":4}}', "components.Input"],
  ['{"components":{"Photo":null}}', "components.Photo"], ['{"components":{"Input":{}}}', "components.Input"],
  ['{"components":{"Input":[]}}', "components.Input"],
  ['{"polymorphicPropName":false}', "polymorphicPropName"], ['{"polymorphicPropName":null}', "polymorphicPropName"],
  ['{"ignore":"src/**"}', "ignore"], ['{"ignore":null}', "ignore"], ['{"ignore":[7]}', "ignore[0]"], ['{"ignore":[{}]}', "ignore[0]"]
]) {
  test(`config rejects ${source} and names ${badKey}`, (t) => {
    assert.throws(() => loadProjectConfig(temporaryProject(t, source)), (error) => {
      assert.ok(error.message.includes("ai-native-web.config.json"), error.message);
      assert.ok(error.message.includes(badKey), error.message);
      return true;
    });
  });
}

for (const source of ["null", "[]", "true", "42", '"config"', "{ broken JSON"]) {
  test(`config rejects invalid JSON object: ${source}`, (t) => {
    assert.throws(() => loadProjectConfig(temporaryProject(t, source)), /ai-native-web\.config\.json/u);
  });
}

test("ignore matcher handles root-relative * and ** without matching sibling names", () => {
  const ignored = createIgnoreMatcher(["src/legacy/**", "**/*.test.tsx", "src/*.jsx", "generated/**/App.tsx"]);
  for (const file of ["src/legacy/App.tsx", "src/legacy/deep/styles.css", "App.test.tsx", "src/App.test.tsx", "src/App.jsx", "generated/App.tsx", "generated/a/b/App.tsx"]) {
    assert.equal(ignored(file), true, file);
  }
  for (const file of ["src/legacy-new/App.tsx", "other/src/legacy/App.tsx", "src/deep/App.jsx", "src/App.tsx", "generated/Other.tsx"]) {
    assert.equal(ignored(file), false, file);
  }
  assert.equal(createIgnoreMatcher([])("src/App.tsx"), false);
});

test("ignore matcher escapes regexp metacharacters and accepts Windows separators", () => {
  const ignored = createIgnoreMatcher(["src\\legacy\\**", "src/a+b/*.jsx", "src/[old]/**"]);
  assert.equal(ignored("src\\legacy\\App.tsx"), true);
  assert.equal(ignored("src/a+b/App.jsx"), true);
  assert.equal(ignored("src/[old]/App.tsx"), true);
  assert.equal(ignored("src/ab/App.jsx"), false);
  assert.equal(ignored("src/o/App.tsx"), false);
});

test("reading config does not execute project JavaScript or package scripts", (t) => {
  const root = temporaryProject(t, '{"components":{"Button":"button"}}');
  fs.writeFileSync(path.join(root, "ai-native-web.config.js"), 'throw new Error("project code executed");', "utf8");
  fs.writeFileSync(path.join(root, "package.json"), '{"scripts":{"prelint":"exit 1"}}', "utf8");
  assert.equal(loadProjectConfig(root).components.Button, "button");
});
