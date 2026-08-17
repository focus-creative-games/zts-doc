---
sidebar_position: 13
title: "数组 Marshal"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\07-ARRAY.md`）
:::


# 数组 Marshal

> **规范性：** szarray、mdarray 及 `byte[]` 在 JavaScript 与 C# 之间的 Marshal 规则。
> **相关：** 创建、`length`、`get`/`set` → [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §7；`zents.to_bytes` / `to_array` → [../05-LIB.md](../05-LIB.md)；ByObj 基础 → [06-CLASS.md](./06-CLASS.md)；`[JsMarshalAs]` → [02-MARSHAL-AS.md](./02-MARSHAL-AS.md)。

**平台原则：** 数组实例为 **ByObj exotic**（`ObjectRegistry` + **GC root**）。

---

## 1. 默认 Marshal 矩阵

| C# 类型 | C# → JS | JS → C# |
|---------|---------|---------|
| **`T[]`（szarray）** | **ByObj exotic** | **ByObj exotic** **或** **JS Array** |
| **`T[,…]`（mdarray）** | **ByObj exotic** | **仅 ByObj exotic** |
| **`byte[]`** | 同 szarray | 同 szarray；`[JsMarshalAs(Bytes)]` → ↔ **string** |

脚本经 **`arr.get(...)` / `arr.set(..., value)`**、**`arr.length`** 访问（**不**实现整数键 `[[Get]]`），见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §7。

---

## 2. C# → JavaScript

| 项 | 规则 |
|----|------|
| 形态 | **ByObj exotic** + 数组 IEO |
| **`null`** | **`null`** |
| 元素 Push | 按 `T` 默认 marshal |
| **`[JsMarshalAs(Bytes)]` on `byte[]`** | Push JS **string**（octet） |
| **`[JsMarshalAs(OpaqueValue)]`** | Push **OpaqueValue**（仅 C#→JS） |
| **`params T[]`（C#→JS）** | 同 szarray：**ByObj exotic**（**不** 默认 Push JS Array） |

---

## 3. JavaScript → C#（szarray）

| 实参形态 | Pop 行为 |
|----------|----------|
| **ByObj exotic** | 类型须匹配目标 `T[]` |
| **JS `Array`** | 索引 **0..length-1** 连续、**无 holes**；按序 Pop 元素构造 **`T[n]`** |
| **`null`** | **`null`** |
| **`undefined`** | 必选形参 → **`throw Error('zents: argument missing: …')`** |

### 3.1 Array 形态约束

| 接受 | 拒绝 |
|------|------|
| `[v0, v1, …]`，`length === n`，索引 0..n-1 均有 own property | **稀疏数组** / holes |
| `[]` → **`T[0]`** | 类数组 plain object |
| | **`undefined` 元素**（视为空洞 → throw 或按实现统一拒绝） |

### 3.2 示例

```javascript
CS.Demo.Process(arr);              // exotic
CS.Demo.Process([1, 2, 3]);        // → int[3]
CS.Demo.Process([]);                 // → int[0]
CS.Demo.Process(null);
```

---

## 4. JavaScript → C#（mdarray）

| 实参 | Pop |
|------|-----|
| **ByObj exotic** | 匹配 mdarray |
| **`null`** | **`null`** |
| **JS Array** | **不接受** → **throw** |

不因 `[JsMarshalAs]` 接受 Array（`Object` 与默认等价；`OpaqueValue` 仅 C#→JS）。

---

## 5. 元素读写（与 Marshal 的关系）

| API | 说明 |
|-----|------|
| **`arr.get(i, …)` / `arr.set(…, value)`** | C# 下标；返回/接受 **元素类型 `T` 的 JS 形态** |
| **`GetValue` / `SetValue`** | 仍可用；`GetValue` 返回装箱 `object` |
| **`arr.length`** | szarray → `Length`；mdarray → 各维长度之积 |

> **与 `zents.to_array`：** 产出 **0 基** 连续 JS Array（`t[i] ↔ arr[i]`）；`get`/`set` 用 **C# 下标**。

---

## 6. `byte[]` 与 `[JsMarshalAs(Bytes)]`

| 配置 | C# ↔ JS |
|------|---------|
| **默认** | 同 szarray（exotic；JS→C# 亦可 Array） |
| **`Bytes`** | **`byte[]` ↔ JS `string`**（octet） |

标注 `Bytes` 时 JS→C# **须为 string**；**不接受** exotic / Array。

---

## 7. `params T[]` 形参

与 szarray **相同** Marshal；差异在传参形态（[02-MARSHAL-AS.md §7](./02-MARSHAL-AS.md)）：

| 传入 | C# 收到 |
|------|---------|
| ByObj exotic | 数组引用 |
| `[]` | **`T[0]`** |
| `[ … ]` | **`T[n]`** |
| **`null`** | **`null`** |
| **`undefined`** | **throw**（**非** 空数组） |

**不支持** 多实参隐式收集：`Sum(1, 2, 3)` **非法**。

**GetFunction delegate bridge** 上的 `params` **不支持**（[09-FUNCTION.md](./09-FUNCTION.md)）。

---

## 8. `zents.to_bytes` / `zents.to_array`

[../05-LIB.md](../05-LIB.md) 便利 API（不改变默认 Pop/Push）。

### 8.1 `zents.to_bytes`

- 输入：**仅** szarray exotic
- 元素：**blittable**（基元或仅 blittable 字段的 struct）
- 输出：`Uint8Array` 或 binary string（实现二选一，须文档化）

### 8.2 `zents.to_array`

- 输入：szarray exotic
- 输出：JS `Array`，**0..n-1**，`t[i] ↔ arr[i]`（**0 基**）

### 8.3 与 Pop Array 路径的区别

| | **`zents.to_array`** | **Pop JS Array** |
|--|---------------------|------------------|
| 方向 | exotic → Array（只读） | Array → 构造 `T[n]` |
| 下标 | 0 基只读视图 | Pop 按 0..n-1 读元素 |

---

## 9. 数组类型构造

```javascript
const int_arr_type = zents.make_szarray_type(zents.types.int32);
const arr = zents.new_szarray_by_element_type(zents.types.int32, 10);
```

见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md)、[../05-LIB.md](../05-LIB.md)。

---

## 10. `ref` / `out` / `in` 数组形参

- **JS → C#：** 共享引用；**rebind 不可见**（[03-BYREF.md](./03-BYREF.md)、[06-CLASS.md](./06-CLASS.md)）
- **C# → JS：** 默认 **OpaqueValue**
- 原地改元素 **可见**；`ref arr = other` **不回写** JS 变量

---

## 11. Mono / Il2Cpp 一致性

szarray/mdarray Push/Pop、`to_bytes`/`to_array`、`Bytes`、错误消息 — **须一致**。

---

## 12. 相关文档

| 文档 | 内容 |
|------|------|
| [06-CLASS.md](./06-CLASS.md) | ByObj、ref |
| [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) | Bytes、params |
| [01-OVERVIEW.md](./01-OVERVIEW.md) | undefined/null |
| [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) | 数组 API |
