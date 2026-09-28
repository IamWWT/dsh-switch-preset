/**
 * shared/threshold.ts — 路由阈值的**唯一常量定义**（v0.5.1）
 *
 * 为什么单独一个文件：阈值默认值同时被
 *   - `shared/router-settings.ts`（schema default、归一化回落、边界常量）；
 *   - `host/route.ts`（决策默认值，并以 `DEFAULT_ROUTE_THRESHOLD` 名义再导出给命令层与单测）
 * 消费。放在 `route.ts` 会让 `router-settings.ts` ↔ `route.ts` 形成 import 环，
 * 故把常量下沉到本文件（零依赖），两处都从这里取——**默认值仍然只有一份**。
 */

/** 默认阈值（用户 2026-09-28 选定 0.6）：低于它只提示、不切换。 */
export const DEFAULT_ROUTE_THRESHOLD = 0.6
