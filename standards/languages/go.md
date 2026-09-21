---
title: Go 适配规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# Go 适配规范

## 技术基线（推荐）

| 项 | 推荐 | 说明 |
|----|------|------|
| 版本 | Go 1.22+ | go.mod + go.sum 提交 |
| Web | net/http 标准库或 gin/chi | 小服务优先标准库 |
| 测试 | testing + testify（可选） | |
| 格式/静态 | gofmt + go vet + golangci-lint | CI 强制 |
| 迁移 | golang-migrate 或 goose | SQL 迁移入版本库 |

## 命令

```bash
go build ./...                  # 构建
go test ./...                   # 测试
gofmt -l .                      # 格式检查（输出空 = 通过）
go vet ./...                    # 静态检查
golangci-lint run               # 综合 lint（可选）
```

## 规则

1. 错误处理：`if err != nil` 显式处理；包装错误加上下文（`fmt.Errorf("...: %w", err)`）。
2. 配置：环境变量 + 配置结构体；`os.Getenv` 空值校验；凭证零默认值。
3. 并发：goroutine 生命周期可追踪；channel 关闭纪律；禁止无声 goroutine 泄漏；`errgroup` 管理并发任务。
4. 超时：所有 HTTP client 设 `http.Client{Timeout}`；context 贯穿。
5. 日志：`log/slog` 结构化日志。
6. 空接口：`any` 只用于边界；核心逻辑用具体类型。

## 安全速查

- 依赖漏洞：`govulncheck`（官方）。
- 输入：`encoding/json` 解码后校验；`html/template`（非 text/template）防 XSS。
- SQL：`database/sql` 参数化；禁止字符串拼接。
