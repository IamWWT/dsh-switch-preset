# 导入企业规范指令

> 场景：你有企业存量规范文档（Java 开发规范、数据库规范、前端规范、安全规范等），希望框架化后让 Agent 每次开发都遵守。

## 第一步：放文件

把原始文档（docx/pdf/html/txt/旧 md）放到：

```
standards/enterprise/_inbox/
```

> 敏感内容提醒：含凭证/内部地址的文档，先脱敏或只放规则条款（见 `standards/enterprise/README.md` §3）。

## 第二步：发指令（复制后发给 Agent）

```
导入 standards/enterprise/_inbox/ 里的企业规范：

1. 按 standards/enterprise/README.md §2 转化流程处理每一份：
   提取强制条款 → 按目录蓝图分类 → 改写为带 frontmatter 的 markdown
   （type: standard）→ 存入对应子目录 → 原始文件移入 _inbox/_source/
2. 保留全部强制条款语义，禁止删减弱化；原文模糊处标注"原文未明确"
3. 更新 standards/enterprise/README.md 目录清单 + docs/FILE_INDEX.md
4. 运行 scripts/doc-check.sh 确认全绿
5. 汇报：导入了几份、放在哪、哪些条款与框架规范冲突需我裁决
```

## 示例

```
导入 _inbox 里的《Java开发规范.docx》和《数据库设计规范.pdf》，
按企业规范流程处理，冲突条款列出来给我裁决。
```

## 之后

- Agent 每次 Phase 0 会读取企业规范清单并作为硬约束写入 PRD。
- 规范更新时：重新导入新版，Agent 重写并递增 version。
