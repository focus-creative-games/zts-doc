---
sidebar_position: 0
title: 实现索引
description: Architecture 侧栏入口。
---

# 实现索引

本侧栏描述 **Mono / Il2Cpp 如何落地**，方便对照源码与排查性能。**不改变** JavaScript 可见语义。

:::caution 语义权威在 spec
冲突裁决：**`spec/**` > Il2Cpp 源码 > `impl/**`**。若实现笔记与规范不一致，以 [规范文档](/docs/spec/00-OVERVIEW/) 为准；请修实现或更新本页，勿在业务里依赖未写入规范的行为。
:::

## 架构地图

```text
                    JsAppDomain.Initialize(moduleLoader)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ZenTS.Mono (Editor)               ZenTS.Il2Cpp (Player)
            JsMonoAppDomain                 JsIl2CppAppDomain
                    │                               │
        三表 exotic 分派 / Emit 桥          libil2cpp/zents (C++)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                         同一 JS 可见语义 (spec/**)
```

| 层 | Mono | Il2Cpp |
|----|------|--------|
| 程序集 | `ZenTS.Mono` | `ZenTS.Il2Cpp`（薄 InternalCall 壳） |
| 共享门面 | `ZenTS.Common`：`JsAppDomain`、特性 | 同左 |
| JS→C# 桥 | EnsureBinding + Expression Emit | Generate stub + ReducedType 复用 |
| C#→JS | `GetFunction` + Delegate 桥 | 同左（native 路径） |
| JS 引擎 | QuickJS（Editor：Plugins DLL） | QuickJS 静态编进 Player |

包内 native 树：`Packages/com.code-philosophy.zen-ts/ZenTS~/zents-runtime` → Install 后为 `libil2cpp/zents`。布局见 [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)。

## 本区文档

| 文档 | 内容 |
|------|------|
| [Mono](/docs/impl/MONO/) | Editor：Emit MethodBridge、EnsureBinding、模块职责 |
| [Il2Cpp](/docs/impl/IL2CPP/) | Player：`zents-runtime`、Generate stubs、ReducedType、初始化顺序 |

概念层对照：[双运行时](/docs/concepts/dual-runtime/) · [设计概览](/docs/concepts/design-overview/)。日常流程：[Editor 与 Player](/docs/guides/editor-vs-player/) · [构建](/docs/guides/build/)。
