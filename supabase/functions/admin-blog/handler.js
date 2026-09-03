import { parsePostMarkdown, serializePostMarkdown } from "../../../src/lib/post-markdown.js";
import { validatePostsPayload } from "../../../admin/content-validation.js";

const REPOSITORY = "KingStar-China/KingStar-China.GitHub.io";
const BRANCH = "main";
const POSTS_PATH = "src/content/posts";
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_CONTENT_BYTES = 512 * 1024;
const ALLOWED_ORIGINS = new Set([
  "https://845864204.xyz", "https://www.845864204.xyz",
  "http://127.0.0.1:4173", "http://127.0.0.1:5173", "http://127.0.0.1:5174",
]);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function createAdminBlogHandler({ supabaseUrl, supabaseKey, githubToken, renderMarkdown, fetchImpl = fetch }) {
  const baseUrl = String(supabaseUrl || "").replace(/\/+$/, "");

  async function verifyAdmin(authorization) {
    if (!/^Bearer \S+$/i.test(authorization || "")) throw new ApiError(401, "请先登录管理员账号。");
    if (!baseUrl || !supabaseKey) throw new ApiError(503, "博客服务尚未配置完成。");
    const headers = { apikey: supabaseKey, Authorization: authorization };
    const userResponse = await fetchImpl(`${baseUrl}/auth/v1/user`, { headers, signal: AbortSignal.timeout(15000) });
    if (!userResponse.ok) {
      throw new ApiError(userResponse.status >= 500 ? 503 : 401, "无法验证登录状态，请稍后重试或重新登录。");
    }
    const user = await userResponse.json();
    if (!user?.id) throw new ApiError(401, "登录会话无效。");
    const adminResponse = await fetchImpl(`${baseUrl}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(user.id)}&select=user_id`, {
      headers, signal: AbortSignal.timeout(15000),
    });
    if (!adminResponse.ok) throw new ApiError(503, "暂时无法核验管理员权限。");
    const rows = await adminResponse.json();
    if (!Array.isArray(rows) || !rows.some((row) => row.user_id === user.id)) {
      throw new ApiError(403, "只有管理员可以编辑博客。");
    }
  }

  async function github(path, options = {}) {
    if (!githubToken) throw new ApiError(503, "博客发布服务尚未配置仓库凭据。");
    const response = await fetchImpl(`https://api.github.com/repos/${REPOSITORY}${path}`, {
      ...options,
      headers: {
        Accept: "application/vnd.github+json", Authorization: `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "shaohao-blog-admin",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if (response.status === 409 || response.status === 422) {
        throw new ApiError(409, "文章已被其他操作更新。请保留当前内容并重新载入文章后再保存。");
      }
      if (response.status === 404) throw new ApiError(404, "文章或仓库不存在。");
      if (response.status === 429 || (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0")) {
        throw new ApiError(429, "仓库请求过于频繁，请稍后重试。");
      }
      throw new ApiError(502, "暂时无法访问博客仓库，请稍后重试。");
    }
    return response.json();
  }

  async function getFile(id) {
    assertId(id);
    const file = await github(`/contents/${POSTS_PATH}/${id}.md?ref=${BRANCH}`);
    if (file.type !== "file" || file.encoding !== "base64" || file.size > MAX_CONTENT_BYTES || !SHA_PATTERN.test(file.sha)) {
      throw new ApiError(422, "文章文件格式或大小不受支持。");
    }
    return { ...file, source: decodeContent(file.content) };
  }

  async function listPosts() {
    let entries;
    try {
      entries = await github(`/contents/${POSTS_PATH}?ref=${BRANCH}`);
    } catch (error) {
      if (error.status === 404) return { posts: [] };
      throw error;
    }
    if (!Array.isArray(entries)) throw new ApiError(502, "仓库文章目录格式异常。");
    const files = entries.filter((file) => file.type === "file" && file.name.endsWith(".md") && ID_PATTERN.test(file.name.slice(0, -3)));
    const posts = [];
    // Keep GitHub requests bounded while reading a consistent blob for each entry.
    for (let start = 0; start < files.length; start += 4) {
      posts.push(...await Promise.all(files.slice(start, start + 4).map(async (file) => {
        if (!SHA_PATTERN.test(file.sha) || file.size > MAX_CONTENT_BYTES) throw new ApiError(422, "文章文件格式或大小不受支持。");
        const blob = await github(`/git/blobs/${file.sha}`);
        if (blob.encoding !== "base64" || blob.size > MAX_CONTENT_BYTES) throw new ApiError(422, "文章文件格式或大小不受支持。");
        const post = parsePostMarkdown(decodeContent(blob.content), file.name.slice(0, -3));
        const { content, ...metadata } = post;
        return { ...metadata, sha: file.sha };
      })));
    }
    return { posts: posts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)) };
  }

  async function savePost(payload) {
    const post = normalizePost(payload.post);
    const expectedSha = parseExpectedSha(payload.sha);
    const source = serializePostMarkdown(post);
    if (new TextEncoder().encode(source).length > MAX_CONTENT_BYTES) throw new ApiError(400, "文章总大小不能超过 512 KB。");
    let current = null;
    try { current = await getFile(post.id); } catch (error) { if (error.status !== 404) throw error; }
    // An identical retry after a lost response must not create a duplicate commit.
    if (current?.source === source) return { post, sha: current.sha, unchanged: true };
    if ((current?.sha || null) !== expectedSha) throw new ApiError(409, "文章版本已变化，请保留当前内容并重新载入文章后再保存。");
    const result = await github(`/contents/${POSTS_PATH}/${post.id}.md`, {
      method: "PUT",
      body: JSON.stringify({
        message: `${current ? "更新" : "新增"}博客：${post.title}`,
        branch: BRANCH, content: encodeContent(source), ...(current ? { sha: expectedSha } : {}),
      }),
    });
    return { post, sha: result.content.sha, commit: result.commit.sha };
  }

  async function deletePost(payload) {
    assertId(payload.id);
    const expectedSha = parseExpectedSha(payload.sha);
    if (!expectedSha) throw new ApiError(400, "删除文章必须提供当前版本。");
    const current = await getFile(payload.id);
    if (current.sha !== expectedSha) throw new ApiError(409, "文章已更新，请重新载入后再删除。");
    const result = await github(`/contents/${POSTS_PATH}/${payload.id}.md`, {
      method: "DELETE",
      body: JSON.stringify({ message: `删除博客：${payload.id}`, branch: BRANCH, sha: expectedSha }),
    });
    return { id: payload.id, commit: result.commit.sha };
  }

  async function publishStatus(commit) {
    if (commit && !SHA_PATTERN.test(commit)) throw new ApiError(400, "发布版本无效。");
    const query = new URLSearchParams({ branch: BRANCH, per_page: "1", ...(commit ? { head_sha: commit } : {}) });
    const data = await github(`/actions/workflows/deploy.yml/runs?${query}`);
    const run = data.workflow_runs?.[0];
    return { deployment: run ? { status: run.status, conclusion: run.conclusion, commit: run.head_sha, url: run.html_url } : null };
  }

  return async function handler(request) {
    const origin = request.headers.get("Origin");
    const headers = {
      "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin",
      ...(origin && ALLOWED_ORIGINS.has(origin) ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      } : {}),
    };
    try {
      if (origin && !ALLOWED_ORIGINS.has(origin)) throw new ApiError(403, "请求来源不被允许。");
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
      if (request.method !== "POST") throw new ApiError(405, "请求方法不受支持。");
      await verifyAdmin(request.headers.get("Authorization"));
      const payload = await readPayload(request);
      let result;
      switch (payload.action) {
        case "list": result = await listPosts(); break;
        case "get": {
          const file = await getFile(payload.id);
          result = { post: parsePostMarkdown(file.source, payload.id), sha: file.sha };
          break;
        }
        case "save": result = await savePost(payload); break;
        case "delete": result = await deletePost(payload); break;
        case "status": result = await publishStatus(payload.commit); break;
        case "preview": {
          if (typeof payload.content !== "string" || new TextEncoder().encode(payload.content).length > MAX_CONTENT_BYTES) {
            throw new ApiError(400, "正文过长或格式无效。");
          }
          result = { html: await renderMarkdown(payload.content) };
          break;
        }
        default: throw new ApiError(400, "未知的博客操作。");
      }
      return Response.json(result, { headers });
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 502;
      const message = error instanceof ApiError ? error.message : "博客服务暂时不可用，请稍后重试。";
      return Response.json({ message }, { status, headers });
    }
  };
}

function assertId(id) {
  if (typeof id !== "string" || !ID_PATTERN.test(id)) throw new ApiError(400, "文章 ID 只支持小写字母、数字和连字符，最长 80 字符。");
}

function parseExpectedSha(sha) {
  if (sha == null || sha === "") return null;
  if (typeof sha !== "string" || !SHA_PATTERN.test(sha)) throw new ApiError(400, "文章版本无效。");
  return sha;
}

function normalizePost(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "文章格式无效。");
  assertId(value.id);
  const post = { id: value.id };
  for (const [field, limit] of Object.entries({ title: 200, summary: 1000, publishedAt: 10, content: MAX_CONTENT_BYTES })) {
    if (typeof value[field] !== "string" || value[field].length > limit || (field === "content" && new TextEncoder().encode(value[field]).length > limit)) {
      throw new ApiError(400, `${field} 内容过长或格式无效。`);
    }
    post[field] = value[field].trim();
  }
  if (!Array.isArray(value.tags) || value.tags.length > 30 || value.tags.some((tag) => typeof tag !== "string" || tag.length > 60)) {
    throw new ApiError(400, "标签格式无效，最多支持 30 个标签。");
  }
  post.tags = value.tags;
  try { validatePostsPayload([post]); } catch (error) { throw new ApiError(400, error.message); }
  return post;
}

async function readPayload(request) {
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new ApiError(415, "请使用 JSON 请求。");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "请求内容为空。");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new ApiError(413, "文章超过允许的大小。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch { throw new ApiError(400, "请求内容不是有效的 JSON 对象。"); }
}

function encodeContent(source) {
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

function decodeContent(content) {
  return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(content.replace(/\s/g, "")), (char) => char.charCodeAt(0)));
}
