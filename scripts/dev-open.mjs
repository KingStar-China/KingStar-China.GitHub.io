import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = process.env.DEV_HOST || "127.0.0.1";
const port = Number(process.env.DEV_PORT || 5173);
const devUrl = `http://${host}:${port}/`;
const waitTimeoutMs = 30000;
const waitIntervalMs = 500;

async function main() {
  const readyBeforeStart = await isServerReady();
  if (!readyBeforeStart) {
    await launchDevWindow();
    await waitForServer();
  }

  if (!process.env.DEV_OPEN_NO_BROWSER) {
    await openBrowser(devUrl);
  }

  console.log(readyBeforeStart ? `开发服务已在运行：${devUrl}` : `开发服务已启动并打开：${devUrl}`);
}

async function isServerReady() {
  try {
    const response = await fetch(devUrl, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < waitTimeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await sleep(waitIntervalMs);
  }
  throw new Error(`开发服务在 ${waitTimeoutMs / 1000} 秒内未启动：${devUrl}`);
}

async function launchDevWindow() {
  const command = `Set-Location -LiteralPath '${escapePowerShellString(rootDir)}'; npm run dev`;
  const args = [
    "-NoProfile",
    "-Command",
    `Start-Process powershell.exe -WorkingDirectory '${escapePowerShellString(rootDir)}' -ArgumentList '-NoExit','-Command','${escapePowerShellString(command)}'`,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", args, {
      cwd: rootDir,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`无法启动开发服务窗口：${code}`));
    });
  });
}

async function openBrowser(url) {
  if (process.platform === "win32") {
    await spawnDetached("cmd.exe", ["/c", "start", "", url]);
    return;
  }

  if (process.platform === "darwin") {
    await spawnDetached("open", [url]);
    return;
  }

  await spawnDetached("xdg-open", [url]);
}

async function spawnDetached(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

function escapePowerShellString(value) {
  return String(value).replace(/'/g, "''");
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main();
