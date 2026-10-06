import http from "node:http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end("<!doctype html><html lang=\"ja\"><title>dev</title><main><h1>dev</h1></main></html>");
});
server.listen(0, "127.0.0.1", () => {
  console.log(`  ➜  Local:   \u001b[36mhttp://localhost:${server.address().port}/\u001b[39m`);
});
