import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import net from "node:net";
import http from "node:http";
import childProcess, { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { fileURLToPath } from "node:url";
import { startDevServer, waitForHttp, extractLoopbackUrl, stopProcess } from "../shared/skill/scripts/lib/browser/dev-server.mjs";

const devApp = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "dev-app");

test("waitForHttp times out when a TCP server never responds", async () => {
  // Initialize Node's fetch machinery before measuring the short deadline.
  await fetch("data:text/plain,ready");
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const started = Date.now();
  const pending = waitForHttp(`http://127.0.0.1:${server.address().port}/`, { timeoutMs: 150, intervalMs: 1000 });
  let watchdog;
  try {
    await assert.rejects(Promise.race([
      pending,
      new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error("HTTP readiness exceeded its deadline")), 1000);
      })
    ]), /did not respond within 150ms/u);
    assert.ok(Date.now() - started < 350, "allow 200ms of scheduling overhead beyond the deadline");
    assert.ok(sockets.size > 0, "the server accepted a connection without responding");
  } finally {
    clearTimeout(watchdog);
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
    await pending.catch(() => {});
  }
});

test("extractLoopbackUrl reads Vite and Next style output", () => {
  assert.equal(extractLoopbackUrl("  ➜  Local:   \u001b[36mhttp://localhost:5173/\u001b[39m"), "http://localhost:5173/");
  assert.equal(extractLoopbackUrl("   - Local:        http://localhost:3000"), "http://localhost:3000");
  assert.equal(extractLoopbackUrl("   - Network:      http://192.168.0.2:3000"), null);
});

test("extractLoopbackUrl preserves deep links and stops at log delimiters", () => {
  const url = "http://localhost:3000/app/dashboard?x=1&tab=overview#heading";
  for (const suffix of [" next", "\u001b[39mnext", "\u009b39mnext", '"next', "'next", "`next"]) {
    assert.equal(extractLoopbackUrl(`  Local: \u001b[36m${url}${suffix}`), url);
  }
  assert.equal(extractLoopbackUrl("Local: https://[::1]:3000/app?x=1"), "https://[::1]:3000/app?x=1");
});

test("extractLoopbackUrl prefers the most recent Local URL", () => {
  assert.equal(extractLoopbackUrl([
    "debug: http://127.0.0.1:9000/health",
    "Local: http://localhost:3000/old",
    "Local: http://localhost:3001/first http://localhost:3002/app?x=1",
    "debug: http://localhost:9001/metrics"
  ].join("\n")), "http://localhost:3002/app?x=1");
  assert.equal(extractLoopbackUrl("http://localhost:3000/old\nhttp://127.0.0.1:3001/new"), "http://127.0.0.1:3001/new");
});

test("extractLoopbackUrl rejects non-loopback hosts and misleading host prefixes", () => {
  for (const url of ["http://192.168.0.2:3000/app", "http://localhost.example.com:3000/app", "http://127.0.0.1.example.com:3000/app", "http://localhost:3000@evil.example/app"]) {
    assert.equal(extractLoopbackUrl(`Local: ${url}`), null);
  }
  assert.equal(extractLoopbackUrl("Local: http://localhost:3000/app\nLocal: http://evil.example:4000/app"), "http://localhost:3000/app");
});

test("waitForHttp treats a redirect as ready without following it", async () => {
  const hits = [];
  const outside = http.createServer((req, res) => { hits.push(req.url); res.end("x"); });
  await new Promise((resolve) => outside.listen(0, "127.0.0.2", resolve));
  const server = http.createServer((req, res) => {
    res.writeHead(302, { location: `http://127.0.0.2:${outside.address().port}/followed` });
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await waitForHttp(`http://127.0.0.1:${server.address().port}/`, { timeoutMs: 2000 });
    assert.deepEqual(hits, []);
  } finally {
    server.closeAllConnections();
    outside.closeAllConnections();
    await Promise.all([new Promise((resolve) => server.close(resolve)), new Promise((resolve) => outside.close(resolve))]);
  }
});

test("waitForHttp accepts a 404 response as ready", async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await waitForHttp(`http://127.0.0.1:${server.address().port}/missing`, { timeoutMs: 1000 });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("stopProcess escalates SIGTERM to SIGKILL for the POSIX process group", async (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "linux" });
  t.after(() => Object.defineProperty(process, "platform", platform));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null });
  const signals = [];
  t.mock.method(process, "kill", (pid, signal) => {
    if (signal === 0) {
      if (child.signalCode !== null) throw Object.assign(new Error("No such process"), { code: "ESRCH" });
      return true;
    }
    signals.push([pid, signal]);
    if (signal === "SIGKILL") {
      child.signalCode = "SIGKILL";
      child.emit("exit", null, "SIGKILL");
    }
    return true;
  });
  let settled = false;
  const stopped = stopProcess(child).then(() => { settled = true; });
  assert.deepEqual(signals, [[-12345, "SIGTERM"]]);
  t.mock.timers.tick(3000);
  await Promise.resolve();
  assert.equal(settled, true, "shutdown must settle after escalation");
  assert.deepEqual(signals, [[-12345, "SIGTERM"], [-12345, "SIGKILL"]]);
  await stopped;
  assert.equal(child.listenerCount("exit"), 0);
});

test("stopProcess still kills the POSIX group if its leader exits on SIGTERM", async (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "linux" });
  t.after(() => Object.defineProperty(process, "platform", platform));
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null });
  let groupAlive = true;
  const signals = [];
  t.mock.method(process, "kill", (pid, signal) => {
    if (!groupAlive) throw Object.assign(new Error("No such process"), { code: "ESRCH" });
    if (signal !== 0) signals.push([pid, signal]);
    if (signal === "SIGTERM") {
      child.signalCode = "SIGTERM";
      child.emit("exit", null, "SIGTERM");
    }
    if (signal === "SIGKILL") groupAlive = false;
    return true;
  });
  let settled = false;
  const stopped = stopProcess(child).then(() => { settled = true; });
  await Promise.resolve();
  assert.equal(settled, false, "the process group still has a surviving descendant");
  t.mock.timers.tick(3000);
  await Promise.resolve();
  assert.equal(settled, true);
  assert.deepEqual(signals, [[-12345, "SIGTERM"], [-12345, "SIGKILL"]]);
  await stopped;
});

test("stopProcess settles when Windows taskkill fails or hangs", async (t) => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { value: "win32" });
  t.after(() => Object.defineProperty(process, "platform", platform));
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let killer;
  const spawnMock = t.mock.method(childProcess, "spawn", () => killer);
  syncBuiltinESMExports();
  for (const failure of ["error", "exit", "hang", "throw"]) {
    killer = Object.assign(new EventEmitter(), { kill() {} });
    // Keep the old implementation's unhandled error from aborting the test run.
    killer.on("error", () => {});
    if (failure === "throw") spawnMock.mock.mockImplementation(() => { throw new Error("spawn failed"); });
    const child = Object.assign(new EventEmitter(), { pid: 12345, exitCode: null, signalCode: null });
    let settled = false;
    const stopped = stopProcess(child).then(() => { settled = true; });
    if (failure === "error") killer.emit("error", new Error("taskkill unavailable"));
    if (failure === "exit") killer.emit("exit", 1);
    t.mock.timers.tick(5000);
    await Promise.resolve();
    assert.equal(settled, true, `shutdown must settle on taskkill ${failure}`);
    await stopped;
    assert.equal(child.listenerCount("exit"), 0);
  }
  const { arguments: args } = spawnMock.mock.calls[0];
  assert.deepEqual(args.slice(0, 2), ["taskkill", ["/pid", "12345", "/T", "/F"]]);
});

test("stopProcess kills a real child that ignores SIGTERM", { skip: process.platform === "win32" }, async () => {
  const child = spawn(process.execPath, [path.join(devApp, "ignore-term.mjs")], { detached: true, stdio: ["ignore", "pipe", "inherit"] });
  let watchdog;
  try {
    await once(child.stdout, "data");
    await Promise.race([
      stopProcess(child),
      new Promise((_, reject) => {
        watchdog = setTimeout(() => reject(new Error("Process shutdown exceeded its deadline")), 6000);
      })
    ]);
    assert.equal(child.signalCode, "SIGKILL");
  } finally {
    clearTimeout(watchdog);
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, "SIGKILL");
      await once(child, "exit");
    }
  }
});

test("dev server starts, serves, and stops", async () => {
  const dev = await startDevServer({ cwd: devApp, command: "npm run dev", timeoutMs: 30000 });
  assert.match(dev.url, /^http:\/\/localhost:\d+\/$/u);
  await waitForHttp(dev.url, { timeoutMs: 10000 });
  const response = await fetch(dev.url);
  assert.equal(response.status, 200);
  await dev.stop();
  await assert.rejects(fetch(dev.url));
});

test("a command that exits early rejects with its output", async () => {
  await assert.rejects(startDevServer({ cwd: devApp, command: "node -e \"console.log('boom'); process.exit(3)\"", timeoutMs: 10000 }), /exited with code 3[\s\S]*boom/u);
});
