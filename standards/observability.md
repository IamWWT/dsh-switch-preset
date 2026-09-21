---
title: 可观测性规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# 可观测性规范

> 三支柱：**日志（Logs）、指标（Metrics）、追踪（Traces）**。规模小可只做日志+健康检查，但结构要留好。

## 1. 日志

| 规则 | 说明 |
|------|------|
| 结构化日志 | JSON 或 key=value；机器可解析 |
| 关联 ID | 每个请求/任务一个 trace/correlation ID，跨调用透传 |
| 级别语义 | DEBUG 调试 / INFO 业务事件 / WARN 异常但不影响流程 / ERROR 失败 |
| 禁止敏感信息 | 凭证/PII 一律不进日志 |
| 禁止吞异常日志 | 异常必须记录堆栈或上下文 |

## 2. 指标（Metrics）

| 规则 | 说明 |
|------|------|
| 核心指标 | RED（Rate/Errors/Duration）或 USE（Utilization/Saturation/Errors）|
| 业务指标 | 关键业务事件计数（订单量/错误率/队列积压） |
| 标准库接入 | Prometheus 等标准协议；命名有前缀与单位 |
| 标签克制 | 标签基数有限（禁止用户 ID 等无限基数标签） |

## 3. 追踪（Traces）

| 规则 | 说明 |
|------|------|
| 关键链路透传 | 跨服务/跨 Agent 调用携带 W3C traceparent |
| 采样策略 | 高流量系统按需采样，控制成本 |
| 耗时标注 | 外部调用、DB 查询、LLM 调用等标注 span 耗时 |

## 4. 健康与审计

| 规则 | 说明 |
|------|------|
| 健康检查端点 | `/health`（存活）+ `/ready`（就绪，含依赖状态） |
| 审计日志 | 关键操作记录 who/what/when/result（见 security.md） |
| 启动信息 | 启动日志含版本、关键配置名（不打印值） |

## 5. 验证清单

- [ ] 日志结构化且含关联 ID
- [ ] 异常路径有 ERROR 日志
- [ ] 健康检查端点存在且反映依赖状态
- [ ] （大型服务）指标 + 追踪接入
- [ ] 日志无明文凭证
