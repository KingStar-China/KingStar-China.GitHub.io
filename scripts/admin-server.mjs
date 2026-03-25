import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const adminDir = path.join(rootDir, "admin");
const dataDir = path.join(rootDir, "src", "data");
const host = process.env.ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.ADMIN_PORT || 3210);
const LINK_CHECK_TIMEOUT = 8000;
const LINK_CHECK_CONCURRENCY = 5;

const routes = {
  "/": path.join(adminDir, "index.html"),
  "/app.js": path.join(adminDir, "app.js"),
  "/style.css": path.join(adminDir, "style.css"),
};

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: "Missing request url" });
      return;
    }

    const url = new URL(req.url, `http://${host}:${port}`);

    if (req.method === "GET" && url.pathname === "/api/content") {
      const [sites, posts] = await Promise.all([readModuleExport("sites.js", "sites"), readModuleExport("posts.js", "posts")]);
      sendJson(res, 200, { sites, posts });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/sites") {
      const payload = await readJsonBody(req);
      validateSites(payload);
      await writeModuleExport("sites.js", "sites", payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/posts") {
      const payload = await readJsonBody(req);
      validatePosts(payload);
      await writeModuleExport("posts.js", "posts", payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/site-health") {
      const payload = await readJsonBody(req);
      validateSitesForCheck(payload);
      const results = await mapWithConcurrency(payload, LINK_CHECK_CONCURRENCY, checkSiteHealth);
      sendJson(res, 200, {
        checkedAt: new Date().toISOString(),
        results,
      });
      return;
    }

    if (req.method === "GET" && routes[url.pathname]) {
      await sendStatic(res, routes[url.pathname]);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
  }
});

server.listen(port, host, () => {
  console.log(`Local content manager running at http://${host}:${port}`);
});

async function readModuleExport(fileName, exportName) {
  const fileUrl = pathToFileURL(path.join(dataDir, fileName)).href;
  const module = await import(`${fileUrl}?t=${Date.now()}`);
  return module[exportName];
}

async function writeModuleExport(fileName, exportName, value) {
  const filePath = path.join(dataDir, fileName);
  const serialized = `export const ${exportName} = ${JSON.stringify(value, null, 2)};\n`;
  await writeFile(filePath, serialized, "utf8");
}

async function readJsonBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return [];
  }

  return JSON.parse(text);
}

async function sendStatic(res, filePath) {
  const content = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Cache-Control": "no-store",
  });
  res.end(content);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "text/javascript; charset=utf-8";
  }

  return "application/octet-stream";
}

function validateSites(sites) {
  if (!Array.isArray(sites)) {
    throw new Error("站点数据必须是数组");
  }

  const ids = new Set();
  for (const site of sites) {
    if (!site || typeof site !== "object") {
      throw new Error("站点条目格式不正确");
    }
    assertString(site.id, "站点 id");
    assertString(site.name, "站点名称");
    assertString(site.url, "站点链接");
    assertString(site.category, "站点分类");
    assertString(site.description, "站点描述");
    if (ids.has(site.id)) {
      throw new Error(`站点 id 重复: ${site.id}`);
    }
    ids.add(site.id);
    site.tags = normalizeStringArray(site.tags);
    site.aliases = normalizeStringArray(site.aliases);
    site.icon = typeof site.icon === "string" ? site.icon.trim() : "";
  }
}

function validatePosts(posts) {
  if (!Array.isArray(posts)) {
    throw new Error("文章数据必须是数组");
  }

  const ids = new Set();
  for (const post of posts) {
    if (!post || typeof post !== "object") {
      throw new Error("文章条目格式不正确");
    }
    assertString(post.id, "文章 id");
    assertString(post.title, "文章标题");
    assertString(post.summary, "文章摘要");
    assertString(post.publishedAt, "发布日期");
    if (ids.has(post.id)) {
      throw new Error(`文章 id 重复: ${post.id}`);
    }
    ids.add(post.id);
    post.tags = normalizeStringArray(post.tags);
    post.content = normalizeStringArray(post.content);
  }
}

function validateSitesForCheck(sites) {
  if (!Array.isArray(sites)) {
    throw new Error("检测请求必须是网站数组");
  }

  for (const site of sites) {
    if (!site || typeof site !== "object") {
      throw new Error("检测请求里包含无效网站");
    }
    assertString(site.id, "站点 id");
    assertString(site.name, "站点名称");
    assertString(site.url, "站点链接");
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    }),
  );

  return results;
}

async function checkSiteHealth(site) {
  const url = String(site.url || "").trim();
  const baseResult = {
    id: site.id,
    name: site.name,
    url,
    ok: false,
    status: null,
    finalUrl: "",
    method: "",
    error: "",
  };

  if (!/^https?:\/\//i.test(url)) {
    return {
      ...baseResult,
      error: "链接格式无效",
    };
  }

  const methods = ["HEAD", "GET"];
  let lastStatus = null;
  let lastError = "";

  for (const method of methods) {
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: AbortSignal.timeout(LINK_CHECK_TIMEOUT),
        headers: {
          "user-agent": "Codex Local Link Checker",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      lastStatus = response.status;

      if (method === "HEAD" && !response.ok) {
        await cancelBody(response);
        continue;
      }

      await cancelBody(response);
      return {
        ...baseResult,
        ok: response.ok,
        status: response.status,
        finalUrl: response.url || url,
        method,
        error: response.ok ? "" : `HTTP ${response.status}`,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    ...baseResult,
    status: lastStatus,
    error: lastError || (lastStatus ? `HTTP ${lastStatus}` : "请求失败"),
  };
}

async function cancelBody(response) {
  try {
    if (response.body && typeof response.body.cancel === "function") {
      await response.body.cancel();
    }
  } catch {
    // Ignore response stream cancellation errors.
  }
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
}



