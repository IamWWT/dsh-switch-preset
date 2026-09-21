---
title: 企业规范目录（Enterprise Standards）
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: 企业维护人
applies_to: 全部项目（init-project 自动复制到新项目）
references:
  - ../README.md
  - ../documentation.md
---

# 企业规范目录（Enterprise Standards）

> 存放**企业现有的存量开发规范**（Java 开发规范、XX 数据库开发规范、前端开发规范、安全规范、发布流程等）。
> 这些规范是每个项目的硬性参考，Agent 每次开发都必须遵守。
> 与 `standards/` 下框架通用规范的区别：**企业规范优先**（见 §4 优先级）。

---

## 1. 目录蓝图（什么规范放哪里）

```text
standards/enterprise/
├── README.md              # 本文件：目录蓝图 + 导入流程 + 优先级（单一真源）
├── _inbox/                # 原始文档收件箱（docx/pdf/html/txt/旧 md，未转化前放这里）
├── java/                  # Java 开发规范（编码规范、工程结构、Maven/Gradle 约定）
├── database/              # 数据库开发规范（命名、索引、分页、迁移、数据字典）
├── frontend/              # 前端开发规范（框架选型、组件、样式、状态管理）
├── api/                   # 接口规范（REST/gRPC 约定、错误码、版本策略）
├── security/              # 安全规范（认证授权、凭证管理、审计、合规红线）
├── process/               # 流程规范（研发流程、评审关口、发布/变更流程、文档模板）
└── quality/               # 质量规范（测试要求、代码评审、CI 门禁、性能要求）
```

规则：

1. **每个主题一个子目录**；没有匹配子目录的规范放 `quality/` 或新建子目录（需登记本蓝图）。
2. 每个子目录内每份规范一个 `.md` 文件，命名 `<域>-<主题>.md`（如 `java-编码规范.md`、`database-分页规范.md`）；禁止文件名含空格与 `/\:*?"<>|`。
3. **原始文件（未转化）只允许放 `_inbox/`**，转化完成后移入 `_source/`（见 §2），禁止原始格式文件直接进子目录。
4. 子目录内允许 `README.md` 说明本域规范清单，但**每份规范的完整内容必须独立成文**，README 只做索引。

## 2. 导入与转化流程（Agent 执行）

企业提供了原始规范文档时，按以下流程转化为框架可用的 markdown 规范：

### 2.1 用户动作（一次性）

把原始文档放入 `standards/enterprise/_inbox/`，然后发一句话：

```
把 _inbox/ 里的企业规范全部导入（见 prompts/import-standards.md）
```

### 2.2 Agent 转化（每份文档）

1. **读取原文**：解析 docx/pdf/html/txt/md，提取**强制条款**（必须/禁止/要求）与可选建议。
2. **分类**：按 §1 蓝图确定目标子目录；无法分类的询问用户或放 `quality/` 并在 README 记录。
3. **改写为 markdown**：
   - 文件头带 frontmatter：`type: standard`、`status: active`、`version`、`date`、`owner: 企业`、`references`（标注原始文件名）。
   - 结构：`# <规范名>` → `## 1. 适用范围` → `## 2. 强制条款`（每条可检查）→ `## 3. 建议` → `## 4. 例外与豁免`（原文有则保留）。
   - **保留全部强制条款语义，禁止删减/弱化**；原文模糊处标注"原文未明确：…"。
4. **落盘**：写入目标子目录；原始文件移入 `_inbox/_source/`（保留可溯源）。
5. **登记**：更新 `standards/enterprise/README.md`（子目录清单）与 `docs/FILE_INDEX.md`（新增 md 必须登记）。
6. **验证**：`bash scripts/doc-check.sh` 通过（frontmatter/索引/占位符）。

### 2.3 转化后的使用

- Agent 在**每次需求摄入（Phase 0）**读取企业规范清单，作为硬约束写入 PRD 非功能需求与任务 DoD。
- 编码/评审时按对应域规范检查（如 Java 开发按 `standards/enterprise/java/`）。
- 企业规范与框架通用规范冲突时按 §4 处理。

## 3. 敏感信息约束

- **禁止**把含凭证、内部地址、机密信息的内容未脱敏直接入库。
- 导入前检查原始文档；含敏感信息时只改写"规则条款"，凭证/地址用 `<占位>` 替代，原文留在 `_inbox/_source/`（不入库的目录可自行 gitignore）。
- 生产凭证管理规则见 `standards/security.md`。

## 4. 优先级（冲突裁决）

企业规范与框架通用规范冲突时：

1. **企业规范优先**（企业现实约束 > 框架通用建议；符合"现有资产不可推翻"原则）。
2. 例外：企业规范**违反框架安全红线**（如允许硬编码凭证、无鉴权入口）时，不能直接遵从——升级给用户裁决，并在规范中标注冲突条款。
3. 裁决结果记录到 `standards/enterprise/README.md` 的"冲突裁决记录"表。

| 日期 | 冲突条款 | 裁决 | 依据 |
------|---------|------|------|
| （暂无） | | | |

## 5. 维护

- 企业规范更新时：Agent 按 §2.2 流程重写并更新 version/date。
- 新增子目录：更新本蓝图 §1 + FILE_INDEX + 依赖矩阵（standards/documentation.md §4.2）。
- 本目录所有 md 受 doc-check 校验（frontmatter/索引/占位符）。
