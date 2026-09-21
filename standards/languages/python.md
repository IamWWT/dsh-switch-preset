---
title: Python 适配规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# Python 适配规范

## 技术基线（推荐）

| 项 | 推荐 | 说明 |
|----|------|------|
| 解释器 | Python 3.11+ | 3.12/3.13 视依赖生态 |
| 依赖管理 | uv 或 poetry | 锁文件必须提交（uv.lock/poetry.lock） |
| Web | FastAPI | 自动 OpenAPI；或 Django/Flask 按项目 |
| 测试 | pytest + coverage | 集成用 testcontainers-python |
| 格式/静态 | ruff（format+lint） + mypy（类型） | CI 强制 |
| 数据访问 | SQLAlchemy 2.x + Alembic 迁移 | 参数绑定天然 |

## 命令

```bash
uv sync                               # 安装依赖
uv run pytest -q                      # 测试
uv run ruff check . && uv run ruff format --check .   # lint+format
uv run mypy src                       # 类型检查
```

## 规则

1. 配置用 pydantic-settings 从 env 加载；禁止 `os.environ.get("X", "硬编码默认值")` 泄露凭证。
2. 类型标注：公共接口必须有类型；mypy 尽量严格。
3. 异步：FastAPI 用 async/await；阻塞调用放线程池；所有 IO 有超时（httpx timeout）。
4. 异常：捕获具体异常；`except Exception` 必须处理/记录。
5. 日志：logging + JSON formatter；禁止 print 进生产。
6. 依赖锁定：新依赖加锁后提交锁文件；`pip-audit` 扫描（可选）。

## 安全速查

- `pip-audit` 检查依赖漏洞。
- 输入：pydantic 校验；禁止 eval/exec 用户输入。
- 反序列化：不用 pickle 处理不可信数据。
- SQL：SQLAlchemy 参数化；禁止 f-string 拼 SQL。
