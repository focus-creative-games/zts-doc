---
sidebar_position: 11
title: ref / out / in
description: byref 参数的默认 Opaque 行为与写回规则。
---

# ref / out / in

权威：[BYREF](/docs/spec/marshal/03-BYREF/)、[OPAQUE](/docs/spec/marshal/04-OPAQUE/)。特性级强制形态见 [TsMarshalAs](/docs/guides/ts-marshal-as/)；少分配套路见 [少 GC Marshal](/docs/guides/zero-gc-marshal/)。

## 双路径摘要

| 方向 | 行为 |
|------|------|
| **C# → JS**（`GetFunction` / delegate 桥） | `ref` / `out` / `in` 默认 Push **OpaqueValue** |
| **JS → C#** | **不**按 `ref`/`out`/`in` 关键字区分 Pop；**能否写回**看实参形态 |

## 写回规则（直觉）

| JS 实参形态 | 写回 C# byref |
|------------|---------------|
| OpaqueValue（`get`/`set_opaquevalue`） | ✅ |
| 同型 ByVal exotic（如 struct） | ✅（真 ref 语义） |
| 裸 `number` / `string` / 多数 ByObj | ❌（拷入临时槽） |

```javascript
let x = 5;
Demo.Increment(x);          // 若形参为 ref int：裸 number 不写回，x 仍为 5

const p = new Point2D(1, 2);
Demo.Offset(p);             // ref Point2D：字段可写回 p
```

类型不兼容 → `throw Error('zts: …')`。必选 byref 传 `undefined`（临时槽路径）通常 **throw**；需观察写回时传 ByVal exotic 或有效 Opaque。

## Opaque 读写

C#→JS 拿到的 byref 槽位通常是 Opaque：

```javascript
// 在同一次同步调用链内
const v = zts.get_opaquevalue(slot);
zts.set_opaquevalue(slot, newValue);
```

对 `ref Point2D` 等值类型形参，传入同型 **ByVal exotic**（如 `new Point2D(1, 2)`）即可写回；无需额外 API。详见 [值类型](/docs/guides/value-types/)、[zts 标准库](/docs/guides/zts-lib/)。

:::warning
Opaque **不可**跨异步边界 / 跨帧持久化当长期句柄用。需要 ByVal 门面时用 `zts.to_user_data`（见规范）。失效后访问 → `throw Error('zts: invalid opaque parameter handle')`。
:::

## 分类要点

| 元素类型 A | 可写回 JS 原值的典型路径 |
|-----------|--------------------------|
| 值类型（struct / enum） | 同型 ByVal exotic，或 Opaque |
| 基元 | 仅 Opaque；改 JS `let` 绑定 **无** 路径 |
| `string` / 引用类型 | Opaque；临时槽路径下 C# **重新赋值** 不反映到原 JS 绑定；**原地改可变对象**仍可见 |

## 与值类型章的关系

by-val struct 是 **拷贝**；要「改字段并反映到 C#」须对 `ref` 形参传入同型 ByVal exotic，或走 Opaque。见 [值类型](/docs/guides/value-types/)、[Struct Marshal](/docs/spec/marshal/05-STRUCT/)。

## 相关文档

- [BYREF](/docs/spec/marshal/03-BYREF/)
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)
- [TsMarshalAs](/docs/guides/ts-marshal-as/)
- [少 GC Marshal](/docs/guides/zero-gc-marshal/)
- [值类型](/docs/guides/value-types/)
