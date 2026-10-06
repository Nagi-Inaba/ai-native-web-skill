import { spawn } from "node:child_process";

const URL_IN_LOG = /https?:\/\/[^\s\u001b\u009b"'`]+/gu;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function extractLoopbackUrl(text) {
  let latest = null;
  let latestLocal = null;
  for (const line of text.split(/[\r\n]/u)) {
    for (const [candidate] of line.matchAll(URL_IN_LOG)) {
      try {
        if (!LOOPBACK_HOSTS.has(new URL(candidate).hostname)) continue;
      } catch {
        continue;
      }
      latest = candidate;
      if (/\bLocal\b/iu.test(line)) latestLocal = candidate;
    }
  }
  return latestLocal ?? latest;
}

export function stopProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null || !child.pid) return Promise.resolve();
  const windows = process.platform === "win32";
  return new Promise((resolve) => {
    let escalationTimer;
    let killer;
    const finish = () => {
      clearTimeout(escalationTimer);
      clearTimeout(deadlineTimer);
      child.removeListener("exit", onExit);
      child.removeListener("error", finish);
      resolve();
    };
    const onExit = () => {
      if (windows) return finish();
      // A shell can exit while descendants still occupy its process group.
      try { process.kill(-child.pid, 0); } catch (error) {
        if (error.code === "ESRCH") finish();
      }
    };
    // Bound shutdown even when the OS utility or the child never emits exit.
    const deadlineTimer = setTimeout(() => {
      try { killer?.kill(); } catch { /* The utility may already be gone. */ }
      finish();
    }, 5000);
    child.once("exit", onExit);
    child.once("error", finish);
    try {
      if (windows) {
        killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        killer.once("error", finish);
        killer.once("exit", (code) => { if (code !== 0) finish(); });
      } else {
        escalationTimer = setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGKILL");
            onExit();
          } catch { finish(); }
        }, 3000);
        process.kill(-child.pid, "SIGTERM");
      }
    } catch {
      finish();
    }
  });
}

export function startDevServer({ cwd, command = "npm run dev", timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      detached: process.platform !== "win32",
      env: { ...process.env, BROWSER: "none", FORCE_COLOR: "0", NO_COLOR: "1" }
    });
    let output = "";
    let settled = false;
    const finish = (error, url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) stopProcess(child).then(() => reject(error));
      else resolve({ url, process: child, stop: () => stopProcess(child) });
    };
    const timer = setTimeout(() => finish(new Error(`Dev server printed no loopback URL within ${timeoutMs}ms.\n${output}`)), timeoutMs);
    const onData = (chunk) => {
      output += chunk;
      const url = extractLoopbackUrl(output);
      if (url) finish(null, url);
    };
    child.stdout.setEncoding("utf8").on("data", onData);
    child.stderr.setEncoding("utf8").on("data", onData);
    // "close" fires after stdout/stderr are drained, so early-exit output is complete.
    child.on("close", (code) => finish(new Error(`Dev server exited with code ${code} before it was ready.\n${output}`)));
    child.on("error", (error) => finish(error));
  });
}

export async function waitForHttp(url, { timeoutMs = 60000, intervalMs = 250 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      // A 3xx already proves the server is up; following it could reach a non-loopback host.
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
      if (response.status < 500) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    const remaining = deadline - Date.now();
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, Math.min(intervalMs, remaining)));
  }
  throw new Error(`Dev server at ${url} did not respond within ${timeoutMs}ms: ${lastError?.message}`);
}
