---
title: TypeScript / Node.js 适配规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# TypeScript / Node.js 适配规范

## 技术基线（推荐）

| 项 | 推荐 | 说明 |
|----|------|------|
| 运行时 | Node 20 LTS+ | |
| 语言 | TypeScript strict | `noImplicitAny` 等全开 |
| 包管理 | pnpm 或 npm | package-lock/pnpm-lock 提交 |
| Web | Fastify 或 Express + zod 校验 | NestJS 适合大型项目 |
| 测试 | Vitest / Jest + supertest | |
| 格式/静态 | ESLint + Prettier（+ typescript-eslint） | CI 强制 |

## 命令

```bash
npm run lint              # eslint
npm run typecheck         # tsc --noEmit
npm test                  # vitest/jest
npm audit                 # 依赖漏洞
```

## 规则

1. 配置：`zod` 校验 env（如 `zod-env` 模式）；凭证零默认值；生产缺失 fail-fast。
2. 异步：全链路 `async/await` + `Promise.allSettled` 管理并发；所有 fetch 有 `AbortSignal.timeout`。
3. 错误处理：统一错误中间件；禁止空 catch；错误分类（校验/业务/内部）。
4. 类型：DTO 用 zod 定义并在边界校验；禁止 `any`（有例外写注释）。
5. 日志：pino 结构化 JSON 日志。
6. 依赖：锁文件提交；`npm audit` 进门禁。

## 安全速查

- 依赖漏洞：`npm audit`。
- 注入：SQL 参数化；`exec` 禁拼接；`child_process` 白名单。
- XSS：框架默认转义；`dangerouslySetInnerHTML` 慎用。
- 反序列化：JSON 严格校验（zod）；不用 `eval`/`new Function` 处理不可信输入。
