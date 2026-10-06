import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillSource = path.join(repoRoot, "shared", "skill");
// Codex-only UI metadata (display name, description, default prompt).
const codexOverlay = path.join(repoRoot, "platform", "codex", "agents");
const SKILL_NAME = "ai-native-web";
const EXCLUDED = new Set(["node_modules"]);

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function resolvedPath(file) {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    if (error.code !== "ENOENT" || path.dirname(file) === file) throw error;
    return path.join(resolvedPath(path.dirname(file)), path.basename(file));
  }
}

function assertSafeTarget(root, resolvedRoot, target) {
  if (!isInside(root, target)) throw new Error(`Refusing to write outside ${root}`);
  let current = root;
  for (const segment of ["", ...path.relative(root, target).split(path.sep)]) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (!stat) break;
    if (stat.isSymbolicLink()) throw new Error(`Refusing symbolic link or junction at ${current}`);
    if (!isInside(resolvedRoot, fs.realpathSync(current))) throw new Error(`Refusing to write outside ${resolvedRoot}`);
  }
}

export function syncDistributions({ outRoot = repoRoot } = {}) {
  const root = path.resolve(outRoot);
  const resolvedRoot = resolvedPath(root);
  if (isInside(skillSource, root) || isInside(fs.realpathSync(skillSource), resolvedRoot)) throw new Error(`Output root ${root} is inside the skill source`);
  const targets = ["claude", "codex"].map((platform) => path.join(root, platform, "skills", SKILL_NAME));
  // Check both trees before removing or writing anything.
  for (const target of targets) assertSafeTarget(root, resolvedRoot, target);
  const written = [];
  for (const target of targets) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(skillSource, target, { recursive: true, filter: (src) => !EXCLUDED.has(path.basename(src)) });
    for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"]) fs.copyFileSync(path.join(repoRoot, name), path.join(target, name));
    if (target === targets[1]) fs.cpSync(codexOverlay, path.join(target, "agents"), { recursive: true });
    written.push(target);
  }
  return written;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  for (const target of syncDistributions()) console.log(`synced ${path.relative(repoRoot, target)}`);
}
