# AGENTS.md — dsh-switch-preset

DSH 会话模式（Agent preset）切换插件。本文件是 Agent 在本项目的单一入口；**只记本插件特有约束**，
通用工程协议见工作区 [`../AGENTS.md`](../AGENTS.md) 与 [`../PLUGIN-DEV-STANDARD.md`](../PLUGIN-DEV-STANDARD.md)。

## 0. 必读顺序（渐进加载，别一次读完仓库）

1. [`README.md`](README.md) — 是什么、怎么装、能力边界
2. 本文件 — 纪律与红线
3. [`docs/README.md`](docs/README.md) + [`docs/FILE_INDEX.md`](docs/FILE_INDEX.md)
4. [`docs/04-progress/SESSION.md`](docs/04-progress/SESSION.md) — 上次交接（新会话先读并复述）
5. 任务相关规格：[`docs/specs/`](docs/specs/) / [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md)

语言中文。需求不明先 grill-me 澄清（用户明确免问则写假设表）；改需求先登记 `docs/REQUIREMENTS.md`（原话+版本+验收），再动手。

## 1. 本插件特有红线

- **三条指令语义必须保持单一真源**：`/switch-preset`（显式切换）、`/list-preset`（清单）、
  `/router-preset`（概率路由）。切换语义只在 `src/host/switch.ts` 的 `switchPreset()` 实现一次，
  其他入口（含 `/router-preset`）**复用**它，禁止复制 select/recompose/写默认那套降级逻辑。
- **禁止自行调用任何 LLM API**。把内容交给会话的唯一通道是 core 服务
  `sessionController.prompt`（`/router-preset` 第③步投递原话就用它）。
- **命令注册必须二级注入**：`ctx.inject(['commands','agentPresets'], cctx => cctx.commands.register(...))`。
  把 `commands` 写进插件级静态 `inject` 会让 Cordis 门控永不满足 → `apply` 根本不执行、命令消失（0.1.7 实测）。
  `settings` / `sessionController` 同样走二级注入 + 惰性解析。
- **概率引擎可插拔**：`src/host/router.ts` 的 `ModeScorer` 是唯一打分接口。换引擎（如 JEV 类模型）
  只实现该接口，命令层与客户端**零改动**。模式清单（id/名称/描述）一律取自运行时 roster，
  **禁止硬编码模式清单**；强特征词表只放高区分度动作/交付物词。
- **无判别力必须如实说**：全部模式概率并列时（内置模式常见）置 `undetermined`，
  输出"无法判定"，**不得**拿排序副产品当推荐、不得切换。
- **投递失败不得假报成功**：通道缺失/被拒/抛错三态都要如实回显"未投递"并指导用户手动重发；
  切换失败时**绝不投递**原话（避免在原模式下误跑）。
- **client 主题**：只用 DSH 主题 token（`--dsw-*`），明暗自动跟随，禁硬编码色值；异步必带超时。

## 2. 构建、验证与安装

```bash
pnpm check    # 构建（含产物门禁）+ 双 tsconfig typecheck + 冒烟 + 逻辑单测（自持可跑）
npm pack      # 产出 dsh-switch-preset-<version>.tgz
DSH_HOME=$HOME/.dsh-dev pnpm dsh plugin --profile web add <abs/…tgz>   # 在 deepseek-harness/ 内执行
```

- **版本四处同步**：`package.json.version` = `src/index.ts` 的 `VERSION` = tgz 文件名 = README/CHANGELOG 提及。
- **重打包必升版本号**（pnpm 按 integrity 判定，同版本重打包会残留旧布局 → loader `ERR_MODULE_NOT_FOUND`）；
  不得已同版本重打包时先 `plugin rm` 再 `add`。
- **tgz 只留一份**：安装后删除同目录旧版 tgz（约定见 `../AGENTS.md`）。
- **安装红线**：未验证的改动禁止进生产实例；先用隔离实例验证
  （`DSH_HOME=<独立 home> pnpm dsh web --port 3084 --no-open`），用户授权后再装 3082 并**由用户重启**。
- **产物门禁不得弱化**：`scripts/build.mjs` 的双端打包 + 断言 + typecheck 三职责不可删改；
  `lib/client.js` 必须是自包含 IIFE（含 `__ModuleLoader__`），否则会同批拖垮整个 Web。

## 3. 纪律（诚实与文档）

1. 只宣称已验证的事实；未实现标"规划中/未实现"；写后即验（编译/测试/脚本），失败与回退如实记录。
2. 证据来自真实命令输出，禁止虚构测试或基准数据。
3. 文档与实现同步：宣称能力前确认代码存在；文件增删后更新 `docs/FILE_INDEX.md`。
4. 破坏性操作（删数据/reset/覆盖他人文件/批量改写）先说明影响面与回滚预案，经用户确认。
5. 每轮需求/事故落文档：`docs/REQUIREMENTS.md`（需求→决策→实现→验收）、
   `docs/TROUBLESHOOTING.md`（现象→根因→修复→教训）、`CHANGELOG.md`（版本变更）。
6. **会话交接**：新会话先读 `docs/04-progress/SESSION.md` → 向用户复述"上次进度/下一步/待确认"再动手；
   收尾前更新 SESSION.md + 当日进度。
7. 质量门禁：`scripts/doc-check.sh`（文档一致性）与 `scripts/quality-gate.sh`（里程碑）；
   交付前列明已知限制与未实现项。
