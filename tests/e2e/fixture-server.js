const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const HOST = process.env.BTS_E2E_HOST || "127.0.0.1";
const PORT = Number(process.env.BTS_E2E_PORT || 3100);
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

function resolveRequestPath(urlPath) {
  const requestPath = urlPath === "/" ? "/index.html" : urlPath;
  const normalized = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = path.join(FIXTURES_DIR, normalized);
  if (!absolutePath.startsWith(FIXTURES_DIR)) {
    return null;
  }
  return absolutePath;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${HOST}:${PORT}`);
  const filePath = resolveRequestPath(requestUrl.pathname);
  if (!filePath) {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("BAD_REQUEST");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("NOT_FOUND");
      return;
    }

    const extname = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": MIME_TYPES[extname] || "application/octet-stream"
    });
    response.end(data);
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Fixture server listening on http://${HOST}:${PORT}\n`);
});
