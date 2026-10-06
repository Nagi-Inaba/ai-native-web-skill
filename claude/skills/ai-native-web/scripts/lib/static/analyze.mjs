import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import tsParser from "@typescript-eslint/parser";
import stylelint from "stylelint";
import { eslintConfig } from "./eslint-config.mjs";
import { stylelintConfig } from "./stylelint-rules.mjs";
import { classify } from "./rule-map.mjs";
import { loadProjectConfig, createIgnoreMatcher } from "./project-config.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage", ".vite", ".turbo"]);
const ESLINT_EXTENSIONS = new Set([".html", ".js", ".jsx", ".tsx"]);
const STYLELINT_EXTENSIONS = new Set([".css"]);
const GIT_CWD = fileURLToPath(new URL(".", import.meta.url));
const UNKNOWN_RULE_MESSAGE = /^Definition for rule '.+' was not found\.?$/u;
const SPREAD_SENSITIVE_JSX_RULES = new Set([
  "jsx-a11y/alt-text",
  "jsx-a11y/anchor-has-content",
  "jsx-a11y/anchor-is-valid",
  "jsx-a11y/aria-activedescendant-has-tabindex",
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/control-has-associated-label",
  "jsx-a11y/heading-has-content",
  "jsx-a11y/html-has-lang",
  "jsx-a11y/iframe-has-title",
  "jsx-a11y/interactive-supports-focus",
  "jsx-a11y/label-has-associated-control",
  "jsx-a11y/media-has-caption",
  "jsx-a11y/mouse-events-have-key-events",
  "jsx-a11y/no-noninteractive-element-interactions",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/role-has-required-aria-props"
]);

// Inside a git work tree, follow .gitignore: tracked plus untracked-but-not-ignored
// files. This skips build output and nested artifacts and avoids walking them.
function gitListedFiles(root) {
  // Disable repository fsmonitor hooks and avoid Windows executable lookup in
  // the caller's project directory. Git itself must be trusted on PATH.
  const result = spawnSync("git", ["-c", "core.fsmonitor=false", "-C", root, "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: GIT_CWD, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split("\0").filter(Boolean);
}

function isCollectable(relative) {
  const segments = relative.split("/");
  if (segments.slice(0, -1).some((segment) => SKIP_DIRS.has(segment))) return false;
  const ext = path.extname(relative).toLowerCase();
  return ESLINT_EXTENSIONS.has(ext) || STYLELINT_EXTENSIONS.has(ext);
}

function isProjectFile(physicalRoot, file) {
  try {
    if (!fs.lstatSync(file).isFile()) return false;
    const relative = path.relative(physicalRoot, fs.realpathSync(file));
    return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
  } catch (error) {
    if (["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) return false;
    throw error;
  }
}

export function collectFiles(root, ignore = []) {
  const physicalRoot = fs.realpathSync(root);
  const ignored = createIgnoreMatcher(ignore);
  const listed = gitListedFiles(root);
  if (listed) {
    return [...new Set(listed)]
      .filter((relative) => isCollectable(relative) && !ignored(relative))
      .map((relative) => path.join(root, relative))
      .filter((file) => isProjectFile(physicalRoot, file))
      .sort();
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).split(path.sep).join("/");
      if (ignored(relative)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !ignored(`${relative}/`)) walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if ((ESLINT_EXTENSIONS.has(ext) || STYLELINT_EXTENSIONS.has(ext)) && isProjectFile(physicalRoot, full)) files.push(full);
      }
    }
  };
  walk(root);
  return files.sort();
}

function finding(root, file, line, column, ruleId, message) {
  return {
    file: path.relative(root, file).split(path.sep).join("/"),
    line: line ?? 1,
    column: column ?? 1,
    ruleId,
    ...classify(ruleId),
    message
  };
}

const BACKDROP_RULES = new Set([
  "jsx-a11y/click-events-have-key-events",
  "jsx-a11y/no-static-element-interactions",
  "jsx-a11y/no-noninteractive-element-interactions"
]);
const BACKDROP_NOTE = " (Click-to-close backdrop: fine if the menu or dialog also closes with Escape and has a close button.)";

function literalAttribute(opening, name) {
  const attribute = opening.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
  if (attribute?.value?.type === "Literal") return String(attribute.value.value);
  return undefined;
}

// onClick={(e) => e.stopPropagation()} (or a block with only that call) keeps
// clicks inside a popover from reaching its backdrop; it is not a control.
function isClickGuard(opening) {
  const handler = opening.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "onClick")?.value?.expression;
  if (!handler || !["ArrowFunctionExpression", "FunctionExpression"].includes(handler.type)) return false;
  let body = handler.body;
  if (body.type === "BlockStatement") {
    if (body.body.length !== 1 || body.body[0].type !== "ExpressionStatement") return false;
    body = body.body[0].expression;
  }
  return body.type === "CallExpression" && body.callee.type === "MemberExpression" && body.callee.property?.name === "stopPropagation";
}

// An empty element with onClick that covers the screen (inset-0) or is hidden
// from assistive technology is a click-outside-to-close backdrop, not a control.
function isBackdrop(opening, element) {
  if (isClickGuard(opening)) return true;
  const empty = opening.selfClosing || (element?.children ?? []).every((child) => child.type === "JSXText" && !child.value.trim());
  if (!empty) return false;
  if (!opening.attributes.some((a) => a.type === "JSXAttribute" && a.name?.name === "onClick")) return false;
  return literalAttribute(opening, "aria-hidden") === "true" || /(^|\s)inset-0(\s|$)/u.test(literalAttribute(opening, "className") ?? "");
}

function toRange(node) {
  return { startLine: node.loc.start.line, startColumn: node.loc.start.column + 1, endLine: node.loc.end.line, endColumn: node.loc.end.column + 1 };
}

function openingElementRanges(file) {
  const ranges = { spread: [], backdrop: [] };
  let ast;
  try {
    ast = tsParser.parse(fs.readFileSync(file, "utf8"), {
      ecmaVersion: "latest",
      sourceType: "module",
      loc: true,
      ecmaFeatures: { jsx: true }
    });
  } catch {
    return ranges;
  }
  const seen = new WeakSet();
  const visit = (value) => {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value.type === "JSXElement") {
      const opening = value.openingElement;
      if (opening.attributes.some((attribute) => attribute.type === "JSXSpreadAttribute")) ranges.spread.push(toRange(opening));
      if (isBackdrop(opening, value)) ranges.backdrop.push(toRange(opening));
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "parent" && key !== "tokens" && key !== "comments") {
        if (Array.isArray(child)) child.forEach(visit);
        else visit(child);
      }
    }
  };
  visit(ast);
  return ranges;
}

function rangeContains(range, line, column) {
  if (!Number.isInteger(line) || !Number.isInteger(column)) return false;
  if (line < range.startLine || line > range.endLine) return false;
  if (line === range.startLine && column < range.startColumn) return false;
  if (line === range.endLine && column > range.endColumn) return false;
  return true;
}

async function runEslint(root, files, config) {
  if (!files.length) return [];
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: eslintConfig(config), errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles(files);
  return results.flatMap((result) => {
    const hasSensitiveFinding = result.messages.some((message) => SPREAD_SENSITIVE_JSX_RULES.has(message.ruleId) || BACKDROP_RULES.has(message.ruleId));
    const ranges = hasSensitiveFinding ? openingElementRanges(result.filePath) : { spread: [], backdrop: [] };
    const within = (list, message) => list.some((range) => rangeContains(range, message.line, message.column));
    // The project's own eslint-disable comments may name rules this analyzer does not load.
    return result.messages.filter((message) => !UNKNOWN_RULE_MESSAGE.test(message.message)).map((message) => {
      const ruleId = message.ruleId ?? "parse-error";
      const item = finding(root, result.filePath, message.line, message.column, ruleId, message.message);
      if (item.certainty === "confirmed" && BACKDROP_RULES.has(ruleId) && within(ranges.backdrop, message)) {
        item.certainty = "needs_review";
        item.message += BACKDROP_NOTE;
      } else if (item.certainty === "confirmed" && SPREAD_SENSITIVE_JSX_RULES.has(ruleId) && within(ranges.spread, message)) {
        item.certainty = "needs_browser";
      }
      return item;
    });
  });
}

async function runStylelint(root, files) {
  if (!files.length) return [];
  const { results } = await stylelint.lint({ files, config: stylelintConfig() });
  return results.flatMap((result) => result.warnings.map((w) => finding(root, result.source, w.line, w.column, w.rule, w.text.replace(/\s*\([^)]*\)$/u, ""))));
}

export async function analyzeProject(projectRoot) {
  const root = path.resolve(projectRoot);
  if (!fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const config = loadProjectConfig(root);
  const files = collectFiles(root, config.ignore);
  const eslintFiles = files.filter((f) => ESLINT_EXTENSIONS.has(path.extname(f).toLowerCase()));
  const cssFiles = files.filter((f) => STYLELINT_EXTENSIONS.has(path.extname(f).toLowerCase()));
  const findings = [...await runEslint(root, eslintFiles, config), ...await runStylelint(root, cssFiles)];
  findings.sort((a, b) => a.file.localeCompare(b.file, "en") || a.line - b.line || a.column - b.column);
  return { kind: "static", root, files: files.length, findings };
}
