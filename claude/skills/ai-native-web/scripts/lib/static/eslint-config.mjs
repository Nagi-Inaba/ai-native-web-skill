import jsxA11y from "eslint-plugin-jsx-a11y";
import tsParser from "@typescript-eslint/parser";
import html from "@html-eslint/eslint-plugin";
import htmlParser from "@html-eslint/parser";
import { anwEslintPlugin } from "./eslint-rules.mjs";
import { DEFAULT_COMPONENTS } from "./project-config.mjs";

function isOff(value) {
  return (Array.isArray(value) ? value[0] : value) === "off";
}

const recommended = jsxA11y.flatConfigs.recommended.rules;
// Keep the recommended options (they ignore input/textarea, which anw/jsx-input-label handles)
// so that correctly associated <label htmlFor> inputs are not reported.
const [, controlLabelOptions] = recommended["jsx-a11y/control-has-associated-label"];

export const JSX_RULES = Object.fromEntries(
  Object.entries({
    ...recommended,
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/control-has-associated-label": ["error", controlLabelOptions],
    "jsx-a11y/html-has-lang": "error",
    "anw/jsx-meaningful-alt": "error",
    "anw/jsx-input-label": "error",
    "anw/jsx-static-aria-state": "error",
    "anw/jsx-tailwind-focus": "error",
    "anw/jsx-tailwind-order": "error",
    "anw/jsx-tailwind-fixed-text": "error"
  }).filter(([, value]) => !isOff(value))
);

export const HTML_RULES = {
  "@html-eslint/require-img-alt": "error",
  "@html-eslint/require-lang": "error",
  "@html-eslint/require-title": "error",
  "@html-eslint/no-non-scalable-viewport": "error",
  "@html-eslint/require-input-label": "error",
  "@html-eslint/require-frame-title": "error",
  "@html-eslint/no-duplicate-id": "error",
  "@html-eslint/no-skip-heading-levels": "error",
  "@html-eslint/no-empty-headings": "error",
  "@html-eslint/no-heading-inside-button": "error",
  "@html-eslint/no-invalid-role": "error",
  "@html-eslint/no-redundant-role": "error",
  "@html-eslint/no-abstract-roles": "error",
  "@html-eslint/no-aria-hidden-on-focusable": "error",
  "@html-eslint/no-nested-interactive": "error",
  "@html-eslint/no-positive-tabindex": "error",
  "@html-eslint/no-accesskey-attrs": "error",
  "anw/html-meaningful-alt": "error"
};

export function eslintConfig(projectConfig = {}) {
  const jsxSettings = { components: { ...DEFAULT_COMPONENTS, ...projectConfig.components } };
  if (projectConfig.polymorphicPropName !== undefined) jsxSettings.polymorphicPropName = projectConfig.polymorphicPropName;
  return [
    // Unused eslint-disable directives in the project are not accessibility findings.
    { linterOptions: { reportUnusedDisableDirectives: "off" } },
    {
      files: ["**/*.{js,jsx,tsx}"],
      languageOptions: { parser: tsParser, parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { "jsx-a11y": jsxA11y, anw: anwEslintPlugin },
      settings: { "jsx-a11y": jsxSettings },
      rules: JSX_RULES
    },
    {
      files: ["**/*.html"],
      languageOptions: { parser: htmlParser },
      plugins: { "@html-eslint": html, anw: anwEslintPlugin },
      rules: HTML_RULES
    }
  ];
}
