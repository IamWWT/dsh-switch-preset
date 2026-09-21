---
title: Java 适配规范
type: standard
status: active
version: 1.0.0
date: 2026-08-02
owner: AI + 维护人
applies_to: 项目文档
---

# Java 适配规范

## 技术基线（推荐）

| 项 | 推荐 | 说明 |
|----|------|------|
| JDK | 21 LTS（或 17 LTS） | 用 LTS；record/pattern matching 可用 |
| 构建 | Maven 或 Gradle | 多模块用 Maven BOM 管理 |
| Web | Spring Boot 3.x | 或 Quarkus/Micronaut，按项目 |
| 测试 | JUnit 5 + Mockito（单元）/ Testcontainers（集成） | |
| 格式 | google-java-format / spotless | CI 强制 |
| 静态检查 | Checkstyle + SpotBugs（可选 PMD） | 进 CI |

## 命令

```bash
mvn clean compile -q                    # 编译
mvn test -pl <module> -q                # 单测
mvn verify                              # 全量（含集成）
mvn spotless:check                      # 格式
```

## 规则

1. 参数外部化：`@ConfigurationProperties` 聚合配置类；禁止散落 `@Value` 和字面量。
2. 凭证默认值为空字符串；生产校验为空则 fail-fast。
3. 领域模型保持纯 POJO（零框架依赖），契约与实现分离。
4. 日志用 SLF4J，禁止 `System.out`；参数化日志（`log.info("x={}", v)`）。
5. 并发：`Executors` 显式命名线程；禁止裸 `new Thread`。
6. 异常：`throws` 具体化；禁止 `catch (Exception)` 吞掉后无处理。
7. SQL：MyBatis/JPA 参数绑定；禁止字符串拼接。
8. 依赖管理：父 POM 统一版本（dependencyManagement）；锁定插件版本。

## 安全速查

- 依赖漏洞：OWASP dependency-check 或 GitHub Dependabot。
- 反序列化：检查 ObjectMapper 类型白名单。
- 常量时间比较：`MessageDigest.isEqual`。
