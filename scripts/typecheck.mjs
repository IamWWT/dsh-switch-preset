#!/usr/bin/env node
/**
 * typecheck.mjs — 双 tsconfig --noEmit（Host + Client，均 strict）
 *
 * 类型检查器解析：本地 node_modules 的 typescript → $DSH_PLUGIN_TOOLS_DIR。
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

let tscJs = null;
{
  const anchors = [here + "/x.js", root + "/x.js"];
  if (process.env.DSH_PLUGIN_TOOLS_DIR) {
    anchors.push(process.env.DSH_PLUGIN_TOOLS_DIR + "/x.js", process.env.DSH_PLUGIN_TOOLS_DIR + "/node_modules/x.js");
  }
  for (const a of anchors) {
    try {
      const req = createRequire(a);
      const tsPath = req.resolve("typescript");
      if (existsSync(tsPath)) {
        tscJs = createRequire(a).resolve("typescript/lib/tsc.js");
        break;
      }
    } catch { /* 下一个锚点 */ }
  }
}
if (!tscJs && process.env.DSH_PLUGIN_TOOLS_DIR) {
  // pnpm 布局兜底：<base>/.pnpm/typescript@<ver>/node_modules/typescript
  // （DSH_PLUGIN_TOOLS_DIR 可指向 node_modules 目录或项目根目录）
  const bases = [process.env.DSH_PLUGIN_TOOLS_DIR, process.env.DSH_PLUGIN_TOOLS_DIR + "/node_modules"];
  for (const base of bases) {
    const pnpm = base + "/.pnpm";
    if (!existsSync(pnpm)) continue;
    for (const e of readdirSync(pnpm).filter((x) => x.startsWith("typescript@")).sort().reverse()) {
      const cand = `${pnpm}/${e}/node_modules/typescript/lib/tsc.js`;
      if (existsSync(cand)) { tscJs = cand; break; }
    }
    if (tscJs) break;
  }
}
if (!tscJs) {
  console.error("找不到 typescript：先 npm install，或设 DSH_PLUGIN_TOOLS_DIR 指向含 typescript 的目录");
  process.exit(1);
}

let failed = false;
// @types 解析：项目自身 node_modules 优先（默认 typeRoots 行为）；
// 否则借用 $DSH_PLUGIN_TOOLS_DIR 的 @types（如 deepseek-harness 的 node_modules）。
const typeRootsArgs = [];
if (!existsSync(root + "/node_modules/@types") && process.env.DSH_PLUGIN_TOOLS_DIR) {
  for (const base of [process.env.DSH_PLUGIN_TOOLS_DIR, process.env.DSH_PLUGIN_TOOLS_DIR + "/node_modules"]) {
    if (existsSync(base + "/@types")) { typeRootsArgs.push("--typeRoots", base + "/@types"); break; }
  }
}
for (const cfg of ["tsconfig.json", "tsconfig.client.json"]) {
  console.log(`[typecheck] ${cfg}`);
  const args = cfg === "tsconfig.client.json" ? [] : typeRootsArgs; // client 侧 types:[]，无需 @types/node
  const r = spawnSync(process.execPath, [tscJs, "-p", root + "/" + cfg, "--noEmit", ...args], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`[typecheck] 失败：${cfg}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
