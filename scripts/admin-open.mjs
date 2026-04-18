import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const host = process.env.ADMIN_HOST || "127.0.0.1";
const port = Number(process.env.ADMIN_PORT || 3210);
const adminUrl = `http://${host}:${port}/`;
const healthUrl = `http://${host}:${port}/api/content`;
const waitTimeoutMs = 30000;
const waitIntervalMs = 500;

async function main() {
  const readyBeforeStart = await isServerReady();
  if (!readyBeforeStart) {
    await launchAdminWindow();
    await waitForServer();
  }

  if (!process.env.ADMIN_OPEN_NO_BROWSER) {
    await openBrowser(adminUrl);
  }

  console.log(readyBeforeStart ? `管理器已在运行：${adminUrl}` : `管理器已启动并打开：${adminUrl}`);
}

async function isServerReady() {
  try {
    const response = await fetch(healthUrl, {
      headers: {
        accept: "application/json",
      },
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
  throw new Error(`本地内容管理器在 ${waitTimeoutMs / 1000} 秒内未启动：${adminUrl}`);
}

async function launchAdminWindow() {
  const command = `Set-Location -LiteralPath '${escapePowerShellString(rootDir)}'; npm run admin`;
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
      reject(new Error(`无法启动本地内容管理器窗口：${code}`));
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
