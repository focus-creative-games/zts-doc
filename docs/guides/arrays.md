---
sidebar_position: 14
title: 数组
description: 一维 / 多维数组的创建、索引、to_array 与 to_bytes。
---

# 数组

通过 `zts` 创建 **szarray**（`T[]`）与 **mdarray**，在 JS 中按 C# 语义访问。权威：[数组 Marshal](/docs/spec/marshal/07-ARRAY/)、[类型系统 §7](/docs/spec/02-TYPE-SYSTEM/)、[05-LIB](/docs/spec/05-LIB/)。泛型集合（`List<T>` 等）见 [泛型](/docs/guides/generics/)。

数组实例为 **ByObj exotic**（Registry + GC root）。元素读写经 **`arr.get` / `arr.set`** 与 **`arr.length`**（**不**实现整数键 `arr[i]`）。

## 一维数组 `T[]`

```javascript
// 方式 A：元素类型 + 长度
const arr = zts.new_szarray_by_element_type(zts.types.int32, 4);

// 方式 B：先构造数组类型
const IntArray = zts.make_szarray_type(zts.types.int32);
const arr2 = zts.new_szarray_by_szarray_type(IntArray, 4);

arr.set(0, 10);      // 0 基，与 C# 一致
arr.set(1, 20);
console.log(arr.get(0));
console.log(arr.length);
```

引用类型元素可为 `null`。越界与 C# 相同 → `throw Error`。

## JS → C#（szarray 形参）

| 实参形态 | 行为 |
|---------|------|
| 数组 ByObj exotic | 类型须匹配目标 `T[]` |
| **JS `Array`** | 索引 `0..n-1` **连续、无 holes** → 构造 `T[n]` |
| `null` | `null` |
| `undefined`（必选） | **throw** `zts: argument missing` |

```javascript
Demo.Process(arr);           // exotic
Demo.Process([1, 2, 3]);     // → int[3]
Demo.Process([]);            // → int[0]
Demo.Process(null);
```

稀疏数组 / 类数组 plain object → **throw**。`params T[]` 亦为 **单实参槽**，**不**多实参隐式收集。

## 与 JS Array / 字节互转

```javascript
const t = zts.to_array(arr);   // JS Array，0 基；t[i] ↔ arr.get(i)

// blittable 元素 → 原始字节拷贝（Uint8Array 或 binary string，以实现为准）
const bytes = zts.to_bytes(floatArr);
```

`to_bytes` 要求元素 blittable（基元或无引用字段的 struct）；**不接受** `bool[]` / `char[]` / 含引用字段。细则见 [05-LIB](/docs/spec/05-LIB/)。

## 多维数组

```javascript
const IntMatrix = zts.make_mdarray_type(zts.types.int32, 2);
const matrix = zts.new_mdarray_by_mdarray_type(
  IntMatrix,
  [0, 0],    // lowbounds
  [3, 4]     // sizes
);
// mdarray：JS→C# 仅接受 exotic / null，不接受 JS Array
// 用 get/set / GetLength 等；arr.length 为各维长度之积
```

## typeArg

`zts.types.int32`、`zts.get_type_from_name("System.Int32")`、已解析类型对象、`make_*_type` 返回值均可作为元素类型实参。更多见 [zts 标准库](/docs/guides/zts-lib/)。

## `byte[]` 与 Bytes

默认同 szarray。若需 octet ↔ JS `string`，标 `[TsMarshalAs(Bytes)]`（见 [TsMarshalAs](/docs/guides/ts-marshal-as/)）。

## 常见错误

| 现象 | 处理 |
|------|------|
| `arr[0]` 无效 | 使用 `get` / `set` |
| 数组越界 | 使用 `0 .. Length-1` |
| 稀疏 Array 传入 | 填满索引；无 holes |
| mdarray 传 JS Array | 只传 exotic |
| `to_bytes` 失败 | 元素非 blittable |

## 相关文档

- [数组 Marshal](/docs/spec/marshal/07-ARRAY/)
- [zts 库规范 · 数组](/docs/spec/05-LIB/)
- [泛型](/docs/guides/generics/)
- [TsMarshalAs](/docs/guides/ts-marshal-as/)
