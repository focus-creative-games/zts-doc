---
sidebar_position: 11
title: "Struct Marshal"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\05-STRUCT.md`）
:::


# Struct Marshal

> **规范性：** C# struct（值类型）与 JavaScript 互操作的传递、构造与写回规则。
> **OpaqueValue / byref（C#→JS）：** 见 [04-OPAQUE.md](./04-OPAQUE.md)。
> **JS→C# byref 真 ref：** 见 [03-BYREF.md](./03-BYREF.md)。
> **Table / UnpackedValues：** 见 [02-MARSHAL-AS.md §5–§6](./02-MARSHAL-AS.md)。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 零拷贝（默认 Handle） | struct 在桥接栈帧上时，C#→JS 可 Push OpaqueValue handle |
| 安全 | JS **不持有** struct 裸地址；过期访问 **throw** |
| 统一 | struct 与 class 同样走 `CSharp.*`、`obj.Method()` |
| 可显式选择 | `[TsMarshalAs]`：`Object`、`Table`、`UnpackedValues`、`OpaqueValue` |

**术语：**

- **Blittable struct**：可 `memcpy`，无托管引用字段。
- **Non-blittable struct**：含 `string`、class 等；ByVal exotic 须 GC 扫描。

---

## 2. 默认 Marshal（摘要）

| 方向 | 默认形态 | 说明 |
|------|----------|------|
| **C# → JS**（by-val） | **ByVal exotic** 或 **OpaqueValue** | 长生命周期 Push **ByVal exotic**；同步链 by-val 亦可能 OpaqueValue |
| **C# → JS**（`ref`/`in`/`out`） | **OpaqueValue** | [04-OPAQUE.md](./04-OPAQUE.md) |
| **JS → C#** | **ByVal exotic** 或 **`new Type(...)`** | 默认 **不** 接受 plain object / 多实参；须 `[Table \| UnpackedValues]` |

---

## 3. 三种 JavaScript 可见形态

```text
┌─────────────────────────────────────────────────────────────┐
│  C# struct 在 JS 侧的承载形态                                │
├─────────────────┬───────────────────┬───────────────────────┤
│  OpaqueValue    │  ByVal exotic     │  ByObj exotic         │
│  (Handle)       │  (StructUserData) │  (boxed)              │
├─────────────────┼───────────────────┼───────────────────────┤
│  无成员分派     │  IEO 三表分派     │  ByObj IEO            │
│  仅同步有效     │  可长期持有       │  装箱路径             │
│  get/set_opaque │  .field / .Method │  .field / .Method     │
└─────────────────┴───────────────────┴───────────────────────┘
```

| 形态 | 典型来源 | 成员访问 | 生命周期 |
|------|----------|----------|----------|
| **OpaqueValue** | C#→JS by-val（同步）或 **byref** 默认 | **不可** `.` 成员；须 get/set 或 `to_user_data` | 仅本次 C#→JS 调用 |
| **ByVal exotic** | Push 拷贝、`new Type(...)`、`to_user_data` | **ByVal IEO** | JS GC + Registry |
| **ByObj exotic** | box 路径、`zts.box` | **ByObj IEO** | `ObjectRegistry` GC root |

**互转：** `zts.to_user_data(opaque)` **拷贝** 为 ByVal exotic，与原 opaque 独立。

---

## 4. ByVal 与 ByObj 双 IEO

| 路径 | exotic 载荷 | 实例分派 |
|------|-------------|----------|
| **ByObj** | 托管对象指针（boxed） | **ByObj IEO**（`__byobjInstanceProto`） |
| **ByVal** | struct **值拷贝**（payload） | **ByVal IEO**（`__byvalInstanceProto`） |

类型对象 `T` 含 `__struct : true` 及两套 instance proto（Nullable **无** IEO，见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §3.6）。

### 4.1 实例方法 `this` 解析

| 路径 | 方法定义在 **当前 struct** | 定义在 **class 基类** |
|------|---------------------------|------------------------|
| **ByObj** | `this` = unboxed payload | `this` = boxed 对象指针 |
| **ByVal** | `this` = payload 首地址 | 须 **Box** 后以 object 指针为 `this` |

**禁止** ByVal exotic 挂 ByObj IEO（或反之）→ **throw**。

### 4.2 C# → JS Push 路径

| 条件 | Push 结果 |
|------|-----------|
| box / `object` 形参 | **ByObj exotic** |
| 显式 ByVal / blittable 拷贝 | **ByVal exotic** |
| 同步链 by-val 默认 | **OpaqueValue** 或 ByVal（实现策略须两平台一致） |
| `[TsMarshalAs(OpaqueValue)]` on by-val | **OpaqueValue** |

---

## 5. JavaScript → C#：接受的实参

| 形态 | 说明 |
|------|------|
| **OpaqueValue** | 须仍在有效 scope；Pop 绑定地址 |
| **ByVal exotic** | by-val：拷贝 payload；`ref`/`out`/`in`：payload 地址（§6） |
| **`new Type(...)` / `Type._default()`** | ByVal payload |
| **`UnpackedValues`** | N 个连续实参 |
| **`Table`** | 单个 plain object；`Nullable` 另接受 `null`/`undefined` |

**默认不接受** plain object `{ X:1 }` 或多实参组装（无标注时）。

---

## 6. 写回与 `ref` / `out` / `in`

见 [03-BYREF.md](./03-BYREF.md)。要点：

| JS 实参 | `ref`/`out`/`in` A（值类型） |
|---------|------------------------------|
| **ByVal exotic**，类型 **== A** | payload 地址，**可写回** |
| **ByVal exotic**，**A = `Nullable<T>`**，exotic 类型 **== T** | 拷入 `Nullable<T>` 临时槽 |
| **OpaqueValue** | handle 地址 |
| **其它** | 临时槽，**不写回** JS |

```javascript
const p = new Point2D(1, 2);
CS.Demo.Offset(p, 10, 20);
console.assert(p.x === 11);
```

---

## 7. `Table` / `UnpackedValues`

规则以 [02-MARSHAL-AS.md §5–§6](./02-MARSHAL-AS.md) 为准。

| `TsMarshalType` | JS → C# | C# → JS |
|-----------------|---------|---------|
| **`UnpackedValues`** | 连续 N 实参 | **Array** 长度 N（或 bridge 约定） |
| **`Table`** | plain object；Nullable 无值 → `null`/`undefined` | plain object；无值 → **`null`** |

类型级示例：

```csharp
[TsMarshalAs(TsMarshalType.Table, Members = new[] { "X", "Y" })]
public struct Vector2 { public float X; public float Y; }
```

---

## 8. 枚举与 struct 的区别

见 [08-ENUM.md](./08-ENUM.md)。enum **无** `[[Construct]]` / ByVal `new Enum(...)`；默认 **number**。

---

## 9. `zts.box` / `zts.unbox` / `zts.cast`

| API | struct 语义 |
|-----|-------------|
| **`zts.box(typeArg, value)`** | 装箱 → **ByObj exotic** |
| **`zts.unbox(boxed)`** | ByObj → **ByVal exotic** 或标量 |
| **`zts.cast(obj, targetType)`** | 引用门面；struct 见 [06-CLASS.md](./06-CLASS.md) |

**`unbox` 不接受** ByVal exotic → **throw**。

---

## 10. 生命周期

```text
[C# 调 JS，同步链]
  Push OpaqueValue(h) → JS_Call 回调
  C# 返回 → h 失效

需长期持有 → zts.to_user_data(h) 或 ByVal exotic 路径
```

| 形态 | 失效 |
|------|------|
| **OpaqueValue** | C# 返回 / scope End |
| **ByVal exotic** | JS GC → Registry Release |

---

## 11. Non-blittable struct（规范层）

1. ByVal exotic 内 **完整拷贝** struct（含引用字段）。
2. GC 须扫描 payload 内 **托管引用**（Il2Cpp：`RegisterPushRootCallback` 等）。
3. exotic 释放与 Registry **对称**。

Blittable：仅 `memcpy` 到 payload。

---

## 12. 与类型系统衔接

- `T.__struct === true`；`T.__byvalInstanceProto` / `__byobjInstanceProto`。
- **Opaque**：无 IEO；不可 `.` 访问字段。
- **禁止** 经实例访问静态成员（须用类型对象 `T`）。

---

## 13. Mono / Il2Cpp 一致性

三种形态、Handle 过期、`to_user_data` 拷贝语义、`Table`/`UnpackedValues`/`?`、StructUserData 真 ref — **须一致**。

---

## 14. 相关文档

| 主题 | 文档 |
|------|------|
| 默认矩阵 | [01-OVERVIEW.md](./01-OVERVIEW.md) |
| `[TsMarshalAs]` | [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) |
| byref / Opaque | [03-BYREF.md](./03-BYREF.md)、[04-OPAQUE.md](./04-OPAQUE.md) |
| 枚举 | [08-ENUM.md](./08-ENUM.md) |
| `zts.*` | [../05-LIB.md](../05-LIB.md) |
| 类型对象 | [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §3.7 |
