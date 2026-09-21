# SESSION — 会话交接单（2026-09-17 首轮开发）

> 交接协议：新会话先读本文件 + `docs/04-progress/PROGRESS.md`（✅/🔄/⏭），向用户复述后动手。

## 上次进度（本会话完成）

0. **v0.3.0 强制切换（2026-09-18）**：应"已开始会话也要换模式"要求，`/switch-preset` 对已开始
   会话走 `ctx.agentPresets.recompose` 强制重装配 + 事件记录（不再只写默认）；10 组单测全绿；
   **已 link 装上 3082，待用户重启生效**（用户选稍后自行重启）。

1. **P0-P2**：需求澄清闭环（3 决策 + 选择器增强）→ request.md / PRD / spec(AC-1~11) / plan / tasks。
2. **P3-P4**：完整实现（`npm run check` 全绿 = 构建门禁 + 双端 typecheck + 3 组测试）：
   - Host：`/switch-preset`（commands）+ create/fork 切换（switch.ts 纯逻辑）+ settings 命名空间；
   - Client：设置卡 + 🔄 模式选择器（复用 remote.commands 通道）+ command/executed 自动跳转。
3. **临时实例验证（3084，项目内 test-home）**：安装成功 → 修复 cordis.patch 空数组缺陷 → `dump-config` 组合树含插件 → 实例稳定、Web UI 正常（DOM 检查无 JS 崩溃）。
4. **质量门禁**：doc-check + quality-gate 全绿。
5. **环境副作用与修复**：dsh-test-home 依赖重装失败 → 已用 lockfile `pnpm install --force` 恢复（关键插件 lib 校验 OK）；TS7 锁版、PNPM_HOME 绕行等 7 条踩坑固化进 TROUBLESHOOTING。

## 下一步（见 PROGRESS.md ⏭）

- **⚠️ 3082 安装暂缓**（2026-09-17 用户选择）：根挂载只读（`/` ro，`~/.dsh-dev` 物理不可写），`plugin add` EROFS。待 rootfs 恢复可写后：install:dev → 同意后重启 dev-web → 按 AC-1~11 交互验收。
- 预览渠道：临时实例 3084 保持运行（token 见会话日志），可先查看设置卡与选择器。

## 待确认事项

| # | 事项 | 影响 |
|---|------|------|
| 1 | 3082 安装：待 rootfs 恢复可写（用户处理/系统恢复） | 恢复后即可装；重启需用户同意 |
| 2 | 运行中 3082 的持久化写入风险（只读 home） | 已告知用户，其选择暂缓观察 |
| 3 | 测试 home（dsh-test-home）后续维护 | 已恢复；若再遇依赖问题走本插件 test-home |