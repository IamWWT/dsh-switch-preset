---
title: 07-ops — 运行手册
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# 07-ops — 运行手册

## 用途

部署、运行、运维、排障的实操文档。交付前必须能让"没参与开发的人"照着手册跑起来。

## 建议文件

| 文件 | 内容 |
|------|------|
| `runbook.md` | 环境要求、配置、启动/停止、健康检查、备份恢复、升级步骤 |
| `troubleshooting.md` | 常见故障现象 → 排查步骤 → 修复（FAQ 形式） |
| `release-<版本>.md` | 发布说明（只列已实现功能）+ 回滚方案 |

## runbook 模板

```markdown
# <项目> 运行手册

## 环境要求
（OS/运行时/依赖版本/端口）

## 配置
（.env.example 复制为 .env；每个变量含义与默认值）

## 启动 / 停止
```bash
（命令）
```

## 健康检查
```bash
curl http://localhost:8080/health
```

## 排障
| 现象 | 检查 | 修复 |
------|------|------|
| ... | ... | ... |

## 回滚
（版本回退步骤）
```
