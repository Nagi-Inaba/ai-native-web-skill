#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { toMarkdown, issueCount } from "./lib/report.mjs";

const USAGE = `Usage:
  ai-native-web static <project-dir> [--json]
  ai-native-web check (--url <loopback-url> | --dev <project-dir> [--dev-command "<command>"]) [--path <route>]... [--toggle <selector>]... [--tab-steps <n>] [--json]
  ai-native-web doctor [--json]

Exit codes: 0 no issues, 1 issues found, 2 usage or runtime error.`;

export class UsageError extends Error {}

const CHECK_ONLY_OPTIONS = ["--url", "--dev", "--dev-command", "--path", "--toggle", "--tab-steps"];

// Argument validation must work even before npm dependencies are installed.
function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, positional: [], paths: [], toggles: [], json: false, tabSteps: 30, devCommand: "npm run dev" };
  const seen = new Set();
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) throw new UsageError(`${arg} needs a value`);
      i += 1;
      return next;
    };
    if (arg.startsWith("--")) seen.add(arg);
    if (arg === "--json") options.json = true;
    else if (arg === "--url") options.url = value();
    else if (arg === "--dev") options.dev = value();
    else if (arg === "--dev-command") options.devCommand = value();
    else if (arg === "--path") options.paths.push(value());
    else if (arg === "--toggle") options.toggles.push(value());
    else if (arg === "--tab-steps") options.tabSteps = Number(value());
    else if (arg.startsWith("--")) throw new UsageError(`Unknown option ${arg}`);
    else options.positional.push(arg);
  }
  if (command === "static") {
    if (options.positional.length !== 1) throw new UsageError("static needs exactly one project directory");
    const misplaced = CHECK_ONLY_OPTIONS.find((option) => seen.has(option));
    if (misplaced) throw new UsageError(`${misplaced} is not valid for static`);
  } else if (command === "check") {
    if (options.positional.length) throw new UsageError(`check takes no positional arguments (got ${options.positional.join(" ")})`);
    if (!options.url && !options.dev) throw new UsageError("check needs --url or --dev");
    if (options.url && options.dev) throw new UsageError("check takes either --url or --dev, not both");
    if (seen.has("--dev-command") && !options.dev) throw new UsageError("--dev-command requires --dev");
    // Validate before any network access (waitForHttp would otherwise contact the host).
    if (options.url && !isLoopbackUrl(options.url)) throw new UsageError(`check --url must be a loopback URL (localhost, 127.0.0.1 or [::1]): ${options.url}`);
    for (const route of options.paths) {
      let resolved;
      try { resolved = new URL(route, options.url ?? "http://localhost/").href; } catch { /* Rejected below. */ }
      if (!isLoopbackUrl(resolved)) throw new UsageError(`check --path must resolve to a loopback URL: ${route}`);
    }
    if (!Number.isInteger(options.tabSteps) || options.tabSteps < 1 || options.tabSteps > 200) throw new UsageError("--tab-steps must be an integer from 1 to 200");
  } else if (command === "doctor") {
    if (options.positional.length) throw new UsageError("doctor takes no positional arguments");
    const misplaced = CHECK_ONLY_OPTIONS.find((option) => seen.has(option));
    if (misplaced) throw new UsageError(`${misplaced} is not valid for doctor`);
  } else {
    throw new UsageError(`Unknown command ${command ?? "(none)"}`);
  }
  return options;
}

async function runCheck(options, runBrowserChecks, { startDevServer, waitForHttp }) {
  let dev;
  let url = options.url;
  if (options.dev) {
    dev = await startDevServer({ cwd: path.resolve(options.dev), command: options.devCommand });
    url = dev.url;
  }
  try {
    await waitForHttp(url);
    return await runBrowserChecks(url, { paths: options.paths, toggles: options.toggles, tabSteps: options.tabSteps });
  } finally {
    await dev?.stop();
  }
}

export async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}\n`);
    return 2;
  }
  try {
    let report;
    if (options.command === "static") {
      const { analyzeProject } = await import("./lib/static/analyze.mjs");
      report = await analyzeProject(options.positional[0]);
    } else if (options.command === "doctor") {
      const { runDoctor } = await import("./doctor.mjs");
      report = await runDoctor();
    } else {
      const { runBrowserChecks } = await import("./lib/browser/check.mjs");
      const devServer = await import("./lib/browser/dev-server.mjs");
      report = await runCheck(options, runBrowserChecks, devServer);
    }
    process.stdout.write(options.json ? `${JSON.stringify(report, null, 2)}\n` : toMarkdown(report));
    if (report.kind === "doctor") return report.ok ? 0 : 2;
    return issueCount(report) ? 1 : 0;
  } catch (error) {
    process.stderr.write(error.code === "ERR_MODULE_NOT_FOUND"
      ? "Missing npm dependencies. Run npm install in the skill directory, then retry.\n"
      : `${error.message}\n`);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
