---
sidebar_position: 5
title: Marshal 概览
description: "C# 与 JavaScript 之间的默认参数 Marshal 规则。"
---

# Marshal 概览

:::tip 谁该读本文
**需要理解参数如何在 C# 与 JS 间转换、何时用 `[JsMarshalAs]` / Opaque 的开发者。** `ref/out` 实操见 [指南](/docs/guides/ref-out-in/)；属性覆盖见 [JsMarshalAs](/docs/guides/js-marshal-as/)。
:::

ZenTS 在 Mono 与 Il2Cpp 上 **JS 可见 Marshal 语义一致**；Il2Cpp 侧重零 GC 与生成代码快速路径。设计与 ZLua Marshal 同构，语法面换成 JS（`null` / `undefined` 有明确边界）。

## 双向调用路径

```text
flowchart TB
    subgraph C2J["C# → JS（GetFunction / delegate bridge）"]
        C1[C# 参数] --> P1[Push 规则]
        P1 --> J1[JS 实参]
        J2[JS 返回值] --> Pop1[Pop 规则]
        Pop1 --> C2[C# 返回值]
    end

    subgraph J2C["JS → C#（MethodBridge）"]
        J3[JS 实参] --> Pop2[Pop 规则]
        Pop2 --> C3[C# 形参]
        C4[C# 返回值] --> P2[Push 规则]
        P2 --> J4[JS 返回值]
    end

    MA["[JsMarshalAs]"] -.->|覆盖| P1
    MA -.-> Pop2
```

## 默认规则摘要

| 类别 | C# → JS | JS → C# |
|------|---------|---------|
| 基元 / enum | `number` / `boolean` | 同左（v1 **禁止** bigint 作 CLR 整数） |
| string | `string` | `string` |
| class | 实例 exotic（ByObj） | exotic / `null` |
| struct | ByVal exotic 或 OpaqueValue | Struct exotic / `new Type(...)`（默认不接受普通 object 字面量） |
| delegate | Delegate exotic | **function**（callable）或 userdata 形态 |
| array | Array exotic | Array exotic |

完整矩阵：[Marshal 规范总览](/docs/spec/marshal/01-OVERVIEW/)。

## undefined 与 null（必读）

QuickJS 同时存在 `undefined` 与 `null`。**禁止**在规范层把二者无差别等同为「空」。

| JS 值 | 典型语义 |
|-------|----------|
| **`undefined`** | 形参缺失、可选未传；**CLR 绑定 miss 除外**（miss 须 throw） |
| **`null`** | CLR **引用类型 null**、`Nullable<T>` 无值 |
| 值类型零值 | `0` / `false` 等，**不是** `undefined`/`null` |

| JS → C# 场景 | 行为 |
|--------------|------|
| 必选引用形参传 `undefined` | **`throw Error('zents: argument missing: …')`** — 须显式 `null` |
| `Nullable<T>` 收 `undefined` | 视为无值 |
| 读 C# 成员 miss | **`throw Error('zents: member not found: …')`** — **不是** `undefined` |

## ref / out / in（JS → C#）

JS 侧 **不区分** ref/out/in 关键字，统一按 byref 槽语义处理：

| JS 实参 | 行为 |
|---------|------|
| 同型 ByVal exotic（如 `new Point2D(...)`）/ 兼容 Opaque | **真 ref**，C# 修改写回 |
| 裸 `number` / `string` / 普通 object | **拷贝**到临时槽，**不写回** local |

**GetFunction 取得的 delegate 调用**与 **delegate bridge** 上 `ref`/`out`/`in` 默认 Push **OpaqueValue**（见 [OPAQUE](/docs/spec/marshal/04-OPAQUE/)）；`params` 规则见 MarshalAs 分册。

→ [ref / out / in 指南](/docs/guides/ref-out-in/)

## `[JsMarshalAs]` 覆盖

| JsMarshalType（概念） | 典型用途 |
|----------------------|----------|
| **UserData / 强制 boxed** | 基元、enum、string 走对象形态 |
| **Bytes** | `byte[]` ↔ JS 字符串 / 字节视图（以实现为准） |
| **OpaqueLightUserData** | C#→JS 栈上 struct 临时句柄 |

合法组合与作用位置见 [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/) · [JsMarshalAs 指南](/docs/guides/js-marshal-as/)。

## 少 GC 策略（心智）

| 策略 | 何时想到它 |
|------|------------|
| 默认 Registry / ByVal | 热路径少分配 |
| Opaque | 同步调用链内临时 struct 句柄 |
| 避免无意义装箱 | 不要为「方便」强制 UserData 基元 |

→ [少 GC Marshal](/docs/guides/zero-gc-marshal/) · [生命周期](/docs/spec/10-LIFETIME/)

## 分册索引（何时读哪本）

| 类型 | 规范 |
|------|------|
| 总览与默认表 | [Marshal 规范](/docs/spec/marshal/01-OVERVIEW/) |
| byref / Opaque | [BYREF](/docs/spec/marshal/03-BYREF/)、[OPAQUE](/docs/spec/marshal/04-OPAQUE/) |
| struct | [STRUCT](/docs/spec/marshal/05-STRUCT/) |
| class / 引用 | [CLASS](/docs/spec/marshal/06-CLASS/) |
| 数组 | [ARRAY](/docs/spec/marshal/07-ARRAY/) |
| enum | [ENUM](/docs/spec/marshal/08-ENUM/) |
| Delegate / 回调 | [FUNCTION](/docs/spec/marshal/09-FUNCTION/) |
| 指针 | [POINTER](/docs/spec/marshal/10-POINTER/) |
| 分类入口 | [marshal 索引](/docs/spec/marshal/) |

## 相关文档

- [Marshal 规范索引](/docs/spec/marshal/)
- [值类型指南](/docs/guides/value-types/)
- [委托与函数](/docs/guides/functions/)
- [属性参考](/docs/reference/attributes/)
