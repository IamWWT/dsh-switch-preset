# 新项目指令

## 完整版（复制后替换 `{{...}}` 发给 DSH 工程模式会话）

```
帮我创建一个 {{项目名}} 项目：

1. 目标：{{一句话说清产品目标，如"内部使用的短链接服务，支持创建/跳转/统计"}}
2. 技术偏好：{{语言/框架，如 Go + PostgreSQL + Redis；不知道就写"你来选，兼顾性能和运维成本"}}
3. 关键约束：{{性能/部署/安全/合规，如"读 QPS 峰值 5000，P99 < 50ms，K8s 部署"；没有就删这行}}
4. 范围：{{必须有的功能；可省略的可选功能}}
```

类型说明：普通项目不用说类型；要开发 **DSH 插件**就写明"这是一个 DSH 插件"
（Agent 用 `init-project.sh --kind dsh-plugin` 生成插件骨架：dsh.json/dsh.host.json、
tsconfig 双配置、build 产物门禁、PLUGIN-DEV-STANDARD 的 SDD 文档骨架）。

## 更短的一句话（Agent 会先 grill-me 拷问再动手）

```
用 Rust 写一个高性能 WebSocket 网关，支持百万连接
```
"不用问直接做"也可以：
```
用 Python 写一个定时任务调度器，支持 cron 表达式、失败重试、Web 管理界面，不用问直接做
```

## Agent 收到后的行为（你应该看到的流程）

1. grill-me 拷问目标/范围/边界/优先级（除非你明说免问）。
2. 创建 `docs/00-request/request.md`：原话 + 提炼 + 假设表。
3. PRD（`docs/01-requirements/prd.md`），P0/P1/P2 分级。
4. 技术选型 + 显著决策 ADR（`docs/02-design/`）。
5. 任务计划（`docs/03-plan/tasks.md`），里程碑 M0-M3。
6. `scripts/init-project.sh` 生成骨架，空壳先跑通 build + test。
7. 分批实现，每批带测试、文档、经验记录。
8. 质量门禁全绿（`scripts/quality-gate.sh`）→ 交付（README + 运行手册 + 测试报告 + 经验沉淀 + 已知限制）。

> 只发一句话没有细节也走完整流程，差别只是假设表更长；不满意假设随时纠正，Agent 更新 request.md 继续。