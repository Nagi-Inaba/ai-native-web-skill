import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = "ai-native-web.config.json";
const CONFIG_KEYS = new Set(["components", "polymorphicPropName", "ignore"]);
export const DEFAULT_COMPONENTS = Object.freeze({ Image: "img" });

function invalid(key, expected) {
  throw new Error(`Invalid ${CONFIG_FILE}: ${key} ${expected}.`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function loadProjectConfig(root) {
  let source;
  try {
    source = fs.readFileSync(path.join(root, CONFIG_FILE), "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { components: { ...DEFAULT_COMPONENTS }, ignore: [] };
    throw new Error(`Cannot read ${CONFIG_FILE}: ${error.message}`, { cause: error });
  }
  let config;
  try {
    config = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid ${CONFIG_FILE}: invalid JSON (${error.message}).`, { cause: error });
  }
  if (!isObject(config)) invalid("root", "must be an object");
  for (const key of Object.keys(config)) {
    if (!CONFIG_KEYS.has(key)) invalid(key, "is an unknown key");
  }
  if (Object.hasOwn(config, "components")) {
    if (!isObject(config.components)) invalid("components", "must be an object mapping component names to strings");
    for (const [name, tag] of Object.entries(config.components)) {
      if (typeof tag !== "string") invalid(`components.${name}`, "must be a string");
    }
  }
  if (Object.hasOwn(config, "polymorphicPropName") && typeof config.polymorphicPropName !== "string") {
    invalid("polymorphicPropName", "must be a string");
  }
  if (Object.hasOwn(config, "ignore")) {
    if (!Array.isArray(config.ignore)) invalid("ignore", "must be an array of strings");
    config.ignore.forEach((glob, index) => {
      if (typeof glob !== "string") invalid(`ignore[${index}]`, "must be a string");
    });
  }
  return { ...config, components: { ...DEFAULT_COMPONENTS, ...config.components }, ignore: config.ignore ?? [] };
}

function normalizedPath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//u, "");
}

// Only * and ** are glob operators; everything else is literal text.
function globRegexp(glob) {
  const pattern = normalizedPath(glob);
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      index += 1;
      if (pattern[index + 1] === "/") {
        expression += "(?:[^/]+/)*";
        index += 1;
      } else expression += ".*";
    } else if (character === "*") expression += "[^/]*";
    else expression += character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  }
  return new RegExp(`${expression}$`, "u");
}

export function createIgnoreMatcher(globs = []) {
  const patterns = globs.map(globRegexp);
  return (relativePath) => patterns.some((pattern) => pattern.test(normalizedPath(relativePath)));
}
