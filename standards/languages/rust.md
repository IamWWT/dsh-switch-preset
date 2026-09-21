---
title: Rust 适配规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# Rust 适配规范

## 技术基线（推荐）

| 项 | 推荐 | 说明 |
|----|------|------|
| 工具链 | stable Rust，edition 2021+ | rustup 管理 |
| 构建 | cargo | Cargo.lock 必须提交（二进制项目） |
| Web | axum（或 actix-web） | |
| 测试 | cargo test（内置）+ proptest（属性测试） | |
| 格式/静态 | rustfmt + clippy（`-D warnings`） | CI 强制 |

## 命令

```bash
cargo check                       # 快速检查
cargo test                        # 测试
cargo clippy -- -D warnings       # lint
cargo fmt --check                 # 格式
cargo audit                       # 依赖漏洞（可选安装）
```

## 规则

1. 错误处理：自定义错误枚举 + `thiserror`；禁止裸 `unwrap()`/`expect()` 在库代码（启动参数可用 expect 并注释）。
2. 配置：`config`/`serde` 从 env 加载；凭证零默认值。
3. 异步：tokio；所有外部 IO 加超时（`tokio::time::timeout`）。
4. 并发：优先 `Arc<Mutex>` 最小作用域或 channel；状态机用 enum 保证合法状态。
5. 日志：`tracing` 结构化日志。
6. unsafe：默认禁止；必须用时单独文件 + 注释证明安全。

## 安全速查

- 依赖漏洞：`cargo audit`。
- 不安全的反序列化：serde 严格类型；避免任意反序列化。
- 内存安全：保持 safe Rust 习惯，unsafe 最小化。
