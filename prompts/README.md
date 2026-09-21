# 一句话指令模板（DSH）

> 用法：在 DSH 工程模式会话里直接发自然语言。三要素：**目标 + 技术偏好 + 关键约束**（没说的 Agent 会做假设并记入 `docs/00-request/request.md`）。
> 需求澄清默认由 Agent 用 grill-me 先拷问一轮；想跳过就说"不用问，直接做，按你的合理假设来"。

## 模板

| 模板 | 场景 | 示例（直接发这句） |
|------|------|------|
| [new-project.md](new-project.md) | 从零创建项目 | "帮我创建一个短链接服务：内部用，Go + Redis，读 QPS 峰值 5000，要支持管理后台" |
| [feature.md](feature.md) | 加功能 | "给订单服务加 CSV 导出：按时间范围、10 万行内同步导出，超过转异步任务" |
| [bugfix.md](bugfix.md) | 修 Bug | "登录接口偶发 500，日志在 docs/04-progress/，先定位根因再修，补并发回归测试" |
| [review.md](review.md) | 评审 | "按 standards/ 评审 auth 模块：安全/可靠性/文档一致性，出问题清单和修复建议，先别改代码" |
| [report.md](report.md) | 复盘/周报 | "写本周开发复盘：进展、踩坑（docs/06-experience 有记录）、下周计划，失败的也要写" |
| [import-standards.md](import-standards.md) | 导入企业规范 | "导入 standards/enterprise/_inbox/ 里的企业规范，冲突条款列出来给我裁决" |

## 自然语言控制（替代旧版 -- 控制词）

| 想表达 | 这么说 |
|--------|--------|
| 全自动 | "不用问直接做，按你的合理假设来，把假设记进 request.md" |
| 关键产物先确认 | "每步产物（PRD/架构/计划）先给我确认再继续" |
| 只做最小集 | "只做 P0 核心，先给我能跑的最小版本" |
| 免澄清 | "跳过需求澄清，直接按假设表开干" |

Agent 收到后：grill-me 澄清（可被自然语言免除）→ 写 request.md（含假设表）→ 按七阶段执行。