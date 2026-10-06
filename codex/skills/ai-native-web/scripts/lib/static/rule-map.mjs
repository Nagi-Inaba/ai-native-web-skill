const c = (recipe) => ({ recipe, certainty: "confirmed" });
const b = (recipe) => ({ recipe, certainty: "needs_browser" });

export const RULE_MAP = {
  "jsx-a11y/alt-text": c("content-equivalence"),
  "jsx-a11y/img-redundant-alt": c("content-equivalence"),
  "jsx-a11y/media-has-caption": c("content-equivalence"),
  "jsx-a11y/scope": c("content-equivalence"),
  "anw/jsx-meaningful-alt": c("content-equivalence"),
  "anw/html-meaningful-alt": c("content-equivalence"),
  "@html-eslint/require-img-alt": c("content-equivalence"),

  "jsx-a11y/anchor-has-content": c("control-name-and-purpose"),
  "jsx-a11y/control-has-associated-label": b("control-name-and-purpose"),
  "jsx-a11y/label-has-associated-control": c("control-name-and-purpose"),
  "anw/jsx-input-label": b("control-name-and-purpose"),
  "anw/jsx-static-aria-state": b("dom-state-legibility"),
  "jsx-a11y/iframe-has-title": c("control-name-and-purpose"),
  "@html-eslint/require-input-label": c("control-name-and-purpose"),
  "@html-eslint/require-frame-title": c("control-name-and-purpose"),

  "jsx-a11y/heading-has-content": c("discoverable-structure"),
  "jsx-a11y/html-has-lang": c("discoverable-structure"),
  "@html-eslint/require-lang": c("discoverable-structure"),
  "@html-eslint/require-title": c("discoverable-structure"),
  "@html-eslint/no-duplicate-id": c("discoverable-structure"),
  "@html-eslint/no-skip-heading-levels": c("discoverable-structure"),
  "@html-eslint/no-empty-headings": c("discoverable-structure"),
  "@html-eslint/no-heading-inside-button": c("discoverable-structure"),
  "anw/jsx-tailwind-order": b("discoverable-structure"),

  "jsx-a11y/anchor-is-valid": c("action-semantics"),
  "jsx-a11y/aria-props": c("action-semantics"),
  "jsx-a11y/aria-proptypes": c("action-semantics"),
  "jsx-a11y/aria-role": c("action-semantics"),
  "jsx-a11y/aria-unsupported-elements": c("action-semantics"),
  "jsx-a11y/click-events-have-key-events": c("action-semantics"),
  "jsx-a11y/interactive-supports-focus": c("action-semantics"),
  "jsx-a11y/mouse-events-have-key-events": c("action-semantics"),
  "jsx-a11y/no-access-key": c("action-semantics"),
  "jsx-a11y/no-interactive-element-to-noninteractive-role": c("action-semantics"),
  "jsx-a11y/no-noninteractive-element-interactions": c("action-semantics"),
  "jsx-a11y/no-noninteractive-element-to-interactive-role": c("action-semantics"),
  "jsx-a11y/no-redundant-roles": c("action-semantics"),
  "jsx-a11y/no-static-element-interactions": c("action-semantics"),
  "jsx-a11y/role-has-required-aria-props": c("action-semantics"),
  "jsx-a11y/role-supports-aria-props": c("action-semantics"),
  "@html-eslint/no-invalid-role": c("action-semantics"),
  "@html-eslint/no-redundant-role": c("action-semantics"),
  "@html-eslint/no-abstract-roles": c("action-semantics"),
  "@html-eslint/no-aria-hidden-on-focusable": c("action-semantics"),
  "@html-eslint/no-nested-interactive": c("action-semantics"),
  "@html-eslint/no-accesskey-attrs": c("action-semantics"),

  "jsx-a11y/autocomplete-valid": c("form-guidance-and-recovery"),

  "jsx-a11y/aria-activedescendant-has-tabindex": c("state-focus-sync"),
  "jsx-a11y/no-autofocus": c("state-focus-sync"),
  "jsx-a11y/no-noninteractive-tabindex": c("state-focus-sync"),
  "jsx-a11y/tabindex-no-positive": c("state-focus-sync"),
  "@html-eslint/no-positive-tabindex": c("state-focus-sync"),

  "jsx-a11y/no-distracting-elements": c("visual-perception"),
  "@html-eslint/no-non-scalable-viewport": c("visual-perception"),
  "anw/jsx-tailwind-focus": c("visual-perception"),
  "anw/jsx-tailwind-fixed-text": b("visual-perception"),
  "anw/focus-outline-replaced": b("visual-perception"),
  "anw/reduced-motion-branch": b("visual-perception")
};

export function classify(ruleId) {
  return RULE_MAP[ruleId] ?? { recipe: null, certainty: "needs_review" };
}
