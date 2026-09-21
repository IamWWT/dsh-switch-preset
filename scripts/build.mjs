#!/usr/bin/env node
/**
 * build.mjs — DSH 插件双端构建 + 产物门禁（骨架版）
 *
 * 三职责（PLUGIN-DEV-STANDARD §2.3，缺一不可，不得弱化）：
 *   1. Host   src/index.ts        → lib/index.js  （ESM，node；external: node:* 与 @deepseek-ai/*）
 *   2. Client src/client/entry.ts → lib/client.js （iife，浏览器；globalName 供 window.__ModuleLoader__ 注册）
 *   3. 门禁   产物存在且非空；Host 侧关键导出（VERSION/name/inject/apply）真实存在；
 *             Client 侧文本含插件 id；charset=utf8（中文不被转 \uXXXX）。
 *
 * 用法：
 *   node scripts/build.mjs             # 构建 + typecheck
 *   node scripts/build.mjs --no-typecheck
 *
 * 工具解析：本目录 node_modules → $DSH_PLUGIN_TOOLS_DIR（指向含 esbuild/typescript 的目录，
 * 可指向 deepseek-harness 的 node_modules）。骨架未安装依赖时先 `npm install`。
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const noTypecheck = process.argv.includes("--no-typecheck");
const pluginId = (() => {
  const pkg = JSON.parse(readFileSync(root + "/package.json", "utf8"));
  return pkg.name;
})();

/** 工具解析：本地 node_modules 优先，其次 DSH_PLUGIN_TOOLS_DIR。 */
function loadTool(name) {
  const anchors = [here + "/x.js", root + "/x.js"];
  const extra = process.env.DSH_PLUGIN_TOOLS_DIR;
  if (extra) anchors.push(extra + "/x.js", extra + "/node_modules/x.js");
  for (const a of anchors) {
    try {
      return createRequire(a)(name);
    } catch { /* 试下一个锚点 */ }
  }
  // pnpm 布局兜底：<node_modules>/.pnpm/<name>@<ver>/node_modules/<name>
  // （DSH_PLUGIN_TOOLS_DIR 可指向 node_modules 目录本身，也可指项目根目录）
  if (extra) {
    for (const base of [extra, extra + "/node_modules"]) {
      const pnpm = base + "/.pnpm";
      if (!existsSync(pnpm)) continue;
      for (const e of readdirSync(pnpm).filter((x) => x.startsWith(name + "@")).sort().reverse()) {
        try {
          return createRequire(`${pnpm}/${e}/node_modules/x.js`)(name);
        } catch { /* 下一个版本 */ }
      }
    }
  }
  throw new Error(`找不到 ${name}：先 npm install，或设 DSH_PLUGIN_TOOLS_DIR 指向含该依赖的 node_modules`);
}

async function main() {
  const esbuild = loadTool("esbuild");
  await esbuild.build({
    entryPoints: [root + "/src/index.ts"],
    outfile: root + "/lib/index.js",
    bundle: true,
    format: "esm",
    platform: "node",
    target: "es2022",
    charset: "utf8",
    external: ["node:*", "@deepseek-ai/*"],
  });
  await esbuild.build({
    entryPoints: [root + "/src/client/entry.ts"],
    outfile: root + "/lib/client.js",
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2022",
    charset: "utf8",
    globalName: pluginId.replace(/[^a-zA-Z0-9_$]/g, "_") + "Client",
  });

  // ---- 产物门禁 ----
  for (const f of [root + "/lib/index.js", root + "/lib/client.js"]) {
    if (!existsSync(f) || statSync(f).size === 0) {
      throw new Error(`产物门禁失败：${f} 缺失或为空`);
    }
  }
  const hostSrc = readFileSync(root + "/lib/index.js", "utf8");
  for (const k of ["VERSION", "name", "inject", "apply"]) {
    if (!hostSrc.includes(`"${k}"`) && !new RegExp(`\\b${k}\\b`).test(hostSrc)) {
      throw new Error(`产物门禁失败：lib/index.js 未见关键导出 ${k}（接入后未 bundle？检查 import 接线）`);
    }
  }
  const clientSrc = readFileSync(root + "/lib/client.js", "utf8");
  if (!clientSrc.includes(pluginId)) {
    throw new Error(`产物门禁失败：lib/client.js 未包含插件 id "${pluginId}"`);
  }
  // 插槽注册断言：实际注册的插槽必须出现在产物中（防 bundle 遗漏接线）
  for (const slot of ["conversation.input.right", "__ModuleLoader__"]) {
    if (!clientSrc.includes(slot)) {
      throw new Error(`产物门禁失败：lib/client.js 未见 "${slot}"（未接线？检查 client/entry.ts）`);
    }
  }
  // 命令名断言：Host 注册的斜杠命令名必须出现在产物中
  if (!hostSrc.includes("switch-preset") || !hostSrc.includes("list-preset")) {
    throw new Error(`产物门禁失败：lib/index.js 未见命令名 switch-preset / list-preset`);
  }
  // ⚠️ 2026-09-18 事故防线（AGENTS.md）：DSH web 把同批插件 client bundle 拼成一个
  // classic <script> 整体执行，产物混入顶层 ESM import/export 会让整个 combo 一行不执行
  // → 同批所有插件界面全挂。必须断言 client 产物自包含 IIFE：
  //   1) 无顶层 import/export 语句；
  //   2) node --check 语法校验（等价 classic script 可解析）。
  if (/^\s*(import|export)\b/m.test(clientSrc)) {
    throw new Error(`产物门禁失败：lib/client.js 含顶层 import/export（必须为自包含 IIFE，否则 combo script 全批失败）`);
  }
  const syntaxCheck = spawnSync(process.execPath, ["--check", root + "/lib/client.js"], { stdio: "pipe" });
  if (syntaxCheck.status !== 0) {
    throw new Error(`产物门禁失败：lib/client.js 语法校验未通过（node --check）`);
  }
  console.log(`[build] ${pluginId}：lib/index.js + lib/client.js 生成并通过产物门禁`);

  if (!noTypecheck) {
    const r = spawnSync(process.execPath, [root + "/scripts/typecheck.mjs"], { stdio: "inherit" });
    if (r.status !== 0) throw new Error("typecheck 未通过");
  }
}

main().catch((e) => {
  console.error("[build] 失败：", e.message || e);
  process.exit(1);
});
