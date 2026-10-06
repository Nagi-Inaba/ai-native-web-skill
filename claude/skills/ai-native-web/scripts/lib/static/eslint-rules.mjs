import { DEFAULT_COMPONENTS } from "./project-config.mjs";

const PLACEHOLDER_WORDS = /^(image|img|picture|photo|icon|graphic|画像|写真|イメージ|アイコン|図)$/iu;
const FILE_NAME = /^\S+\.(png|jpe?g|gif|webp|svg|avif|bmp)$/iu;

export function isMeaninglessAlt(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return PLACEHOLDER_WORDS.test(trimmed) || FILE_NAME.test(trimmed);
}

const messages = { meaningless: "alt '{{value}}' does not describe the image. Describe its content, or use alt=\"\" if it is decorative." };

const jsxMeaningfulAlt = {
  meta: { type: "problem", messages, schema: [] },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "alt" || node.value?.type !== "Literal") return;
        if (jsxElementType(node.parent, context) !== "img") return;
        const value = String(node.value.value);
        if (isMeaninglessAlt(value)) context.report({ node, messageId: "meaningless", data: { value: value.trim() } });
      }
    };
  }
};

const htmlMeaningfulAlt = {
  meta: { type: "problem", messages, schema: [] },
  create(context) {
    return {
      Tag(node) {
        if (node.name !== "img") return;
        const alt = node.attributes.find((attribute) => attribute.key.value.toLowerCase() === "alt");
        const value = alt?.value?.value;
        if (value !== undefined && isMeaninglessAlt(value)) context.report({ node: alt, messageId: "meaningless", data: { value: value.trim() } });
      }
    };
  }
};

const FORM_CONTROLS = new Set(["input", "select", "textarea"]);
const INPUT_TYPES_WITHOUT_LABEL = new Set(["hidden", "submit", "reset", "button", "image"]);

function jsxAttribute(node, name) {
  return node.attributes.find((attribute) => attribute.type === "JSXAttribute" && attribute.name?.name === name);
}

// Returns the string value, undefined when the attribute is absent, or null when it is dynamic.
function literalValue(attribute) {
  if (!attribute) return undefined;
  if (attribute.value?.type === "Literal") return String(attribute.value.value);
  if (attribute.value?.type === "JSXExpressionContainer" && attribute.value.expression.type === "Literal") return String(attribute.value.expression.value);
  return null;
}

function jsxName(node) {
  if (node.type === "JSXIdentifier") return node.name;
  if (node.type === "JSXMemberExpression") return `${jsxName(node.object)}.${jsxName(node.property)}`;
  if (node.type === "JSXNamespacedName") return `${node.namespace.name}:${node.name.name}`;
  return null;
}

function jsxElementType(node, context) {
  const settings = context.settings["jsx-a11y"] ?? {};
  let tag = jsxName(node.name);
  if (settings.polymorphicPropName) {
    const attribute = jsxAttribute(node, settings.polymorphicPropName);
    const value = attribute?.value?.type === "JSXExpressionContainer" ? attribute.value.expression : attribute?.value;
    if (value?.type === "Literal" && typeof value.value === "string" && value.value) tag = value.value;
  }
  const components = settings.components ?? DEFAULT_COMPONENTS;
  return Object.hasOwn(components, tag) ? components[tag] : tag;
}

function isInsideLabel(element, context) {
  for (let parent = element.parent; parent; parent = parent.parent) {
    if (parent.type === "JSXElement" && jsxElementType(parent.openingElement, context) === "label") return true;
  }
  return false;
}

function hasUsableAriaLabel(node) {
  return ["aria-label", "aria-labelledby"].some((name) => {
    const attribute = jsxAttribute(node, name);
    if (!attribute || !attribute.value) return false;
    const value = literalValue(attribute);
    return value === null || (value !== undefined && value.trim() !== "");
  });
}

const jsxInputLabel = {
  meta: {
    type: "problem",
    messages: { missing: "<{{tag}}> has no associated label (label htmlFor, wrapping label, aria-label or aria-labelledby)." },
    schema: []
  },
  create(context) {
    const controls = [];
    const labelTargets = new Set();
    return {
      JSXOpeningElement(node) {
        const tag = jsxElementType(node, context);
        if (tag === "label") {
          const target = literalValue(jsxAttribute(node, "htmlFor"));
          if (target) labelTargets.add(target);
          return;
        }
        if (!FORM_CONTROLS.has(tag)) return;
        if (node.attributes.some((attribute) => attribute.type === "JSXSpreadAttribute")) return;
        if (tag === "input" && INPUT_TYPES_WITHOUT_LABEL.has(literalValue(jsxAttribute(node, "type")) ?? "")) return;
        if (hasUsableAriaLabel(node) || isInsideLabel(node.parent, context)) return;
        controls.push({ node, tag, id: literalValue(jsxAttribute(node, "id")) });
      },
      "Program:exit"() {
        for (const control of controls) {
          if (control.id === null) continue;
          if (control.id !== undefined && labelTargets.has(control.id)) continue;
          context.report({ node: control.node, messageId: "missing", data: { tag: control.tag } });
        }
      }
    };
  }
};

// State attributes that must follow the UI state. aria-current is excluded: a
// literal value is normal for server-rendered navigation.
const DYNAMIC_STATE_ATTRIBUTES = ["aria-expanded", "aria-pressed", "aria-selected", "aria-checked"];
const INTERACTION_HANDLER = /^on(Click|KeyDown|KeyUp|PointerDown|PointerUp|MouseDown|Change|Input|Toggle)$/u;

function hasInteractionHandler(node) {
  return node.attributes.some((attribute) => attribute.type === "JSXAttribute" && INTERACTION_HANDLER.test(attribute.name?.name ?? ""));
}

const jsxStaticAriaState = {
  meta: {
    type: "problem",
    messages: {
      literal: "{{name}} is a fixed literal on an element that handles {{handler}}; bind it to the UI state so the DOM and accessibility tree change with the visuals."
    },
    schema: []
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.attributes.some((attribute) => attribute.type === "JSXSpreadAttribute")) return;
        if (!hasInteractionHandler(node)) return;
        for (const name of DYNAMIC_STATE_ATTRIBUTES) {
          const attribute = jsxAttribute(node, name);
          const value = literalValue(attribute);
          if (attribute && typeof value === "string" && (value === "true" || value === "false")) {
            const handler = node.attributes.find((a) => a.type === "JSXAttribute" && INTERACTION_HANDLER.test(a.name?.name ?? "")).name.name;
            context.report({ node: attribute, messageId: "literal", data: { name, handler } });
          }
        }
      }
    };
  }
};

const CLASS_HELPERS = new Set(["clsx", "cn", "twMerge", "classNames"]);

function staticClassStrings(node) {
  if (!node) return [];
  if (node.type === "Literal" && typeof node.value === "string") return [node.value];
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return [node.quasis.map((part) => part.value.cooked ?? part.value.raw).join("")];
  if (node.type === "CallExpression" && node.callee.type === "Identifier" && CLASS_HELPERS.has(node.callee.name)) {
    return node.arguments.flatMap(staticClassStrings);
  }
  return [];
}

// Colons inside arbitrary variants/values are not variant separators.
function tailwindClass(token) {
  const variants = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < token.length; index += 1) {
    if (token[index] === "\\") index += 1;
    else if (token[index] === "[" || token[index] === "(") depth += 1;
    else if (token[index] === "]" || token[index] === ")") depth -= 1;
    else if (token[index] === ":" && depth === 0) {
      variants.push(token.slice(start, index));
      start = index + 1;
    }
  }
  return { variants, utility: token.slice(start).replace(/^!|!$/gu, "") };
}

function tailwindRule(message, rejects) {
  return {
    meta: { type: "problem", messages: { rejected: message }, schema: [] },
    create(context) {
      return {
        JSXAttribute(node) {
          if (node.name?.name !== "className") return;
          const value = node.value?.type === "JSXExpressionContainer" ? node.value.expression : node.value;
          const classes = staticClassStrings(value).flatMap((text) => text.split(/\s+/u).filter(Boolean)).map(tailwindClass);
          if (rejects(classes)) context.report({ node, messageId: "rejected" });
        }
      };
    }
  };
}

const FOCUS_REPLACEMENT = /^(?:ring(?:-|$)|outline-(?!none$)|border(?:-|$)|shadow(?:-|$)|bg-|underline(?:-|$))/u;

const jsxTailwindFocus = tailwindRule(
  "Tailwind outline-none removes the focus outline without a focus or focus-visible replacement indicator.",
  (classes) => classes.some(({ utility }) => utility === "outline-none") && !classes.some(({ variants, utility }) =>
    variants.some((variant) => variant === "focus" || variant === "focus-visible") && FOCUS_REPLACEMENT.test(utility))
);

const jsxTailwindOrder = tailwindRule(
  "Tailwind order or reversed flex direction can make visual order differ from DOM and accessibility tree order; verify the reading and keyboard order in the browser.",
  (classes) => classes.some(({ utility }) => /^-?order-.+/u.test(utility) || utility === "flex-row-reverse" || utility === "flex-col-reverse")
);

const jsxTailwindFixedText = tailwindRule(
  "Tailwind arbitrary pixel font size or line height can constrain text resizing; verify zoom and text spacing in the browser.",
  (classes) => classes.some(({ utility }) => /^(?:text|leading)-\[(?:\d+(?:\.\d+)?|\.\d+)px\]$/u.test(utility))
);

export const anwEslintPlugin = {
  meta: { name: "anw" },
  rules: {
    "jsx-meaningful-alt": jsxMeaningfulAlt,
    "html-meaningful-alt": htmlMeaningfulAlt,
    "jsx-input-label": jsxInputLabel,
    "jsx-static-aria-state": jsxStaticAriaState,
    "jsx-tailwind-focus": jsxTailwindFocus,
    "jsx-tailwind-order": jsxTailwindOrder,
    "jsx-tailwind-fixed-text": jsxTailwindFixedText
  }
};
