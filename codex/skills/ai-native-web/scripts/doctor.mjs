import { readFile } from "node:fs/promises";

export const CHROME_HELP = "Cannot launch Chrome: install Google Chrome or set ANW_BROWSER_CHANNEL.";

export async function runDoctor({ nodeVersion = process.versions.node, launchBrowser } = {}) {
  const [major, minor] = nodeVersion.split(".").map(Number);
  const node = { version: nodeVersion, minimum: "20.19.0", ok: major > 20 || (major === 20 && minor >= 19) };
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const dependencies = Object.keys(manifest.dependencies).map((name) => {
    try {
      import.meta.resolve(name);
      return { name, ok: true };
    } catch {
      return { name, ok: false, message: "Not installed. Run npm install in the skill directory." };
    }
  });
  const browser = { channel: process.env.ANW_BROWSER_CHANNEL ?? "chrome", ok: false };
  if (!dependencies.find((dependency) => dependency.name === "playwright-core")?.ok) {
    browser.message = "Cannot check Chrome without playwright-core. Run npm install in the skill directory, then retry.";
  } else {
    try {
      const launched = launchBrowser
        ? await launchBrowser({ channel: browser.channel, headless: true })
        : await (await import("playwright-core")).chromium.launch({ channel: browser.channel, headless: true });
      await launched.close();
      browser.ok = true;
    } catch (error) {
      browser.message = error.code === "ERR_MODULE_NOT_FOUND" ? "Missing npm dependencies. Run npm install in the skill directory, then retry." : CHROME_HELP;
    }
  }
  return { kind: "doctor", ok: node.ok && dependencies.every((dependency) => dependency.ok) && browser.ok, node, dependencies, browser };
}
