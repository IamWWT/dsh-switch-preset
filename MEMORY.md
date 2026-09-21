# MEMORY.md — 项目记忆

> 当前状态 / 待办 / 硬约束。每次会话结束前更新。
> 协议 → AGENTS.md | 索引 → docs/FILE_INDEX.md | 进度真源 → docs/04-progress/PROGRESS.md

## 0. 新会话必读

1. README.md
2. AGENTS.md（全文）
3. 本文件
4. docs/04-progress/PROGRESS.md（先读 ✅/🔄/⏭ 三小节并汇报）
5. docs/FILE_INDEX.md
6. docs/00-request/request.md（目标锚定）

## 1. 当前状态

| 项目 | 状态 |
|------|------|
| dsh-switch-preset v0.1.0 | 实现完成（T1-T4b 全绿）；临时实例 3084 验证到「组合层含插件 + 稳定运行 + UI 正常」；**交互验收与上 3082 待用户确认**（见 PROGRESS.md ⏭） |

## 2. 待办

| # | 事项 | 优先级 |
|---|------|:---:|
| 1 | 3082 安装（**被根挂载只读阻断，用户选择暂缓**）：rootfs 恢复可写后 install:dev + 同意后重启 + AC 验收 | P0（待环境） |
| 2 | 验收通过后 `npm pack`（升版本号）产出稳定版 tgz | P1 |
| 3 | 临时实例 3084 与 test-home 清理（用户确认后） | P2 |
| 4 | 工作区根 progress.md 登记插件进度链接 | P2 |

## 3. 硬约束

- 文档与实现一致；未实现必须标注
- 源码禁硬编码凭证；凭证默认值为空
- 文件变更后更新 FILE_INDEX
- 破坏性操作先确认；重启 3082 前必须征得用户同意
- 测试证据来自真实命令输出
- **环境事实（2026-09-17）**：根挂载 `/` 为只读（fstab `errors=remount-ro`）→ `~/.dsh-dev` 与 pnpm store 均不可写（3082 安装受阻、运行中 3082 持久化写入有失败风险）；可写区=工作区；npm 需 `--cache <项目内>`；pnpm 用 `PNPM_HOME=<可写目录>` 绕行；视觉工具链 sharp 缺 detect-libc 不可用（UI 验证用 Chrome `--dump-dom`）；测试优先用本插件 `test-home/`（dsh-test-home 曾有依赖冲突，已恢复）
- **DSH 集成事实**：cordis.patch.yml 必须有 `- insert:` 实例化行（空数组不加载，见 TROUBLESHOOTING §6）

*最后更新: 2026-09-17*
