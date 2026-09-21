---
title: PRD — dsh-switch-preset 会话模式切换插件
type: prd
status: draft
version: 1.0.0
date: 2026-09-16
owner: 用户 + AI
applies_to: dsh-switch-preset
---

# PRD — dsh-switch-preset（会话模式切换插件）

> 版本: v1.0.0 | 状态: Draft | 创建: 2026-09-16 | 维护人: AI + 用户
> 来源: docs/00-request/request.md

## 1. 背景与目标

- **背景**：Web GUI（3082）中，会话创建后其 Agent preset（DSH 官方"模式"概念，如 standard/minimal/自定义 preset）即固定；想换模式只能手动新建会话并重新挑选，无法在会话进行中一步完成。用户需要斜杠指令 `/switch-preset` 来切换，且切换出的新会话是否继承当前会话历史上下文可配置。
- **目标（可衡量）**：
  1. `/switch-preset` 指令可用（无参列出当前模式+全部可用模式；带参完成切换）；
  2. 设置页出现「历史上下文是否继承」开关（默认关），切换行为随设置变化（继承→fork 复制历史；不继承→create 干净上下文）；
  3. 切换成功后 Web 端自动跳转到新会话，原会话保留可切回；
  4. 全部复用 DSH 框架机制（commands / sessionController / agentPresets / settings 卡 / uiWorkspace 导航），无自建会话存储。
- **非目标**：不做模式增删改管理页（DSH roster 自带）；不做 plan mode 管理（DSH 自带 `/plan`）；不改 agent-presets 官方 picker；不改写 preset/会话持久化机制。

## 2. 用户与场景

| 用户角色 | 场景 | 关键需求 |
|---------|------|---------|
| Web GUI 用户（3082 主力） | 会话进行中想把当前会话换成另一模式（如从 standard 切到自定义 preset 做专项任务），并希望新会话不带旧历史重新开始 | `/switch-preset <presetId>` 一步完成 + 自动跳转 |
| Web GUI 用户 | 想保留对话演进线索，换模式后继续接着聊 | 设置「继承历史上下文」= 开 → 切换=复制当前会话（含历史），并明确提示框架限制（preset 不变） |
| Web GUI 用户 | 不确定当前会话是什么模式、有哪些模式可选 | `/switch-preset`（无参）列出当前模式 + 可用模式清单（含 broken 标注） |

## 3. 功能需求（带优先级）

| ID | 优先级 | 需求 | 验收标准（可在临时实例 3084 验证的标 🔬；需 3082 验证的标 🖥） |
|----|:---:|------|------|
| F-01 | P0 | 注册斜杠指令 `switch-preset`（Host `ctx.commands.register`） | 1. 🔬 指令出现在命令列表（`ctx.commands.list(agent)` 可查）2. 🖥 Web composer 输入 `/switch-preset` 触发 handler 且不产生模型消息 |
| F-02 | P0 | 无参 `/switch-preset`：展示当前会话模式 + 全部可用模式（roster 单一真源，broken 标注） | 1. 🔬 输出含当前 preset id（与 session 的 agentPreset 投影一致）2. 🔬 可用模式列表与 `ctx.agentPresets.list()` 一致 3. 🔬 broken 预设被标注 |
| F-03 | P0 | 设置项「历史上下文是否继承」（命名空间 `switchPreset.inheritHistory`，默认 false）：Host Config + settings 卡片 | 1. 🔬 config schema 含 `inheritHistory: boolean` 默认 false 2. 🖥 设置页出现该开关，读写生效 3. 🔬 配置键确实被代码消费（无纸面键） |
| F-04 | P0 | `inheritHistory=true` 时 `/switch-preset <id>`：**fork 当前会话**（历史全带、preset 保持源会话） | 1. 🔬 fork 返回新 sessionId，新会话事件流包含源历史 2. 🔬 输出文本明确提示"继承模式无法更换 preset（DSH 限制），已复制当前会话" 3. 🔬 会话无可 fork turn 时返回明确错误（不产生半成品） |
| F-05 | P0 | `inheritHistory=false`（默认）时 `/switch-preset <id>`：**create 新会话**（干净上下文、目标 preset） | 1. 🔬 create 的 session 以目标 preset 组成（preset 投影为目标 id）2. 🔬 新会话事件流为空（无继承历史）3. 🔬 目标 preset 不存在/broken 时返回明确错误，不创建会话 |
| F-06 | P0 | client 自动跳转：监听 `command/executed`，name=`switch-preset` 且成功 → 解析新 sessionId → `uiWorkspace.openSession(sessionId)` | 1. 🖥 切换成功后当前会话视图切换为新会话 2. 🔬 事件缺失/解析失败时降级为成功文本提示（不崩溃） |
| F-07 | P1 | 指令输入提示：`input: { hint: '<preset-id>' }` | 🖥 composer 中 `/switch-preset ` 后出现 hint |
| F-08 | P1 | 无参指令输出附带每个模式的 display name/description | 🔬 输出用 roster 的 display 字段 |

优先级定义：P0 必须有（缺了产品不成立）；P1 应该有（延迟不影响核心）；P2 可以有。

## 4. 非功能需求

| 类别 | 需求 | 验收标准 |
|------|------|---------|
| 可靠性 | 切换动作不产生半成品会话 | fork/create 失败时明确错误返回；H5 前提校验 |
| 可观测 | 指令 handler 关键路径有日志（切换原因/目标 preset/结果） | host 日志可见 `switch-preset` 相关行（warn 级失败路径） |
| 安全 | 不引入新权限面；settings 键按标准声明 | 无 secrets；配置键被消费；不绕过现有鉴权（复用既有 Remote，无新路由） |
| 兼容 | 与 DSH 0.1.x 预发布 API 演进兼容 | 关键服务调用点集中封装（单点适配），services 形状自声明并在 TROUBLESHOOTING 记录版本基线 |
| 性能 | 指令 handler 无同步阻塞 | fork/create 为既有异步 Remote，无额外开销 |
| 主题 | 设置卡片用 DSH 主题 token | 无写死色值 |

## 5. 里程碑与范围

| 里程碑 | 范围 | 验收 |
|--------|------|------|
| M0 脚手架 | 空壳 build+test 通过（骨架已生成） | `npm run check` 绿（注：npm 安装缓存指向项目内 `.npm-cache/`） |
| M1 Host 指令 | F-01/F-02/F-04/F-05（commands + switch 逻辑 + 校验） | 单测绿 + 临时实例实弹 |
| M2 设置 | F-03（Config + settings 卡片 + client） | 设置读写验证 |
| M3 client 跳转 | F-06（command/executed 监听 + openSession） | 临时实例端到端 |
| M4 加固交付 | P1（F-07/F-08）+ 文档 + 门禁 | doc-check/quality-gate 全绿 |

## 6. 变更记录

| 日期 | 变更 | 原因 |
|------|------|------|
| 2026-09-16 | v1.0.0 初稿 | P0 澄清闭环（用户确认：preset 复用 + fork/create 语义 + `/switch-preset` 命名） |