---
sidebar_position: 2
title: 设计概览
description: ZTS 的核心设计目标与 GetFunction 模型。
---

# 设计概览

:::tip 谁该读本文
**选型者、新接入开发者、需要理解「为什么这样设计」的读者。** 日常 API 用法请直接看 [使用指南](/docs/guides/install/)；实现细节见 [规范文档](/docs/spec/00-OVERVIEW/)。
:::

ZTS 把 JavaScript 当作另一种 **Native**：类比 P/Invoke，用声明式 API 统一双向互操作；Il2Cpp 侧生成 **C++ stub**，**不是** 海量托管 Wrap。语义与 [ZLua](https://doc.zlua.cn) 对齐，引擎与语法面换成 **QuickJS / TypeScript·JavaScript**。

## P/Invoke 与 ZTS 对照

| C# 互操作 | 职责 | ZTS 对应 |
|-----------|------|-----------|
| **P/Invoke** | C# 调用 native 函数 | **`GetFunction<T>`** — C# 调用 JS（ES module 导出） |
| **MonoPInvokeCallback** | native 回调 C# | 委托 / 回调桥（见 [FUNCTION](/docs/spec/marshal/09-FUNCTION/)） |
| **MarshalAs** | 覆盖默认 Marshal | **`[TsMarshalAs]`** — C# ↔ JS Marshal 覆盖 |

```text
flowchart LR
    subgraph CSharp["C# 游戏代码"]
        GF["GetFunction → Invoke"]
        APP["业务类 public API"]
    end

    subgraph Bridge["自动生成桥接"]
        MonoB["Editor: C# MethodBridge Emit"]
        Il2B["Player: C++ 直桥"]
        DelB["Delegate 桥（C#→JS）"]
    end

    subgraph JS["QuickJS / ES module"]
        MOD["export function …"]
        CS["CSharp / csharp: 类型访问"]
    end

    GF --> DelB
    DelB --> MOD
    CS --> MonoB
    CS --> Il2B
    MonoB --> APP
    Il2B --> APP
```

## 核心原则

| 原则 | 说明 |
|------|------|
| **统一双向调用** | C#→JS：`TsAppDomain.GetFunction<T>`；JS→C#：`CSharp` 懒注册或 `import from "csharp:…"`，语法贴近 C# |
| **自动生成（JS→C#）** | Editor Emit / Il2Cpp Generate C++ stub；C#→JS 无 per-call codegen |
| **深度集成** | `TsAppDomain.Initialize` 一次完成 CLR + QuickJS（`JSRuntime` + 主 `JSContext`）+ `zts` 库；热更清空走 `Reset` |
| **C++ 直桥** | Player 字段 offset 直读、方法经 `methodPointer`，无海量 C# Wrap |
| **零 Wrapper 膨胀** | 相同签名共享桥接函数，而非每成员一个 Wrap |
| **strict miss** | 未注册成员 **`throw Error`**，不回退反射、不返回 `undefined` |

## 自动生成流水线（JS→C#）

```text
flowchart TB
    A[开发者编写 C# + JS/TS] --> B{Unity 构建阶段}
    B -->|Editor 程序集编译| C[首次 CSharp / csharp: 访问 EnsureBinding]
    C --> D[Expression Emit MethodBridge]
    B -->|Il2Cpp Player 构建| E[扫描类型绑定 + ReducedType]
    E --> F[生成 C++ MethodBridge / DelegateBridge 模板]
    F --> G[libil2cpp/zts 链接进 Player]
    D --> H[Mono 运行时: 反射 + Expression 编译缓存]
    G --> I[Il2Cpp 运行时: C++ 直调 QuickJS API]
```

| 阶段 | Mono (Editor) | Il2Cpp (Player) |
|------|---------------|-----------------|
| C#→JS | `GetFunction` + Delegate 桥 | 同左（native 路径） |
| JS→C# 成员 | 首次访问 `EnsureBinding` + Emit | EnsureBinding + C++ stub（Generate） |
| 开发者感知 | **无 C# Wrap** | **无 C# Wrap**；须 Generate stub |

## Host API 一瞥

```csharp
TsAppDomain.Initialize(moduleLoader);
var onTick = TsAppDomain.GetFunction<Action<float>>("game/logic", "onTick");
// onTick(deltaTime);
```

- `jsModule` 为 **ES module specifier**（canonical **不含** `.js` / `.ts`）
- `jsExportName` 为该模块的 **named export**
- 热路径请缓存 Delegate；`Reset` 生效后旧委托作废，须重新 `GetFunction`

JS 侧访问 C#：

```javascript
// 推荐：csharp: 虚拟模块
import { Demo } from "csharp:Assembly-CSharp";

// 权威低层：CSharp 根对象
const Demo2 = CSharp["Assembly-CSharp"].Demo;
```

实例方法使用 **点号调用** `obj.Method(args)`（**无** Lua `:` 语法）。

## 与 Puerts / 自管 QuickJS 的路径差异（摘要）

| 维度 | Puerts 常见路径 | 自管 QuickJS | ZTS |
|------|-----------------|--------------|-----|
| 类型暴露 | 生成 / 导出配置 | 手写绑定 | `CSharp` + `csharp:` + Exotic 三表 |
| C#→JS | 视方案（常见 DoString / 路径拼装） | 手写 | `GetFunction<T>` + `Invoke` |
| Player 性能 | 成熟路径因版本而异 | 自建 | C++ 直桥 + 签名复用 |
| 与 ZLua | 不同 | 无 | **同构语义** |

详见 [选型对比](/docs/compare/FEATURES/)、[Il2Cpp 实现](/docs/impl/IL2CPP/)。

## 何时读哪份文档

| 你的问题 | 推荐阅读 |
|----------|----------|
| 怎么从 C# 调 JS？ | [C# 调用 JS](/docs/guides/csharp-calling-js/) |
| JS 怎么访问 C# 类型？ | [JS 调用 C#](/docs/guides/js-calling-csharp/) |
| 参数怎么传递？ | [Marshal 模型概览](/docs/concepts/marshal-overview/) |
| Editor 与 Player 差别？ | [双运行时](/docs/concepts/dual-runtime/) |
| TypeScript 工程？ | [TypeScript 工作流](/docs/guides/typescript-workflow/) |
| 完整设计语义？ | [设计规范](/docs/spec/00-OVERVIEW/) |

## 相关文档

- [设计规范](/docs/spec/00-OVERVIEW/)
- [宿主 API](/docs/spec/01-HOST-API/)
- [双运行时架构](/docs/concepts/dual-runtime/)
- [Il2Cpp 架构](/docs/impl/IL2CPP/)
