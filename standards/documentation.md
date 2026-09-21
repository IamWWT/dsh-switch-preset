---
title: 文档工程规范（Docs Engineering）
type: standard
status: active
version: 2.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# 文档工程规范（Docs Engineering）

> 版本: 2.0.0 | 状态: active | 适用范围: 全部 Markdown 文档
> 回答三个问题：**docs 怎么编**（头方式/索引/引用）、**每类文档为什么存在**（必要性）、**什么信息必须落 md**（落盘必要性）。

---

## 1. 文档头方式（Frontmatter 规范）

### 1.1 适用规则

| 文档类型 | 是否必须 frontmatter | 说明 |
---------|:---:|------|
| 正式文档（标准/索引/模板/决策/报告/架构/计划） | ✅ 必须 | PRD、ADR、架构、任务计划、测试报告、规范、README 索引等 |
| 流水账（进度日志/经验条目） | ❌ 不需要 | 文件名+标题即元数据，避免流水账维护负担 |
| 需求摄入（request.md） | ⚠️ 建议 | 至少保留"用户原话/提炼/假设表"三节结构 |

### 1.2 Frontmatter 字段（YAML，置于文件第一行 `---` 与 `---` 之间）

```yaml
---
title: <文档标题，与 # 标题一致>
type: index | standard | template | decision | guide | report | plan
status: draft | active | reviewed | superseded
version: <语义化版本，如 2.0.0>
date: <YYYY-MM-DD>
owner: <负责人/团队>
applies_to: <适用范围，如 全部模块 / docs/ 全部文档>
references:
  - <关联文档相对路径>
---
```

约束：

1. `type` 必须是受控枚举（见上），避免自造类型。
2. `title` 与正文一级标题一致（单一真源）。
3. 模板文档用 `type: template`，占位符 `{{...}}` 允许存在。
4. 文档被新增/修改时，`date`/`version` 必须同步更新（同 FILE_INDEX 纪律）。

### 1.3 一级标题与段落结构

1. 每个文档**只能有一个一级标题**（`# `），其后为 `> 元信息引用块`。
2. 章节用二级标题（`## `）起，避免层级跳跃（禁止 `#` 后直接 `###`）。
3. 表格/列表前必须空行（CommonMark 渲染要求）。

---

## 2. 文档索引结构（FILE_INDEX 规范）

### 2.1 结构

`docs/FILE_INDEX.md` 是全仓库文档的**唯一导航入口**，按以下结构组织：

```markdown
# FILE_INDEX - 文件索引

> 由 Agent 维护 | 最后更新: <YYYY-MM-DD> | 项目: <名称>

## 根目录（核心文档）      ← 根层：README/AGENTS/MEMORY 等
## docs/                  ← 按 docs/0X-*/ 分册逐文件登记
## standards/             ← 规范层
## prompts/ / scaffold/ / scripts/   ← 其他层
```

### 2.2 维护规则（强制）

| 事件 | 动作 |
------|------|
| 新增文件 | 追加条目（相对路径 + 一句话用途） |
| 删除/移动文件 | 移除/更新条目 + 更新所有引用方 |
| 目录改名 | 全仓库引用同步（doc-check 辅助） |
| 版本变更 | 更新"最后更新"日期 |

> 脚本支持：`scripts/doc-check.sh` 自动校验"每个 .md 是否在 FILE_INDEX 登记"；`scripts/journal.sh`/`experience.sh` 创建流水账时自动登记。

---

## 3. 目录组织形式（Layout Blueprint）★

> 本文档是全仓库目录组织的**单一真源**；新增/移动目录必须先更新本蓝图再动文件。

### 全仓目录蓝图

```text
<项目根>/
├── README.md / MANUAL.md      # 给人看：总览 + 使用手册
├── AGENTS.md / CLAUDE.md      # Agent 入口：协议 + 铁律
├── MEMORY.md                  # 状态/待办/硬约束（会话间继承）
├── LICENSE / .env.example / .gitignore
├── docs/                      # ★ 项目产出文档（按工艺分册，见下）
├── standards/                 # 规范层（可执行约束）
│   ├── README.md              # 规范地图（框架通用规范）
│   ├── *.md                   # 通用规范：安全/可靠性/性能/可观测/测试/风格/文档/工艺/接口
│   ├── languages/             # 语言适配：java/python/rust/go/node
│   └── enterprise/            # ★ 企业存量规范（Java/数据库/前端/安全…），见其 README
├── prompts/                   # 给用户的一句话指令模板
├── scripts/                   # 工具：init/cleanup/doc-check/quality-gate/journal/experience
└── scaffold/                  # 新项目模板（生成/转正用）
```

### docs/ 分册内容约束（什么类型放哪个分册）

| 分册 | 允许内容类型 | 禁止放入 |
------|-------------|---------|
| `00-request/` | 用户原话、假设表、澄清记录、需求摄入示例 | 设计/代码内容 |
| `01-requirements/` | PRD、需求变更记录 | 技术实现细节 |
| `02-design/` | 架构文档、`decisions/` 下的 ADR | 运行时状态 |
| `03-plan/` | 任务计划、里程碑、DoD | 过程流水账（放 04） |
| `04-progress/` | 进度日志 `YYYY-MM-DD*.md`（流水账，无 frontmatter） | 结论性文档 |
| `05-testing/` | 测试计划、报告、测试脚本子目录 | 开发过程记录 |
| `06-experience/` | 经验条目 `YYYY-MM-DD*.md`、项目复盘 | 企业规范（放 standards/enterprise/） |
| `07-ops/` | 运行手册、排障、发布说明 | 开发文档 |
| `FILE_INDEX.md` / `README.md` / `glossary.md` | 索引/总览/术语（全仓级） | 主题内容 |

### 命名约束

1. 分册目录固定为 `0X-<英文名>`（00-request ~ 07-ops），禁止自造分册编号；新分册需 ADR 或用户确认。
2. 正式文档文件名：`<主题>-<类型>.md`（如 `prd.md`、`adr-001-xxx.md`、`report-2026-08-02.md`）。
3. 流水账文件名：`YYYY-MM-DD[-\<主题\>].md`（journal/experience 脚本自动生成）。
4. 禁止文件名含空格与 `/\:*?"<>|`；中文文件名允许但不与英文混用同一目录命名风格。

### 新增/移动目录规则

1. 先回答：新目录承载的内容是否已有归属分册？（对照上表）
2. 确需新增：更新本蓝图 + `docs/FILE_INDEX.md` + 依赖矩阵（§4.2），并在进度日志记录理由。
3. 目录改名：全仓库引用同步 + doc-check 验证 + 蓝图更新（一次完成，禁止分多次）。

### 企业规范归属（与其他层的关系）

| 规范来源 | 位置 | 优先级 |
---------|------|:---:|
| 企业存量规范（硬约束） | `standards/enterprise/<域>/` | 最高（除非违反安全红线） |
| 框架通用规范（底线） | `standards/*.md` | 中 |
| 语言适配 | `standards/languages/*.md` | 中（叠加在企业/通用之上） |
| 项目内新增约定（ADR/规范） | `docs/02-design/decisions/` 或 `standards/`（经评审） | 低-中 |

> 企业规范导入/转化/冲突裁决流程见 `standards/enterprise/README.md`。

## 4. 交叉引用约束（相互引用规范）

### 4.1 引用方式

| 引用类型 | 写法 | 要求 |
---------|------|------|
| 同仓文件 | ``[显示名](相对路径.md)`` | 路径必须真实存在（doc-check 校验） |
| 锚点引用 | ``[文本](file.md#标题)`` | 锚点对应标题必须存在（新增检查项） |
| 反引号路径 | `` `docs/xxx.md` `` | 仅用于非导航性提及；正式引用用链接 |
| 外部链接 | `https://...` | 说明引用理由 |

### 4.2 依赖矩阵（必更新项 vs 审查项）

任何文件变更后，按矩阵决定联动更新范围：

| 被变更文件 | 必更新（依赖方） | 审查项（相关方） |
-----------|-----------------|-----------------|
| `AGENTS.md`（铁律/流程） | `MEMORY.md`、`docs/FILE_INDEX.md`、项目级 `AGENTS.md` 模板 | `standards/` 相关规范 |
| `standards/*.md` | `standards/README.md` 地图、FILE_INDEX | `AGENTS.md` 铁律引用 |
| `docs/FILE_INDEX.md` | 无 | 所有被索引文档 |
| 架构决策（ADR） | `docs/02-design/decisions/README.md` 索引、FILE_INDEX | `architecture.md`、AGENTS.md |
| 代码模块/接口 | 对应 `standards/interfaces.md` 契约记录、API 文档 | 测试文档、README |
| 环境变量/配置 | `.env.example`、运行手册（docs/07-ops/） | MEMORY.md 状态表 |

### 4.3 引用纪律

1. **禁止指向不存在的文件/标题**（写后即验，doc-check 兜底）。
2. **禁止复制内容代替引用**——同一事实只存在一处（单一真源，铁律 #4），其他文档用链接。
3. 文档间双向可达：被引用的文档应能从索引/上级文档找到（避免孤儿页）。
4. 模板中允许 `{{...}}` 占位符，正式文档禁止残留。

---

## 5. 文档必要性论证（每类文档为什么必须存在）

> 原则：**每份文档都必须回答"没有它会发生什么"**。答不上来的文档不建。

| 文档 | 必要性 | 没有它的后果 |
------|--------|-------------|
| `docs/00-request/request.md` | 需求唯一真源；假设与澄清留痕 | 范围漂移、误解无法追溯、AI 凭空补需求 |
| `docs/01-requirements/prd.md` | 功能清单 + 可测试验收标准（DoD 依据） | 无法验收、开发凭感觉 |
| `docs/02-design/architecture.md` | 模块边界与契约总览 | 模块耦合失控、新人无法理解 |
| `docs/02-design/decisions/adr-*.md` | 决策背景与备选存档 | 决策反复、后人不知道为什么 |
| `docs/03-plan/tasks.md` | 里程碑/任务/DoD/依赖 | 进度不可跟踪、批次不可验证 |
| `docs/04-progress/*.md` | 诚实过程记录（含失败） | 无法复盘、AI 跨会话失去连续性 |
| `docs/05-testing/*.md` | 测试证据（真实命令输出） | "完成"无法证明、宣称不可信 |
| `docs/06-experience/*.md` | 经验沉淀与跨项目继承 | 重蹈覆辙、教训随会话丢失 |
| `docs/07-ops/runbook.md` | 部署/排障/回滚手册 | 无法运维、交接困难 |
| `docs/FILE_INDEX.md` | 全仓库导航 | 文档不可发现、索引腐烂 |
| `docs/glossary.md` | 术语统一 | 沟通歧义、文档语义漂移 |
| `standards/*.md` | 生产级底线（可执行检查项） | 质量随 Agent 状态波动 |
| `MEMORY.md` | 当前状态/待办/硬约束 | 新会话不知道做到哪、什么不能碰 |

### 5.1 什么信息**必须**落 md（落盘必要性）

以下信息**禁止只存在于对话/聊天/代码注释**中，必须落盘：

1. **需求与假设**：用户原话、Agent 做的假设、澄清结论。
2. **决策与理由**：技术选型、取舍、豁免声明（含为什么）。
3. **过程事实**：做了什么、验证命令与结果、失败与回退。
4. **经验教训**：踩坑、根因、解决、适用范围。
5. **状态与约束**：当前进度、待办、硬性规定、凭证策略。
6. **契约与接口**：模块接口、API 语义、数据结构、错误码。
7. **验收证据**：测试输出、基准数据、评审结论。

### 5.2 为什么必须落 md（跨会话继承的根因）

| 理由 | 说明 |
------|------|
| **上下文有界** | AI 会话上下文有限，md 是跨会话、跨 Agent 的记忆载体 |
| **可追溯** | 一句话需求 → 假设 → 决策 → 代码 → 证据，全链可回溯 |
| **可审查** | 企业交付要求文档评审、审计、交接 |
| **防幻觉** | 文档与实现对照，宣称必须有证据，AI 不能"说完成就完成" |
| **并行协作** | 多 Agent/多人共享单一真源，避免各自脑补 |

---

## 6. 文档依赖链（工艺对应关系）

```
一句话需求
   │
   ▼
docs/00-request/request.md ──► docs/01-requirements/prd.md
                                      │
                                      ▼
                          docs/02-design/architecture.md + decisions/adr-*.md
                                      │
                                      ▼
                                docs/03-plan/tasks.md
                                      │
              ┌───────────────────────┼───────────────────────┐
              ▼                       ▼                       ▼
       docs/04-progress/        src/（代码）           docs/05-testing/
       （每批诚实记录）              │                   （证据报告）
                                      ▼
                         docs/06-experience/ + MEMORY.md（经验与状态回流）
                                      │
                                      ▼
                       docs/07-ops/runbook.md + README（交付）
```

依赖规则：

1. 下游文档引用上游文档的**编号/版本**，不复制内容（如 PRD 引用 request.md 假设编号）。
2. 变更只能顺流传播：改需求 → 评估 PRD/架构/计划/进度/测试是否联动（见 §4.2 矩阵）。
3. 流水账（progress/experience）是过程的**唯一事实源**，复盘报告引用它，禁止凭记忆重写。

---

## 7. 文档健康检查

`scripts/doc-check.sh` 强制校验：

- [ ] FILE_INDEX 覆盖全部 .md（含模板）
- [ ] 相对链接可解析、无断链
- [ ] 正式文档 frontmatter 齐全（title/type/status/version/date）
- [ ] 非模板文档无 `{{...}}` 残留
- [ ] 无尾随空格 / CRLF（结构检查）
