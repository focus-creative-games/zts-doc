---
sidebar_position: 16
title: "指针与不支持类型"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\10-POINTER.md`）
:::


# 指针与不支持类型

> **规范性：** 非托管指针、函数指针、以及 v1 默认不支持或受限的 CLR 形态之 Marshal 规则。
> **相关：** 默认矩阵 → [01-OVERVIEW.md](./01-OVERVIEW.md)；`IntPtr` → [01-OVERVIEW.md](./01-OVERVIEW.md) §4；OpaqueValue → [04-OPAQUE.md](./04-OPAQUE.md)；Delegate → [09-FUNCTION.md](./09-FUNCTION.md)；`ref struct` → [05-STRUCT.md](./05-STRUCT.md)。

**平台原则：** Mono 与 Il2Cpp **JS 可见语义一致**。

---

## 1. 与 `IntPtr` / `UIntPtr` 的区分

| 类型 | JS 默认形态 | 脚本可当作整数运算 |
|------|-------------|-------------------|
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | **`number`（整数）** | **可以**（按数值；**禁止 bigint**） |
| **`T*` / `void*` 等非托管指针** | **Pointer**（internal opaque handle） | **不可以**（仅透传） |
| **函数指针** `delegate*<…>` | **Pointer** | **不可以** |

---

## 2. 非托管指针（`T*`、`void*` 等）

**范围：** `Type.IsPointer == true` 且非托管元素类型。

### 2.1 默认 Marshal

| 方向 | 形态 |
|------|------|
| **C# → JS** | **Pointer**（地址值令牌；**无** 三表分派） |
| **JS → C#** | **Pointer**；Pop 须匹配 |

### 2.2 JS 侧能力

| 允许 | 禁止 |
|------|------|
| 同步链内 **原样** 传给下一 C# 调用 | **解引用**、读写内存 |
| | `.` 成员、算术 |
| | 持久化后在异步 / 后续 **JS_Call** 使用 |

### 2.3 `[TsMarshalAs]`

允许 `Default` 与 **`OpaqueValue`**（仅 C#→JS）。`Object`、`Table` 等 **非法**。

---

## 3. 函数指针

### 3.1 默认 Marshal

| 方向 | 形态 |
|------|------|
| **C# → JS** | **Pointer**（入口地址） |
| **JS → C#** | **Pointer** |

### 3.2 JS 侧

**仅透传**；**不能**从 JS **调用**该地址。

### 3.3 与 `Delegate` 对比

| 类型 | JS 默认 | JS 侧可调用 |
|------|---------|-------------|
| **Delegate** | function 或 Delegate exotic | **可以** |
| **`delegate*<…>`** | Pointer | **不可以** |

---

## 4. `System.TypedReference`

**仅 OpaqueValue**（默认即此）。

| 方向 | 规则 |
|------|------|
| **C# → JS** | Push **OpaqueValue**；`get`/`set_opaquevalue` |
| **JS → C#** | **仅** 兼容 OpaqueValue |
| 其它 `[TsMarshalAs]` | **非法** |

---

## 5. 其他不支持或受限类型

### 5.1 `decimal`

| 方向 | 规则 |
|------|------|
| **默认** | **暂不支持** |
| **`[OpaqueValue]`（C#→JS）** | **合法** |

### 5.2 `ref struct`（`Span<T>` 等）

| 方向 | 规则 |
|------|------|
| **by-val 形参** | **不能** 默认 marshal |
| 受控路径 | OpaqueValue 等（[05-STRUCT.md](./05-STRUCT.md)） |

### 5.3 `Nullable<T>`

有值同 `T`；无值 → JS **`null`**（**不是** `undefined` 作为 Push 结果）；Pop 接受 **`null`/`undefined`** 为无值（[01-OVERVIEW.md](./01-OVERVIEW.md) §2）。

### 5.4 `dynamic`

编译期按 **`object`**。

### 5.5 `bigint`（JS）

**禁止**作为 CLR 整型 / enum / `IntPtr` 通道 → **`throw Error('zts: …')`**（[../00-OVERVIEW.md](../00-OVERVIEW.md) §1.3）。

### 5.6 开放泛型形参

由调用时类型实参决定 marshal（[../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §6）。

---

## 6. 注册阶段应拒绝的签名

| 条件 | 行为 |
|------|------|
| **ref struct by-val** 形参 | **拒绝绑定** |
| 无法解析的 byref 组合 | **拒绝** |

**允许：** GetFunction / delegate bridge 上的 `ref`/`out`/`in`（C#→JS Opaque；JS→C# [03-BYREF.md](./03-BYREF.md)）。

---

## 7. Pointer Pop 细则

| 项 | 规则 |
|----|------|
| 接受 | **仅** Pointer handle |
| **不** 接受 | `number`、`bigint`、ByObj/ByVal exotic、OpaqueValue **隐式互转** |
| **`null` 指针** | C#→JS：两平台一致（Pointer 或 **`null`**，实现须文档化） |
| 不匹配 | **`throw Error`** |

---

## 8. 三种「非成员分派」令牌对比

| 种类 | 用途 | 三表 / 成员 | 脚本读写 |
|------|------|-------------|----------|
| **Pointer** | 非托管 / 函数指针透传 | **无** | **不可**解引用 |
| **OpaqueValue** | C# 栈帧参数槽 | **无** | `get`/`set_opaquevalue` |
| **ByObj/ByVal exotic** | 托管对象 / struct | **有** IEO | `.` 成员 |

---

## 9. Mono / Il2Cpp 一致性

Pointer Push/Pop 宽度、TypedReference、decimal/ref struct、bigint 拒绝、错误消息 — **须一致**。

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | 矩阵、number |
| [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) | 合法标注 |
| [04-OPAQUE.md](./04-OPAQUE.md) | Opaque vs Pointer |
| [09-FUNCTION.md](./09-FUNCTION.md) | Delegate |
