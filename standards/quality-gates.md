---
title: 质量门禁
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# 质量门禁

## 三层门禁

### L1 — 每次提交（Commit）

| 检查项 | 如何验证 |
|--------|---------|
| 格式/lint 通过 | 语言对应 lint 命令（见 languages/） |
| 受影响模块单测通过 | 测试命令 |
| 无硬编码密钥/IP/端口 | `rg -n "(password|secret|api[_-]?key)\s*[:=]\s*[\"'][^\"']+"` 抽查 + 代码审查 |
| 无调试残留（print/console.log/todo 泛滥） | 审查 |
| FILE_INDEX 已同步 | `scripts/doc-check.sh` |

### L2 — 每个功能/里程碑

| 检查项 | 如何验证 |
|--------|---------|
| 集成测试通过（真实依赖） | 集成测试命令 |
| 进度日志已写（含失败） | `docs/04-progress/` 最新日期存在 |
| 文档与实现一致 | 文档宣称的功能都能指到代码/测试 |
| 契约未被破坏 | 检查接口签名变更是否影响消费方 |
| 错误路径已处理 | 代码审查（超时/异常/空值） |

### L3 — 交付/发布前

| 检查项 | 如何验证 |
|--------|---------|
| 全量 build + test + doc-check 绿 | `scripts/quality-gate.sh` |
| 安全清单过完 | standards/security.md 每项勾选 |
| 可靠性清单过完 | standards/reliability.md 每项勾选 |
| 关键路径性能有基准或明确"未测" | 基准输出落 docs/05-testing/ |
| 可观测性接入 | 结构化日志 + 健康检查（大型服务加指标/追踪） |
| 交付总结含已知限制 | README 或交付说明 |

## Definition of Done（功能级）

一个功能"完成"必须同时满足：

1. 验收标准（PRD 中写的）有测试覆盖并通过；
2. 失败路径有测试（错误输入、超时、异常）；
3. 文档同步（FILE_INDEX/MEMORY/进度）；
4. 没有留下 TODO 冒充完成（TODO 必须注明责任人+日期，或移除）；
5. 宣称的能力与代码一致。
