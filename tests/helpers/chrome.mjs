import { chromium } from "playwright-core";

export async function chromeAvailable() {
  try {
    const browser = await chromium.launch({ channel: process.env.ANW_BROWSER_CHANNEL ?? "chrome", headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}
