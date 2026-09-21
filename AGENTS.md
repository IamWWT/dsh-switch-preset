# AGENTS.md — dsh-switch-preset AI 协作开发协议

> 本文件是 Agent（DSH 工程模式及任何兼容 Agent）在本项目的**单一入口**。
> 用户一句话提出需求 → 按本协议执行，产出生产级代码，每步诚实记录到 `docs/`。

## 0. 必读顺序（渐进加载，不要一次读完仓库）

1. `README.md` — 项目是什么
2. 本文件 — 协议与铁律（读完）
3. `standards/README.md` + 任务相关的 2-3 份规范（按需）
4. `docs/README.md` + `docs/FILE_INDEX.md`
5. `docs/04-progress/SESSION.md`（存在则先读：上次交接状态）
6. `docs/00-request/request.md`（不存在则按 Phase 0 创建）

语言默认中文。技术基线见 `standards/languages/` 对应语言适配文档（未指定语言则按最小可行栈选型并记录到 `docs/02-design/architecture.md`）。

## 1. 诚实纪律（最高优先级，不可违反）

1. 只宣称已验证的事实；未实现标"规划中/未实现"。
2. 写后即验：每次写文件/改代码后立即验证（编译/测试/脚本执行），结果入进度日志。
3. 失败如实记录：进度日志必须含失败、回退、修复过程。
4. 证据来自真实命令输出，禁止虚构测试/基准数据。
5. 假设留痕：需求不明做合理假设写入 `docs/00-request/request.md` 假设表（含依据与影响）；仅不可逆/高风险决策停下来问（一次最多 3 问）。
6. 文档与实现同步：宣称任何能力前确认代码存在；文件变更后核对 `docs/FILE_INDEX.md`。
7. 破坏性操作（删数据/reset/覆盖他人文件/批量改写）先说明影响面与回滚预案，等用户确认。

## 2. 七阶段执行协议

| 阶段 | 产物 | 完成标准 |
|------|------|---------|
| P0 需求摄入 | docs/00-request/request.md + docs/01-requirements/prd.md | 需求经 grill-me 澄清（或用户明确免问）；每个 P0 需求有可测试验收标准 |
| P1 设计与选型 | docs/02-design/architecture.md + decisions/（ADR） | 最小可行栈；显著决策有 ADR；模块只依赖契约 |
| P2 任务计划 | docs/03-plan/tasks.md | 每任务有 DoD；每批可独立验证 |
| P3 脚手架 | 骨架 + .env.example + 构建配置 | 空壳 build+test 在干净环境通过 |
| P4 增量实现 | 每批：代码+测试+文档+经验 | 单测绿；FILE_INDEX/MEMORY/进度已更新；中途需求已按变更协议登记 spec（原话+版本+验收标准） |
| P5 测试加固 | docs/05-testing/ 带证据报告 | 安全/可靠性/性能/可观测清单逐项过完 |
| P6 交付复盘 | README/运行手册/CHANGELOG/复盘/总结 | quality-gate 全绿；已知限制列明 |

**Phase 0 细节**：一句话需求先用 **grill-me** skill 做 relentless 追问（目标/范围/边界/优先级/非目标），达成共识后再动笔；用户明确说"不用问直接做"时跳过，改走假设表。用户原话完整抄入 request.md，并锁定**目标项目路径**（写入 request.md；跨项目联合开发时声明路径集合，目标外写入先经用户确认——防目标漂移）。企业规范（`standards/enterprise/`）存在时列为 PRD 硬约束。

**与 DSH 机制的对应**：复杂改动先进 plan 模式（决策完备方案，批准后实施）；长任务/跨会话用 goal 跟踪并按 §4 留交接单；批量独立子任务用 subagent，大批量流程用 workflow（用户要求时）。每阶段产物必须落 `docs/`，禁止只留在对话里。

核心原则：

- **最小可行栈**：每加一个中间件/框架必须有理由；复杂度要 ADR 背书。
- **契约先行**：接口/数据结构先于实现；模块间只依赖契约。
- **冲突优先级**：生产安全 > 数据一致性 > 可审计 > 现有资产；豁免必须声明 范围/边界/回退。
- **单一真源**：状态矩阵/枚举/配置只存在一处（规则/配置/矩阵禁止双写漂移）。

## 2A. DSH 插件专项纪律（本项目 kind = dsh-plugin）

本项目是 **DSH（DeepSeek Harness）插件**，以下纪律叠加在 §1-§4 之上（完整规范：本机 deepseek-harness 仓库 `dsh-plugins/PLUGIN-DEV-STANDARD.md` + `DEV-WORKFLOW-GUIDE.md`，如存在则先读；不存在时以下列红线为准）：

- **SDD 规格驱动（强制）**：`docs/specs/<id>/` 三件套 `spec.md → plan.md → tasks.md`；**规格未获用户确认前禁止进入实现**。验收以 spec 验收标准逐条对照。
- **双端边界**：Host（Node：路由/状态/外部服务）与 Client（浏览器：插槽/卡片/UI）只在契约处相接；client 侧禁止 value-import 其他插件；`@deepseek-ai/*` 服务包走 peerDependencies。
- **构建产物门禁**：`scripts/build.mjs` 三职责（双端 esbuild 打包 + 产物断言 + 双 tsconfig typecheck）不得删改弱化；检查命令不加管道裸跑（要管道就 `set -o pipefail`）。
- **版本四处同步**：`package.json version` = `src/index.ts VERSION` = tgz 文件名 = README/CHANGELOG；重打包必升版本号（pnpm 按 integrity 判断，同版本重打包导致 loader `ERR_MODULE_NOT_FOUND`）。
- **安装红线**：未验证的改动**禁止**装入生产 DSH 实例；先用临时实例验证（`DSH_HOME=$HOME/.dsh-<name>-test pnpm dsh web --port 3084`），用户验收后再装生产。开发期用 link 安装，tgz 仅用于稳定版。
- **client 主题**：走 DSH 主题 token（`--dsw-*` 等），明暗模式自动跟随，禁止硬编码颜色。
## 3. 编码铁律（编号；只增不删，新增必须带日期与触发原因）

| # | 规则 |
|---|------|
| 1 | 参数外化：源码禁硬编码密钥/IP/端口；凭证默认值为空 |
| 2 | fail-closed：外部入口必须鉴权；鉴权密钥为空拒绝启动 |
| 3 | 契约先行：模块间只依赖接口契约 |
| 4 | 单一真源：每个事实只存一处 |
| 5 | 并发安全：状态变更 CAS；消费幂等；有界重试（2-3 次）后升级或明确失败 |
| 6 | 测试宪法：单测快而确定；集成用真实依赖；关键路径 E2E；证据落盘 |
| 7 | 可复现构建：依赖锁版本；干净环境可构建 |
| 8 | 显式失败：禁吞异常；fail-soft 有日志+兜底；超时/重试/熔断可配置 |
| 9 | 性能靠基准：无基准不写数字；大数据量禁深 OFFSET（用 keyset） |
| 10 | 文档与实现一致：宣称能力前确认代码存在 |
| 11 | 破坏性操作需确认（见 §1.7） |
| 12 | 经验必留痕：任务后记教训；一般性教训提升为铁律（编号+日期+原因） |
| 13 | 文档工程合规：正式文档有 frontmatter + FILE_INDEX 登记 + 可解析引用；接口契约留痕 |
| 14 | 企业规范优先：standards/enterprise/ 是硬约束，冲突时以其为准（安全红线除外，升级用户裁决） |
| 15 | 会话交接必留痕：SESSION.md + 当日进度 + MEMORY.md 三同步；新会话先读交接单再动手 |
| 16 | system prompt 节约：进 system prompt 的内容（本文件/preset persona）必须薄；重内容走渐进加载（按需读文件、按需调 skill） |
| 17 | 需求澄清优先：一句话需求先 grill-me 澄清再动手（用户明确免问除外） |

## 4. 文档纪律

编制硬要求（详见 `standards/documentation.md`）：

- **Frontmatter**：正式文档（PRD/ADR/架构/计划/报告/规范）必须带头部 YAML（title/type/status/version/date），流水账不需要。
- **索引**：任何文件增删移动后更新 `docs/FILE_INDEX.md`（doc-check 校验）。
- **引用**：交叉引用必须可解析；变更按 `standards/documentation.md` §4.2 依赖矩阵联动，禁止复制内容代替引用。
- **必要性**：每份文档回答"没有它会出什么问题"；七类信息（需求/决策/过程/经验/状态/契约/证据）禁止只存在于对话。

| 事件 | 必须更新 |
|------|---------|
| 文件变化 | docs/FILE_INDEX.md |
| 需求/假设变化 | docs/00-request/request.md |
| 架构决策 | docs/02-design/decisions/（ADR） |
| 每批完成 | docs/04-progress/<日期>.md（含失败与回退） |
| 测试完成 | docs/05-testing/（命令+输出证据） |
| 状态/待办变化 | MEMORY.md |
| 一般性教训 | docs/06-experience/ + 必要时提升为铁律 |

**会话交接**：新会话启动按 §0 顺序读取（SESSION.md 优先）→ 先向用户汇报"上次进度/下一步/待确认" → 确认后再动手。结束前更新 SESSION.md（`scripts/handoff.sh`）+ 当日进度（`scripts/journal.sh`）+ MEMORY.md。

## 5. 质量门禁（Definition of Done）

- **每次提交**：lint/单测通过；无硬编码密钥（`rg` 抽查）；FILE_INDEX 已同步。
- **每里程碑**：`scripts/doc-check.sh` 通过 + 集成测试（真实依赖）+ 进度日志（含失败）。
- **交付/发布**：`scripts/quality-gate.sh` 全绿 + 安全/可靠性清单过完 + 性能基准（或注明未测）+ 交付总结列明已知限制与未实现项。

## 6. 常用命令

```bash
scripts/doc-check.sh       # 文档一致性检查
scripts/quality-gate.sh    # 质量门禁
scripts/journal.sh "..."   # 追加进度日志
scripts/experience.sh "主题" "场景" "问题" "根因" "解决"
```

构建/测试命令见 `standards/languages/` 对应语言适配文档。
