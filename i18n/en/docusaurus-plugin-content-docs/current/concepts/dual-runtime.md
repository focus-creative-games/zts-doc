---
sidebar_position: 3
title: 双运行时
description: Mono Editor 与 Il2Cpp Player 的实现分工。
---

# 双运行时

:::tip 谁该读本文
**需要理解「为何 Editor 与 Player 实现不同、但脚本行为一致」的开发者。** 日常开发流程见 [Editor 与 Player](/docs/guides/editor-vs-player/)；构建见 [构建指南](/docs/guides/build/)。
:::

ZenTS 维护 **一份** JS 可见语义契约（`spec/**`），两套实现：

| 环境 | 程序集 / 实现 | 桥接方式 |
|------|---------------|----------|
| **Unity Editor** | `ZenTS.Mono` | Expression Tree / Emit + Exotic 分派 |
| **Il2Cpp Player** | `ZenTS.Il2Cpp` + `libil2cpp/zents`（包内 `ZenTS~/zents-runtime`） | C++ MethodBridge + ReducedType stub |

公共门面与特性在 `ZenTS.Common`：`JsAppDomain`、`[JsMarshalAs]`、`[JsAlias]`、`[JsExtension]` 等。

```text
flowchart LR
  subgraph Editor["Unity Editor"]
    Mono["ZenTS.Mono"]
    Emit["Expression Emit"]
  end

  subgraph Player["Il2Cpp Player"]
    Native["C++ MethodBridge"]
    Stub["generated stubs"]
  end

  QJS["QuickJS"] --> Mono
  QJS --> Native
  Mono --> Emit
  Native --> Stub
```

## 权威与日常分工

| 角色 | 说明 |
|------|------|
| **Player（Il2Cpp）** | 发版与性能权威：内嵌 QuickJS、C++ 直桥、签名 stub 复用（需 Generate） |
| **Editor（Mono）** | 快速迭代：反射 + Emit；目录与语义对齐 Il2Cpp |

**契约：** Mono 允许更慢的实现路径，但脚本可观察行为（调用结果、异常、Marshal、miss）**必须与 Il2Cpp 一致**。

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

## Il2Cpp 源码落点

| 路径 | 内容 |
|------|------|
| `libil2cpp/quickjs` | QuickJS 引擎源码（Install 叠加） |
| `libil2cpp/zents` | ZenTS native（来自包内 `ZenTS~/zents-runtime`） |

开发期可编辑参考常见于：`build-win64/.../libil2cpp/zents`。

## 开发者需要记住的事

1. **日常在 Editor 写脚本与调试**；发版前走 Il2Cpp Generate + Player 验证。
2. **`GetFunction` / `CSharp` / `csharp:` / Marshal 规则两边相同**——不要为「Editor 能跑」写依赖反射 quirk 的脚本。
3. **`Reset` 在 EndOfFrame 真正拆域**；旧 Delegate 在 Reset 后作废（见 [01-HOST-API](/docs/spec/01-HOST-API/)）。
4. TypeScript 只影响编辑期；运行时 **只** 加载 emit 后的 ES module。

:::info 状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 已完成</span><span class="runtimeBadgeIl2cpp">Il2Cpp · 已完成</span></span>

日常在 Editor 开发；发版与性能以 Il2Cpp Player 为准。详见 [项目状态](/docs/getting-started/project-status/)。
:::

## 学习路径

| 步骤 | 文档 |
|------|------|
| 1. 理解语义契约 | [规范总览](/docs/spec/00-OVERVIEW/) |
| 2. 日常 Editor↔Player 差异 | [Editor 与 Player](/docs/guides/editor-vs-player/) |
| 3. 实现细节（可选） | [Mono 实现](/docs/impl/MONO/) · [Il2Cpp 实现](/docs/impl/IL2CPP/) |
| 4. 构建与 Install | [构建](/docs/guides/build/) · [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/) |

## 相关文档

- [规范总览](/docs/spec/00-OVERVIEW/)
- [Il2Cpp 实现](/docs/impl/IL2CPP/)
- [Mono 实现](/docs/impl/MONO/)
- [Editor 与 Player](/docs/guides/editor-vs-player/)
- [实现总览](/docs/impl/overview/)
