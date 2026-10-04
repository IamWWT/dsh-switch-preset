# SESSION — 会话交接单

## 当前状态

- 文档性质：会话交接单
- 对应版本：v0.6.0（2026-10-05）
- 状态：有效（如与实现不符，以代码与 `docs/REQUIREMENTS.md` 为准）
- 维护者：AI + 用户


> 交接协议：新会话先读本文件 + `docs/04-progress/PROGRESS.md`（✅/🔄/⏭），向用户复述后动手。

## 🔄 进行中 / 上次进度

0. **v0.6.0 记忆路由 + B1 修复（2026-10-05）——代码、typecheck、单测全绿；tgz 已打包，安装未做**：
   - **新增 `/router-preset-memory <原话>`**（用户记忆路由指导文件第 2 步）：与 `/router-preset`
     相同判定→切换（复用 `switchPreset` 单一真源），但投递内容 = **dsh-kb 渐进加载的记忆
     （L1 人物画像 ≤100 行 → L2 项目卡片关键词匹配 ≤2×40 行 → L3 近 3 天日记节选）+ 原话**。
     实现：`src/host/memory.ts`（新增，纯逻辑零 LLM、零插件依赖；kbRoot 四层回退
     config → DASH_KB_HOME → 模块推导 → ~/dsh-kb）；`routePreset` 可选第 6 参 `enrich`；
     Config 新增 `kbRoot` volatile 字段。知识库缺失/读取失败 → `ok=false` **不阻塞**切换与投递。
   - **B1 修复（用户现场反馈）**：新会话下 `/router-preset` 未达阈值 → 页面无任何输出。
     根因（上游代码实证闭环）：未达阈值只返回 CommandResult（无会话事件）→ host blank 状态机
     只认 `turn/start` 翻转（list.ts:49）→ chat 视图 isActive 要求非 command 节点
     （chat-snapshot-builder.ts:1206 + 测试断言）→ activeTargets 实为 isActive 过滤
     （assembly.ts:174）→ `DefaultConversationViews.tsx:35` blank 返回 null。**影响所有纯文本命令**。
     修复（用户确认方案）：未达阈值**不切换模式**，但投递「判定详情 + 原话」到**当前模式**继续
     （投递产生 turn/start → blank 翻转 → 判定详情必然可见）；投递失败如实回显不假报成功。
     语义变更：v0.5.1「未达阈值不投递」→ v0.6.0「未达阈值不切换、但投递判定详情+原话到当前模式」；
     `routerEnabled=false` 分支保持不投递（尊重开关）。
   - 验证：双 tsconfig typecheck 全绿（@types/node 经 store junction 补链修复 pnpm install 残留）；
     esbuild CLI 双端打包（lib/index.js 43695B 含 memory 接线与 VERSION 0.6.0）；
     6 组测试全绿（冒烟 / switch / picker / router **22 项**（2 处断言随 B1 语义更新）/
     memory **6 项**（新增）/ settings **25 项**）。
   - **未做（需授权）**：`npm pack` 已产出 `dsh-switch-preset-0.6.0.tgz`（302945B），但**未安装**：
     Windows 桌面版装 tgz + 托盘退出后重开验收（B1 的新会话低置信度场景 + memory 命令端到端）。
   - 环境备注：Windows 本机 `node_modules` 顶层 esbuild/@types 链接因 pnpm install 中断缺失，
     已建 junction 到 `.pnpm` store 恢复；插件 `lib/` 目录此前缺写权限（ACL），已按
     diagnose-windows-sandbox-acl 修复（`acl-recovery/` 报告在 `D:\myrepo\proj\deepseek\acl-recovery\`）。

1. **v0.5.1 路由参数可配 + 插件页原生配置区（2026-09-28）**：已交付并验证。
   - 交付：插件行 volatile 设置字段 `routerSettings`（`routerEnabled` 默认 true；`routerThreshold`
     默认 0.6、范围 0–1、非法回落）；`routePreset()` 第 5 参改 `RouteOptions` 并新增
     「判定后、切换前」的关闭早返回（不切换、不投递）；`src/host/settings.ts`（0.1.7 设置面 +
     REST 数据面 + host 侧阈值校验）；客户端注册 `plugins.bundle.config`（key = 包名
     `dsh-switch-preset`）配置卡片（开关 + 阈值 + 保存 + 失败明确文案）。
   - 验证：`pnpm check` 全绿（构建门禁 + 双 tsconfig + 5 组测试：冒烟 / switch / picker /
     router **22 项** / settings **25 项**）。
   - **未做**：3084/3082 浏览器实测（点开插件详情页看配置区 → 改参数 → 保存后 `/router-preset`
     行为随之改变）——`pnpm check` 只覆盖"产物接线 + host 逻辑 + REST 面"，不等于端到端验收（spec 002 §6 U4）。
   - 交付物：`dsh-switch-preset-0.5.1.tgz`（同一 `pnpm check` 产物；旧 0.5.0 tgz 已按"只留一份"删除）。
   - 依赖口径提醒：`.volatile()` 需 `@deepseek-ai/schemastery ≥ 3.18.3`；本机曾残留 3.18.2
     （lockfile 为 3.18.4），已用 `pnpm install --frozen-lockfile` 对齐（不改锁文件、不改上游）。

1. **v0.5.0 概率路由 `/router-preset`（2026-09-28）**：已交付并验证。
   - 交付：`ModeScorer` 可插拔概率引擎 + `/router-preset` 三步流水（判定 → 切换 → 投递原话）+ 客户端置顶入口。
   - 验证：`pnpm check` 全绿（`test/router-test.mjs` 15 项）；3084 隔离实例真实 6 模式环境
     端到端实测通过（`agent-preset/selected{agentPreset:video}` + `agent/inbox/spliced` 原话入队 +
     `system/message` 为视频模式人设）。证据链见 `docs/REQUIREMENTS.md` v0.5.0 条目。
   - 关键设计结论：**投递必须在 Host 侧**（上游命令 handler 不发模型消息，客户端拿不到键入命令的结果）。
   - 交付物：`dsh-switch-preset-0.5.0.tgz`（已被 0.5.1 取代并删除）。

## ⏭ 下一步 / 待确认

- **安装 v0.6.0 待用户授权**：Windows 桌面版装 `dsh-switch-preset-0.6.0.tgz`
  （`"D:/software/applications/DSH/resources/runtime/cli/bin/dsh.cmd" plugin --profile desktop add <abs tgz>`）
  装完**必须托盘退出后重开桌面应用**（窗口 X 不退出进程，插件永不生效）。装完验收：
  ① 新会话输入 `/router-preset <低置信度原话>`（如普通问候）→ 页面必须看到完整判定详情
  （概率分布 + 未自动切换说明）且原话被当前模式继续处理（B1 修复的现场场景）；
  ② 新会话输入 `/router-preset-memory <原话>` → 判定详情 + 「已加载记忆：L1…L2…L3…」回显，
  且投递内容含 dsh-kb 记忆（注意先确认 profile 的 `kbRoot` 配置或 DASH_KB_HOME 指向 dsh-kb）；
  ③ 达阈值场景行为不变（切换 + 投递原话）。
  装完删旧 `dsh-switch-preset-0.5.1.tgz`（与 profile 引用变更同一步，只留 0.6.0 一份）。
- 可选后续：把 `LocalModeScorer` 替换为 JEV 类模型的概率输出（`ModeScorer` 接口已就绪，命令层零改动）。

---

> 交接协议：新会话先读本文件 + `docs/04-progress/PROGRESS.md`（✅/🔄/⏭），向用户复述后动手。

## 上次进度（本会话完成）

0. **v0.3.0 强制切换（2026-09-18）**：应"已开始会话也要换模式"要求，`/switch-preset` 对已开始
   会话走 `ctx.agentPresets.recompose` 强制重装配 + 事件记录（不再只写默认）；10 组单测全绿；
   **已 link 装上 3082，待用户重启生效**（用户选稍后自行重启）。

1. **P0-P2**：需求澄清闭环（3 决策 + 选择器增强）→ request.md / PRD / spec(AC-1~11) / plan / tasks。
2. **P3-P4**：完整实现（`npm run check` 全绿 = 构建门禁 + 双端 typecheck + 3 组测试）：
   - Host：`/switch-preset`（commands）+ create/fork 切换（switch.ts 纯逻辑）+ settings 命名空间；
   - Client：设置卡 + 🔄 模式选择器（复用 remote.commands 通道）+ command/executed 自动跳转。
3. **临时实例验证（3084，项目内 test-home）**：安装成功 → 修复 cordis.patch 空数组缺陷 → `dump-config` 组合树含插件 → 实例稳定、Web UI 正常（DOM 检查无 JS 崩溃）。
4. **质量门禁**：doc-check + quality-gate 全绿。
5. **环境副作用与修复**：dsh-test-home 依赖重装失败 → 已用 lockfile `pnpm install --force` 恢复（关键插件 lib 校验 OK）；TS7 锁版、PNPM_HOME 绕行等 7 条踩坑固化进 TROUBLESHOOTING。

## 下一步（见 PROGRESS.md ⏭）

- **⚠️ 3082 安装暂缓**（2026-09-17 用户选择）：根挂载只读（`/` ro，`~/.dsh-dev` 物理不可写），`plugin add` EROFS。待 rootfs 恢复可写后：install:dev → 同意后重启 dev-web → 按 AC-1~11 交互验收。
- 预览渠道：临时实例 3084 保持运行（token 见会话日志），可先查看设置卡与选择器。

## 待确认事项

| # | 事项 | 影响 |
|---|------|------|
| 1 | 3082 安装：待 rootfs 恢复可写（用户处理/系统恢复） | 恢复后即可装；重启需用户同意 |
| 2 | 运行中 3082 的持久化写入风险（只读 home） | 已告知用户，其选择暂缓观察 |
| 3 | 测试 home（dsh-test-home）后续维护 | 已恢复；若再遇依赖问题走本插件 test-home |