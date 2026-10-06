import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serveDirectory } from "./helpers/serve.mjs";

test("serveDirectory rejects traversal into sibling directories sharing its root prefix", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "anw-serve-"));
  const root = path.join(temp, "site");
  for (const dir of ["site", "site-sibling", "outside"]) {
    fs.mkdirSync(path.join(temp, dir));
    fs.writeFileSync(path.join(temp, dir, "secret.txt"), `${dir} content`, "utf8");
  }
  const server = await serveDirectory(root);
  try {
    for (const dir of ["site-sibling", "outside"]) {
      const response = await fetch(`${server.url}/%2e%2e%2f${dir}%2fsecret.txt`);
      assert.equal(response.status, 404, `reject traversal into ${dir}`);
      assert.equal(await response.text(), "");
    }
  } finally {
    await server.close();
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("serveDirectory serves the index and nested files inside its root", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "anw-serve-"));
  fs.mkdirSync(path.join(root, "..inside"));
  fs.writeFileSync(path.join(root, "index.html"), "<h1>Home</h1>", "utf8");
  fs.writeFileSync(path.join(root, "..inside", "app.js"), "console.log('inside');", "utf8");
  const server = await serveDirectory(root);
  try {
    for (const [pathname, body, type] of [["/", "<h1>Home</h1>", "text/html"], ["/..inside/app.js", "console.log('inside');", "text/javascript"]]) {
      const response = await fetch(`${server.url}${pathname}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("content-type").startsWith(type));
      assert.equal(await response.text(), body);
    }
  } finally {
    await server.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
