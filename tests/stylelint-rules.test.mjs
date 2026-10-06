import test from "node:test";
import assert from "node:assert/strict";
import stylelint from "stylelint";
import { stylelintConfig, FOCUS_RULE, MOTION_RULE } from "../shared/skill/scripts/lib/static/stylelint-rules.mjs";

async function warnings(code) {
  const result = await stylelint.lint({ code, codeFilename: "a.css", config: stylelintConfig() });
  return result.results[0].warnings.map((w) => `${w.line}:${w.rule}`);
}

test("outline removed on focus without replacement is reported", async () => {
  assert.deepEqual(await warnings("a:focus { outline: none; }"), [`1:${FOCUS_RULE}`]);
  assert.deepEqual(await warnings("a:focus-visible { outline-style: none; }"), [`1:${FOCUS_RULE}`]);
  assert.deepEqual(await warnings("a:focus { outline: 0px; }"), [`1:${FOCUS_RULE}`]);
  assert.deepEqual(await warnings("a:focus { outline: initial; }"), [`1:${FOCUS_RULE}`]);
});

test("outline removal with a replacement indicator is accepted", async () => {
  assert.deepEqual(await warnings("a:focus-visible { outline: 0; box-shadow: 0 0 0 3px #1a4fd6; }"), []);
  assert.deepEqual(await warnings("a:focus-visible { outline: 3px solid #1a4fd6; }"), []);
  assert.deepEqual(await warnings("a:hover { outline: none; }"), []);
});

test("non-visible replacement values do not count as focus indicators", async () => {
  for (const declaration of ["box-shadow: none", "border: 0", "border-color: transparent", "background: transparent", "text-decoration: initial"]) {
    assert.deepEqual(await warnings(`a:focus { outline: none; ${declaration}; }`), [`1:${FOCUS_RULE}`], declaration);
  }
});

test("only focus pseudo-classes in the last compound are checked", async () => {
  assert.deepEqual(await warnings("a:not(:focus) { outline: none; }"), []);
  assert.deepEqual(await warnings("a:focus span { outline: none; }"), []);
  assert.deepEqual(await warnings("main > a:focus-visible { outline: none; }"), [`1:${FOCUS_RULE}`]);
});

test("animation without prefers-reduced-motion is reported once per file", async () => {
  assert.deepEqual(await warnings(".a { animation: spin 1s infinite; }\n.b { transition: opacity .2s; }"), [`1:${MOTION_RULE}`]);
  assert.deepEqual(await warnings(".a { animation: spin 1s infinite; }\n@media (prefers-reduced-motion: reduce) { .a { animation: none; } }"), []);
  assert.deepEqual(await warnings(".a { animation: none; transition: none; }"), []);
});

test("prefers-reduced-motion no-preference is not a reduced-motion branch", async () => {
  const code = ".a { animation: spin 1s infinite; }\n@media (prefers-reduced-motion: no-preference) { .a { animation: spin 2s; } }";
  assert.deepEqual(await warnings(code), [`1:${MOTION_RULE}`]);
});
