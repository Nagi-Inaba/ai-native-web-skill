import stylelint from "stylelint";

const { createPlugin, utils: { report, ruleMessages } } = stylelint;

export const FOCUS_RULE = "anw/focus-outline-replaced";
export const MOTION_RULE = "anw/reduced-motion-branch";

const REMOVED_VALUE = /^(none|initial|0(?:[a-z%]+)?)$/iu;
const NON_INDICATOR_VALUE = /^(none|0(?:[a-z%]+)?|transparent|initial)$/iu;
const REPLACEMENT_PROPS = new Set([
  "outline", "outline-color", "outline-style", "outline-width",
  "box-shadow",
  "border", "border-color", "border-width", "border-style", "border-bottom",
  "background", "background-color",
  "text-decoration", "text-decoration-line"
]);
const MOTION_PROPS = /^(animation|animation-name|transition|transition-property)$/iu;

function splitTopLevelSelectors(selector) {
  const selectors = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = null;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (!brackets && character === "(") parentheses += 1;
    else if (!brackets && character === ")") parentheses -= 1;
    else if (!brackets && !parentheses && character === ",") {
      selectors.push(selector.slice(start, index));
      start = index + 1;
    }
  }
  selectors.push(selector.slice(start));
  return selectors;
}

function lastCompound(selector) {
  const trimmed = selector.trim();
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = null;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (!brackets && character === "(") parentheses += 1;
    else if (!brackets && character === ")") parentheses -= 1;
    else if (!brackets && !parentheses && (/\s/u.test(character) || character === ">" || character === "+" || character === "~")) start = index + 1;
  }
  return trimmed.slice(start).trim();
}

function matchingParenthesis(value, open) {
  let depth = 1;
  let quote = null;
  for (let index = open + 1; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "(") depth += 1;
    else if (character === ")" && --depth === 0) return index;
  }
  return value.length - 1;
}

function hasPositiveFocus(compound) {
  let brackets = 0;
  let quote = null;
  for (let index = 0; index < compound.length; index += 1) {
    const character = compound[index];
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === "[") brackets += 1;
    else if (character === "]") brackets -= 1;
    else if (!brackets && character === ":") {
      const match = /^[a-z-]+/iu.exec(compound.slice(index + 1));
      if (!match) continue;
      const name = match[0].toLowerCase();
      const end = index + 1 + match[0].length;
      if (name === "not" && compound[end] === "(") index = matchingParenthesis(compound, end);
      else if (name === "focus" || name === "focus-visible") return true;
      else index = end - 1;
    }
  }
  return false;
}

function selectorTargetsFocus(selector) {
  return splitTopLevelSelectors(selector).some((part) => hasPositiveFocus(lastCompound(part)));
}

const focusMessages = ruleMessages(FOCUS_RULE, {
  rejected: (selector) => `'${selector}' removes the focus outline without a replacement indicator.`
});

function focusRule() {
  return (root, result) => {
    root.walkRules((rule) => {
      if (!selectorTargetsFocus(rule.selector)) return;
      let removed = null;
      let replaced = false;
      rule.walkDecls((decl) => {
        const prop = decl.prop.toLowerCase();
        const value = decl.value.trim().toLowerCase();
        if ((prop === "outline" || prop === "outline-style") && REMOVED_VALUE.test(value)) removed = decl;
        else if (REPLACEMENT_PROPS.has(prop) && !NON_INDICATOR_VALUE.test(value)) replaced = true;
      });
      if (removed && !replaced) report({ ruleName: FOCUS_RULE, result, node: removed, message: focusMessages.rejected(rule.selector) });
    });
  };
}
focusRule.ruleName = FOCUS_RULE;
focusRule.messages = focusMessages;

const motionMessages = ruleMessages(MOTION_RULE, {
  missing: "Animations or transitions exist but no @media (prefers-reduced-motion) branch was found in this file."
});

function motionRule() {
  return (root, result) => {
    let hasReducedBranch = false;
    const moving = [];
    root.walkAtRules("media", (atRule) => {
      if (/\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/iu.test(atRule.params)) hasReducedBranch = true;
    });
    root.walkDecls((decl) => {
      if (MOTION_PROPS.test(decl.prop) && decl.value.trim().toLowerCase() !== "none") moving.push(decl);
    });
    if (moving.length && !hasReducedBranch) report({ ruleName: MOTION_RULE, result, node: moving[0], message: motionMessages.missing });
  };
}
motionRule.ruleName = MOTION_RULE;
motionRule.messages = motionMessages;

export const anwStylelintPlugins = [createPlugin(FOCUS_RULE, focusRule), createPlugin(MOTION_RULE, motionRule)];

export function stylelintConfig() {
  return { plugins: anwStylelintPlugins, rules: { [FOCUS_RULE]: true, [MOTION_RULE]: true } };
}
