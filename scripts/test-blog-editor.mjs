// Run after npm run build. All save requests in this fixture stay in memory.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".md": "text/plain", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const base = resolve(root, /^\/(tests|src)\//.test(pathname) ? "." : "dist");
    const file = resolve(base, `.${pathname}`);
    if (!file.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": `${types[extname(file)] || "application/octet-stream"}; charset=utf-8`, "Cache-Control": "no-store" }).end(body);
  } catch { response.writeHead(404).end(); }
}).listen(4174, "127.0.0.1", () => console.log("Editor fixture: http://127.0.0.1:4174/tests/fixtures/blog-editor.html"));
