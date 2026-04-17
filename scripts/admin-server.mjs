import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { validatePostsPayload, validateSearchEnginesPayload, validateSiteIconReferences, validateSitesPayload } from "../admin/content-validation.js";
import { loadPostsFromMarkdown, writePostsToMarkdown } from "./posts-content.mjs";
import { fetchSiteMetadata as fetchRemoteSiteMetadata } from "./site-metadata.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const adminDir = path.join(rootDir, "admin");
const dataDir = path.join(rootDir, "src", "data");
const iconDir = path.join(rootDir, "public", "icon");
const host = process.env.ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.ADMIN_PORT || 3210);
const LINK_CHECK_TIMEOUT = 8000;
const LINK_CHECK_CONCURRENCY = 5;

const routes = {
  "/": path.join(adminDir, "index.html"),
  "/app.js": path.join(adminDir, "app.js"),
  "/style.css": path.join(adminDir, "style.css"),
  "/content-validation.js": path.join(adminDir, "content-validation.js"),
};

const server = createServer(async (req, res) => {
  try {
    if (!req.url) {
      sendJson(res, 400, { error: "Missing request url" });
      return;
    }

    const url = new URL(req.url, `http://${host}:${port}`);

    if (req.method === "GET" && url.pathname === "/api/content") {
      const [sites, posts, searchEngines, iconFiles] = await Promise.all([
        readModuleExport("sites.js", "sites"),
        loadPostsFromMarkdown(),
        readModuleExport("search-engines.js", "searchEngines"),
        listIconFiles(),
      ]);
      sendJson(res, 200, { sites, posts, searchEngines, iconFiles });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/sites") {
      const payload = await readJsonBody(req);
      validateSitesPayload(payload);
      validateSiteIconReferences(payload, await listIconFiles());
      await writeModuleExport("sites.js", "sites", payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/posts") {
      const payload = await readJsonBody(req);
      validatePostsPayload(payload);
      await writePostsToMarkdown(payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/search-engines") {
      const payload = await readJsonBody(req);
      validateSearchEnginesPayload(payload);
      await writeModuleExport("search-engines.js", "searchEngines", payload);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/open-icon-folder") {
      await openIconFolder();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/site-metadata") {
      const payload = await readJsonBody(req);
      const targetUrl = assertString(payload?.url, "站点链接");
      const metadata = await fetchRemoteSiteMetadata(targetUrl);
      sendJson(res, 200, metadata);
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

    if (req.method === "POST" && url.pathname === "/api/publish-github") {
      const payload = await readJsonBody(req);
      const result = await publishToGitHub(payload);
      sendJson(res, 200, result);
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
  const filePath = path.join(dataDir, fileName);
  const source = await readFile(filePath, "utf8");
  return parseModuleExport(source, exportName, fileName);
}

async function writeModuleExport(fileName, exportName, value) {
  const filePath = path.join(dataDir, fileName);
  const serialized = `export const ${exportName} = ${JSON.stringify(value, null, 2)};\n`;
  await writeFile(filePath, serialized, "utf8");
}

function parseModuleExport(source, exportName, fileName) {
  const pattern = new RegExp(`^\\s*export\\s+const\\s+${escapeRegExp(exportName)}\\s*=\\s*([\\s\\S]*);\\s*$`);
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`${fileName} 缺少导出的 ${exportName}`);
  }

  try {
    return structuredClone(runInNewContext(`(${match[1]})`, Object.create(null), { timeout: 1000 }));
  } catch (error) {
    throw new Error(`${fileName} 解析失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listIconFiles() {
  const entries = await readdir(iconDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

async function openIconFolder() {
  await new Promise((resolve, reject) => {
    const child = spawn("explorer.exe", [iconDir], {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
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


function assertString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }

  return value.trim();
}



async function publishToGitHub(payload) {
  const message = String(payload?.message || "").trim();
  if (!message) {
    throw new Error("提交说明不能为空");
  }

  const branch = (await runGitCommand(["branch", "--show-current"])).trim() || "main";
  const trackedPaths = ["src/data", "src/content", "public/icon"];
  const statusOutput = (await runGitCommand(["status", "--porcelain", "--", ...trackedPaths])).trim();
  if (!statusOutput) {
    throw new Error("当前没有 src/data、src/content 或 public/icon 的可提交变更");
  }

  await runGitCommand(["add", "--", ...trackedPaths]);

  try {
    await runGitCommand(["commit", "-m", message, "--", ...trackedPaths]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (!/nothing to commit/i.test(detail)) {
      throw error;
    }
  }

  await runGitCommand(["push", "origin", branch]);

  return {
    ok: true,
    branch,
    summary: message,
    files: statusOutput.split(/\r?\n/).filter(Boolean),
  };
}

async function runGitCommand(args) {
  return await new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error((stderr || stdout || ("git " + args.join(" ") + " 执行失败")).trim()));
    });
  });
}
