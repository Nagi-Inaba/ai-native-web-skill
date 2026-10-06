import test from "node:test";
import assert from "node:assert/strict";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import htmlParser from "@html-eslint/parser";
import { anwEslintPlugin, isMeaninglessAlt } from "../shared/skill/scripts/lib/static/eslint-rules.mjs";

const eslint = new ESLint({
  overrideConfigFile: true,
  overrideConfig: [
    { files: ["**/*.tsx"], languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } }, plugins: { anw: anwEslintPlugin }, rules: { "anw/jsx-meaningful-alt": "error", "anw/jsx-input-label": "error", "anw/jsx-static-aria-state": "error" } },
    { files: ["**/*.html"], languageOptions: { parser: htmlParser }, plugins: { anw: anwEslintPlugin }, rules: { "anw/html-meaningful-alt": "error" } }
  ]
});

async function ruleIds(code, filePath = "a.tsx") {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages.map((m) => m.ruleId);
}

test("isMeaninglessAlt flags placeholder words and file names only", () => {
  for (const value of ["image", "Image", "画像", "写真", "アイコン", "IMG_0012.JPG", "hero.webp"]) assert.equal(isMeaninglessAlt(value), true, value);
  for (const value of ["", "東京駅の外観", "Company logo", "image of a cat on a sofa", "Screenshot of settings.png"]) assert.equal(isMeaninglessAlt(value), false, value);
});

test("JSX rule reports meaningless literal alt and ignores good or dynamic alt", async () => {
  assert.deepEqual(await ruleIds(`const a = <img src="x" alt="IMG_0012.JPG" />;`, "a.tsx"), ["anw/jsx-meaningful-alt"]);
  assert.deepEqual(await ruleIds(`const a = <img src="x" alt="東京駅の外観" />;`, "a.tsx"), []);
  assert.deepEqual(await ruleIds(`const a = <img src="x" alt={label} />;`, "a.tsx"), []);
  assert.deepEqual(await ruleIds(`const a = <img src="x" alt="" />;`, "a.tsx"), []);
});

test("HTML rule reports meaningless alt on img", async () => {
  assert.deepEqual(await ruleIds(`<img src="x" alt="画像"><img src="y" alt="東京駅の外観">`, "a.html"), ["anw/html-meaningful-alt"]);
});

test("JSX input label rule accepts associated controls", async () => {
  for (const code of [
    `const a = <><label htmlFor="n">名前</label><input id="n" type="text" /></>;`,
    `const a = <label>名前<input type="text" /></label>;`,
    `const a = <input type="search" aria-label="検索" />;`,
    `const a = <input type="text" aria-labelledby="h" />;`,
    `const a = <input type="hidden" name="x" />;`,
    `const a = <input type="submit" value="送信" />;`,
    `const a = <input id={id} />;`,
    `const a = <input {...props} />;`
  ]) assert.deepEqual(await ruleIds(code), [], code);
});

test("JSX input label rule reports unlabelled controls", async () => {
  for (const code of [
    `const a = <input type="text" />;`,
    `const a = <><label htmlFor="x">名前</label><input id="y" /></>;`,
    `const a = <textarea />;`,
    `const a = <select><option>A</option></select>;`,
    `const a = <input aria-label="" />;`,
    `const a = <input aria-label="   " />;`,
    `const a = <input aria-labelledby="" />;`,
    `const a = <input aria-labelledby={"   "} />;`
  ]) assert.deepEqual(await ruleIds(code), ["anw/jsx-input-label"], code);
});

test("static aria state rule reports literal state on interactive elements", async () => {
  for (const code of [
    `const a = <button aria-expanded="false" onClick={toggle}>メニュー</button>;`,
    `const a = <button aria-pressed={false} onClick={toggle}>太字</button>;`,
    `const a = <div role="tab" aria-selected="true" onKeyDown={move} tabIndex={0}>概要</div>;`,
    `const a = <button aria-checked="true" role="switch" onClick={flip}>通知</button>;`
  ]) assert.deepEqual(await ruleIds(code), ["anw/jsx-static-aria-state"], code);
});

test("static aria state rule accepts state bound to data or elements without handlers", async () => {
  for (const code of [
    `const a = <button aria-expanded={open} onClick={toggle}>メニュー</button>;`,
    `const a = <button aria-pressed={bold ? "true" : "false"} onClick={toggle}>太字</button>;`,
    `const a = <div aria-expanded="false">静的な説明</div>;`,
    `const a = <a aria-current="page" href="/" onClick={track}>ホーム</a>;`,
    `const a = <button aria-expanded="false" {...props}>メニュー</button>;`
  ]) assert.deepEqual(await ruleIds(code), [], code);
});

async function customRuleIds(rule, code, settings = {}) {
  const linter = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["**/*.tsx"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { anw: anwEslintPlugin },
      settings,
      rules: { [`anw/${rule}`]: "error" }
    }]
  });
  const [result] = await linter.lintText(code, { filePath: "a.tsx" });
  return result.messages.map((message) => message.ruleId);
}

const componentSettings = {
  "jsx-a11y": {
    components: { Input: "input", Select: "select", TextArea: "textarea", Photo: "img", "UI.Input": "input", FieldLabel: "label" },
    polymorphicPropName: "as"
  }
};

test("input label rule checks mapped and polymorphic native controls", async () => {
  for (const element of ["<Input />", "<Select />", "<TextArea />", "<UI.Input />", '<Box as="input" />', '<Box as={"textarea"} />']) {
    assert.deepEqual(await customRuleIds("jsx-input-label", `const a = ${element};`, componentSettings), ["anw/jsx-input-label"], element);
  }
});

test("mapped controls keep label association, spread and input type exceptions", async () => {
  for (const element of [
    '<><label htmlFor="name">名前</label><Input id="name" /></>',
    '<label>名前<Input /></label>',
    '<FieldLabel>名前<Input /></FieldLabel>',
    '<Box as="label">名前<Input /></Box>',
    '<><FieldLabel htmlFor="name">名前</FieldLabel><Input id="name" /></>',
    '<Input aria-label="名前" />', '<Select aria-labelledby="heading" />', '<Input type="hidden" />',
    '<Input {...props} />', '<Input as="div" />', '<Custom />', '<Box as={tag} />'
  ]) assert.deepEqual(await customRuleIds("jsx-input-label", `const a = ${element};`, componentSettings), [], element);
});

test("meaningful alt rule checks native, default Image, mapped and polymorphic images only", async () => {
  for (const element of ['<Photo alt="image" />', '<Box as="img" alt="image" />']) {
    assert.deepEqual(await customRuleIds("jsx-meaningful-alt", `const a = ${element};`, componentSettings), ["anw/jsx-meaningful-alt"], element);
  }
  assert.deepEqual(await customRuleIds("jsx-meaningful-alt", 'const a = <Image alt="image" />;'), ["anw/jsx-meaningful-alt"]);
  for (const element of ['<div alt="image" />', '<Unknown alt="image" />', '<Photo alt="東京駅" />', '<Photo as="div" alt="image" />']) {
    assert.deepEqual(await customRuleIds("jsx-meaningful-alt", `const a = ${element};`, componentSettings), [], element);
  }
});

test("static aria state rule remains independent of component mapping", async () => {
  assert.deepEqual(await customRuleIds("jsx-static-aria-state", 'const a = <Unknown aria-expanded="false" onClick={toggle} />;', componentSettings), ["anw/jsx-static-aria-state"]);
});

const tailwindRules = ["jsx-tailwind-focus", "jsx-tailwind-order", "jsx-tailwind-fixed-text"];

for (const [rule, classes] of [
  ["jsx-tailwind-focus", "outline-none"],
  ["jsx-tailwind-order", "md:order-2"],
  ["jsx-tailwind-fixed-text", "text-[14px]"]
]) {
  test(`${rule} reads JSX strings, static templates and class helper string arguments`, async () => {
    for (const attribute of [
      `"${classes}"`, `{'${classes}'}`, "{`" + classes + "`}",
      ...["clsx", "cn", "twMerge", "classNames"].map((helper) => `{${helper}(dynamic, 'p-2', '${classes}')}`),
      "{cn(`" + classes + "`, dynamic)}", `{twMerge(clsx('${classes}', dynamic))}`
    ]) assert.deepEqual(await customRuleIds(rule, `const a = <button className=${attribute}>保存</button>;`), [`anw/${rule}`], attribute);
  });
}

test("Tailwind focus rule reports removed outlines without a focus replacement", async () => {
  for (const classes of [
    "outline-none", "focus:outline-none", "focus-visible:outline-none", "md:focus-visible:outline-none",
    "outline-none ring-2", "outline-none hover:ring-2", "focus:outline-none focus-visible:outline-none",
    "outline-none focus-within:ring-2", "outline-none focusable:ring-2", "!outline-none", "outline-none!"
  ]) assert.deepEqual(await customRuleIds("jsx-tailwind-focus", `const a = <button className="${classes}" />;`), ["anw/jsx-tailwind-focus"], classes);
});

test("Tailwind focus rule accepts every specified replacement including responsive variants", async () => {
  for (const replacement of [
    "focus:ring", "focus-visible:ring", "focus:ring-2", "md:focus-visible:ring-blue-500", "focus:outline-2",
    "focus-visible:outline-blue-500", "focus:border", "focus-visible:border-2", "focus:shadow", "focus-visible:shadow-md",
    "focus:bg-blue-500", "focus-visible:bg-white", "focus:underline", "focus-visible:underline", "dark:md:focus:!ring-2"
  ]) assert.deepEqual(await customRuleIds("jsx-tailwind-focus", `const a = <button className="outline-none ${replacement}" />;`), [], replacement);
  assert.deepEqual(await customRuleIds("jsx-tailwind-focus", "const a = <button className={cn('outline-none', dynamic, 'focus-visible:ring-2')} />;"), []);
  for (const classes of ["outline-hidden", "my-outline-none", "focus:ring-2", "", "[&:focus]:bg-[url('outline-none')]"]) {
    assert.deepEqual(await customRuleIds("jsx-tailwind-focus", `const a = <button className="${classes}" />;`), [], classes);
  }
});

test("Tailwind order rule reports order utilities and reversed flex directions", async () => {
  for (const classes of ["order-1", "order-first", "order-last", "order-none", "md:order-2", "lg:hover:order-[3]", "-order-1", "flex-row-reverse", "md:flex-col-reverse"]) {
    assert.deepEqual(await customRuleIds("jsx-tailwind-order", `const a = <div className="${classes}" />;`), ["anw/jsx-tailwind-order"], classes);
  }
  for (const classes of ["flex-row", "md:flex-col", "border-2", "my-order-2", "flex-row-reverse-extra", "[&_.order-2]:block", ""]) {
    assert.deepEqual(await customRuleIds("jsx-tailwind-order", `const a = <div className="${classes}" />;`), [], classes);
  }
});

test("Tailwind fixed text rule reports arbitrary pixel font sizes and line heights", async () => {
  for (const classes of ["text-[14px]", "leading-[20px]", "md:text-[12.5px]", "lg:leading-[18px]", "text-[.5px]", "text-[0px]"]) {
    assert.deepEqual(await customRuleIds("jsx-tailwind-fixed-text", `const a = <p className="${classes}" />;`), ["anw/jsx-tailwind-fixed-text"], classes);
  }
  for (const classes of ["text-sm", "leading-normal", "text-[1rem]", "leading-[1.5em]", "text-[120%]", "w-[14px]", "text-[red]", "text-[var(--size)]", "my-text-[14px]", ""]) {
    assert.deepEqual(await customRuleIds("jsx-tailwind-fixed-text", `const a = <p className="${classes}" />;`), [], classes);
  }
});

test("Tailwind rules ignore dynamic expressions and unrelated attributes", async () => {
  for (const rule of tailwindRules) {
    for (const attribute of [
      "{classes}", "{active ? 'outline-none order-2 text-[14px]' : ''}",
      "{`outline-none order-2 text-[14px] ${dynamic}`}", "{'outline-none order-2 text-[14px]' + dynamic}",
      "{makeClasses('outline-none order-2 text-[14px]')}",
      "{cn({ 'outline-none order-2 text-[14px]': active }, dynamic)}", "{cn(['outline-none order-2 text-[14px]'])}",
      "{cn(active && 'outline-none order-2 text-[14px]')}", "{42}"
    ]) assert.deepEqual(await customRuleIds(rule, `const a = <div className=${attribute} />;`), [], `${rule}: ${attribute}`);
    assert.deepEqual(await customRuleIds(rule, 'const a = <div title="outline-none order-2 text-[14px]" />;'), []);
  }
});

test("Tailwind rules report once per element even when multiple classes match", async () => {
  for (const [rule, classes] of [
    ["jsx-tailwind-focus", "outline-none focus:outline-none"],
    ["jsx-tailwind-order", "order-2 flex-col-reverse"],
    ["jsx-tailwind-fixed-text", "text-[14px] leading-[20px]"]
  ]) assert.deepEqual(await customRuleIds(rule, `const a = <div className="${classes}" />;`), [`anw/${rule}`]);
});
