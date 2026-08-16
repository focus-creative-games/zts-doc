---
sidebar_position: 20
title: 少 GC Marshal
description: OpaqueValue、ByVal、UnpackedValues、string Object 等少分配 Marshal 套路。
---

# 少 GC Marshal

本篇只谈 **少分配 / 零额外托管分配** 的常用 Marshal 手段。默认规则见 [Marshal 总览](/docs/spec/marshal/01-OVERVIEW/)；特性语法见 [TsMarshalAs](/docs/guides/ts-marshal-as/)。权威：[04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)、[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)、[05-STRUCT](/docs/spec/marshal/05-STRUCT/)。

> 「少 GC / 0GC」指热路径上 **尽量不** 为这次互调新建 JS plain object / JS string / ByVal exotic / 装箱对象。并非整个程序永不 GC。

## 1. OpaqueValue：引用类型与 struct

**OpaqueValue** 是临时句柄（无成员分派），Push 时不建完整 ByObj/ByVal exotic。

| 场景 | 行为 |
|------|------|
| `ref` / `out` / `in T`（任意 T） | C#→JS **默认** Opaque，无需标注 |
| by-val 任意 CLR 类型 | 可显式 `[TsMarshalAs(OpaqueValue)]`（**仅 C#→JS**） |

```csharp
public void Touch(ref Transform t) { }           // 默认 Opaque
public void Peek([TsMarshalAs(TsMarshalType.OpaqueValue)] MyClass obj) { }
public void PeekStruct([TsMarshalAs(TsMarshalType.OpaqueValue)] Vector3 v) { }
```

```javascript
// 在同一次 C#→JS 同步调用链内
const v = zts.get_opaquevalue(slot);
zts.set_opaquevalue(slot, newValue);
// 需要 ByVal 门面时：zts.to_user_data(slot)（会产生 ByVal exotic，见规范）
```

要点：

- **引用类型**与 **struct** 都可走 Opaque，避免为本帧临时对象建完整 exotic
- **不可**把 Opaque 存进跨帧 / 跨异步的长期表
- JS→C# 单独形参上标 `OpaqueValue` **非法**；写回规则见 [ref/out/in](/docs/guides/ref-out-in/)
- 失效后 → `throw Error('zts: invalid opaque parameter handle')`

## 2. ByVal：struct 默认与真 ref

| 路径 | 说明 |
|------|------|
| 默认 by-val | 长生命周期常用 **ByVal exotic**（`new Type(...)`） |
| `ref`/`out`/`in` + 同型 ByVal | **真 ref**，可写回 payload，无需 Opaque API |
| `zts.to_user_data` | Opaque → **拷贝** ByVal（与原 handle 独立） |

热路径若只需读字段一次，优先 Opaque；需要成员分派或长期持有再 ByVal。

## 3. UnpackedValues：struct 多槽展开

对 **普通 struct / 闭合泛型 struct**，用多连续实参 ↔ `Members`，**不**创建 plain object，也 **不**创建 ByVal exotic：

```csharp
public void ApplyForce(
    [TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
    Vector3 force) { }
```

```javascript
rb.ApplyForce(0, 9.8, 0);   // 三槽；JS 侧只有 number
```

| 适用 | 不适用 |
|------|--------|
| `struct` / closed generic struct | **`Nullable<T>`**（规范禁止；无法用多槽表达「无值」） |
| 热路径 `Vector2` / `Vector3` / 自定义 blittable 小结构 | class / interface |

`Nullable<struct>` 需要「可空」语义时用 **`Table`**（`null`↔无值），但 object 本身有 JS 分配，**不算**本节意义下的 0GC；C#→JS 临时可空值也可考虑 **Opaque**。

## 4. Object：巨大 `string` 走 ByObj

默认：`string` ↔ JS **string**（按内容拷贝）。对超大文本，拷贝成本高：

```csharp
public void ProcessHuge(
    [TsMarshalAs(TsMarshalType.Object)] string payload) { }
```

标注后强制 **ByObj exotic**（托管 `System.String`），**不再**生成对应内容的 JS string。

:::warning
ByObj exotic **仍会**在 JS 侧分配 exotic，参与 GC。只是避免「再复制一整份 JS string」。日常短字符串继续用默认即可。
:::

对 `byte[]` 若要 octet 语义，用 `Bytes`（↔ JS string），与本节目标不同。

## 对照速记

| 手段 | 典型目标 | JS 侧额外分配 |
|------|----------|----------------|
| **OpaqueValue** | C#→JS 的 class / struct / byref | 无完整 exotic / plain object |
| **ByVal exotic** | 可长期持有的 struct、真 ref 写回 | 有 ByVal exotic |
| **UnpackedValues** | JS↔C# 的 struct 字段展开 | 无（只用栈上 number 等） |
| **Table** | struct / `Nullable<struct>` 键值 | **有** plain object |
| **Object** on `string` | 巨大 string 避免 JS string 拷贝 | **有** ByObj exotic |

引用类型默认走 Registry（ByObj）；struct 默认 ByVal / 同步链 Opaque；热点再叠加上述策略。定性说明见 [Marshal 概念](/docs/concepts/marshal-overview/)。

## 相关文档

- [TsMarshalAs](/docs/guides/ts-marshal-as/)
- [值类型](/docs/guides/value-types/)
- [ref / out / in](/docs/guides/ref-out-in/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/) · [04-OPAQUE](/docs/spec/marshal/04-OPAQUE/)
- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)
