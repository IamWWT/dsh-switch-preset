/**
 * smoke-test.mjs — 冒烟测试（骨架版）
 *
 * 不依赖 DSH 运行时：直接加载构建产物，验证关键导出与产物完整性。
 * 退出码：全过 0；任一失败 1。
 *
 * 骨架断言：
 *   1. 构建产物存在（lib/index.js、lib/client.js）
 *   2. Host 侧 VERSION 为语义化版本，且与 package.json 一致（四处同步）
 *   3. Host 侧导出 name/inject/apply 存在
 *   4. Client 侧产物包含 window.__ModuleLoader__ 注册约定文本
 *
 * 用法： node test/smoke-test.mjs   （先 `npm run build`）
 *
 * 扩展指南（实现后由 Agent 按 PLUGIN-DEV-STANDARD §6 补强）：
 *   - 纯函数：直接调用并断言输入输出
 *   - 数据层/状态机：用内存态或 tmp 目录做确定性断言
 *   - 路径安全/权限：断言越界/越权被拒绝
 *   - 禁止把"没抛异常"当成通过；每条断言要有明确语义
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) console.log(`  PASS  ${name}${detail ? "  (" + detail + ")" : ""}`);
  else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? "  (" + detail + ")" : ""}`);
  }
}

console.log("[1/4] 构建产物存在");
const libIndex = root + "/lib/index.js";
const libClient = root + "/lib/client.js";
check("lib/index.js 存在", existsSync(libIndex));
check("lib/client.js 存在", existsSync(libClient));
if (failures > 0) {
  console.error("\n先运行 `npm run build` 再跑冒烟测试。");
  process.exit(1);
}

console.log("[2/4] 版本四处同步（package.json == src VERSION）");
const pkg = JSON.parse(readFileSync(root + "/package.json", "utf8"));
const srcIndex = readFileSync(root + "/src/index.ts", "utf8");
const versionInSrc = (srcIndex.match(/VERSION\s*=\s*["']([^"']+)["']/) || [])[1];
check("package.json version 形如 x.y.z", /^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);
check("src/index.ts VERSION 与 package.json 一致", versionInSrc === pkg.version, versionInSrc ?? "(未找到)");

console.log("[3/4] Host 侧导出完整性");
const mod = await import(pathToFileURL(libIndex).href);
check("VERSION 导出", typeof mod.VERSION === "string" && mod.VERSION === pkg.version, mod.VERSION);
for (const k of ["name", "inject", "apply"]) {
  check(`导出 ${k}`, k in mod);
}
// v0.5.1：0.1.7 原生设置面必须导出 Config（否则插件详情页配置区拿不到 volatile 字段 routerSettings）
check("导出 Config（0.1.7 原生设置面）", "Config" in mod);
const configJson = mod.Config && typeof mod.Config.toJSON === "function"
  ? JSON.stringify(mod.Config.toJSON())
  : "";
check("Config 含 volatile 字段 routerSettings", configJson.includes("routerSettings"),
  configJson.includes("routerSettings") ? "ok" : "(schema 里没找到 routerSettings)");
// 静态 inject 必须保持为空数组（把 commands/webServer 写进静态 inject 会让 apply 永不执行，见 v2.0 事故）
check("静态 inject 为空数组（命令/路由走二级注入）",
  Array.isArray(mod.inject) && mod.inject.length === 0, JSON.stringify(mod.inject));

console.log("[4/4] Client 侧产物");
const clientSrc = readFileSync(libClient, "utf8");
check("client.js 含 window.__ModuleLoader__ 约定", clientSrc.includes("__ModuleLoader__"));
check("client.js 含插件 id", clientSrc.includes(pkg.name));
// v0.5.1：插件页配置区（keyed 槽，key 必须是包名，否则配置区静默不渲染）
check("client.js 注册 plugins.bundle.config", clientSrc.includes("plugins.bundle.config"));
check("配置区 key = 包名", new RegExp(`key:\\s*["'\`]${pkg.name}["'\`]`).test(clientSrc));
// 数据面接线（baseUrl 与路由后缀在产物里是相邻的模板字符串片段，分开断言更稳）
check("client.js 含设置数据面 base 路径", clientSrc.includes("/api/dsh-switch-preset"));
check("client.js 含设置数据面路由后缀", clientSrc.includes("/settings/watch?timeoutMs="));

console.log(failures === 0 ? "\n✅ 冒烟测试全部通过" : `\n❌ ${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
