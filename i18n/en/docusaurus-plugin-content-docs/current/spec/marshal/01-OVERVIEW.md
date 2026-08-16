---
sidebar_position: 7
title: "Marshal 总览 — 默认规则矩阵"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\01-OVERVIEW.md`）
:::


# Marshal 总览 — 默认规则矩阵

> **规范性：** 未标注 `[TsMarshalAs]`（或标注为 `TsMarshalType.Default`）时，各 CLR 类型在 **C# ↔ JavaScript** 双向调用中的默认 Marshal。
> **覆盖：** 参数、返回值、字段、属性上的 `[TsMarshalAs]` 见 [02-MARSHAL-AS.md](./02-MARSHAL-AS.md)。
> **实现：** → `impl/marshal/`。

---

## 1. 平台原则

- **Mono（Editor）与 Il2Cpp（Player）的 JS 可见 Marshal 语义一致**；差异仅在实现层（零 GC、生成代码等），不改变脚本可观察行为。
- **函数 / delegate：** JS 调用 C# 方法时，delegate 形参接受 JS **callable**（`function` 或等价），由桥接层隐式 marshal，详见 [09-FUNCTION.md](./09-FUNCTION.md)。
- **GetFunction 取得的 delegate 调用 / delegate bridge（C# → JS）** 上 `ref`/`out`/`in` 的默认 Push 为 **OpaqueValue**，与 JS→C# 路径不同，见 [03-BYREF.md](./03-BYREF.md)、[04-OPAQUE.md](./04-OPAQUE.md)。
- **v1 禁止 bigint 作为 CLR 整数通道**（见 [../00-OVERVIEW.md](../00-OVERVIEW.md) §1.3）；整型基元、enum 底层、`IntPtr` 数值均经 **`number`**。

---

## 2. `undefined` 与 `null`（完整边界规则）

QuickJS 同时存在 `undefined` 与 `null`。**禁止**在规范层将二者无差别等同为「空」。

### 2.1 语义对照

| JS 值 | 含义 | 典型场景 |
|-------|------|----------|
| **`undefined`** | 「未提供 / 缺失」 | 形参未传、可选参数省略、对象属性不存在（**CLR 绑定 miss 除外**）、C#→JS 可选参数未填充 |
| **`null`** | 「显式空引用 / 无值」 | CLR **引用类型 null**、`Nullable<T>` 无值、脚本显式传入的空引用 |

**不属于 `undefined`/`null`：** 值类型零值（`0`、`false`）须用对应 JS 基元或 struct 构造产物。

### 2.2 C# → JavaScript（Push）

| C# 源 | JS 形态 |
|-------|---------|
| 引用类型 **`null`** | **`null`** |
| `Nullable<T>`（`T` 为值类型）无值 | **`null`**（**不是** `undefined`） |
| `Nullable<T>` 有值 | 同 `T` 的默认 Push |
| 可选参数未提供（C# 侧 invoke 使用默认值） | 由 bridge 决定是否在 JS 侧可见；**GetFunction 回调形参**若 C# 未传 optional 段，JS 侧对应位置为 **`undefined`** |
| 值类型零值（`0`、`false` 等） | 对应 **`number`** / **`boolean`**，**不是** `undefined`/`null` |
| `void` 返回 | JS 侧 **`undefined`**（无返回值） |

### 2.3 JavaScript → C#（Pop）

| JS 实参 | 目标 CLR 类型 | 行为 |
|---------|---------------|------|
| **`null`** | 引用类型 / delegate / 数组 / `Nullable<T>` | **`null`** / 无值 |
| **`undefined`** | 引用类型 / delegate / 数组（**必选**形参） | **`throw Error('zts: argument missing: …')`** — 必选引用形参须显式传 **`null`** |
| **`undefined`** | `Nullable<T>` | 视为 **无值**（`null`） |
| **`undefined`** | 带 CLR **`HasDefault`** 的可选形参（尾部连续段） | 使用 **Bind 期物化** 的默认值；**不**消耗「实参个数」 |
| **`undefined`** | 值类型（非 `Nullable`）必选形参 | **`throw Error`** |
| **`undefined`** | `params T[]` 位 | 见 [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) §7（**不**等同空数组） |

### 2.4 属性 / 索引与 Marshal 的边界

| 场景 | 行为 |
|------|------|
| 读 C# 绑定成员 miss | **`throw Error('zts: member not found: …')`** — **不是** `undefined` |
| 读 JS 普通对象不存在的属性 | ECMAScript 默认 **`undefined`**（与 ZTS 无关） |
| C# **只写属性** 读 | **`throw Error('zts: property has no getter: …')`** |
| 数组 exotic **`get(i)`** 越界 | **`throw Error`**（见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §7） |

### 2.5 数组与空洞

| 形态 | Pop 为 szarray |
|------|----------------|
| **`null`** | C# **`null`** |
| **`undefined`**（作为整参传入） | 同 §2.3 必选引用规则 |
| **JS `Array`** | 须 **0..length-1 连续**、**无空洞**（`length` 与最大索引一致）；见 [07-ARRAY.md](./07-ARRAY.md) |
| **稀疏 Array / 带 holes** | **`throw Error`** |

### 2.6 示例

```javascript
// 引用 null：显式 null
CS.Service.TakeString(null);

// 错误：undefined 不能代替 null（必选形参）
// CS.Service.TakeString(undefined);  // throw

// Nullable 无值
CS.Service.TakeNullableInt(null);      // OK
CS.Service.TakeNullableInt(undefined); // OK → 无值

// 可选参数
CS.Service.Log(msg, level);            // level 省略 → undefined → 用 C# 默认
CS.Service.Log(msg);                   // 同上

// C#→JS：null 与 undefined
function onData(data) {
    console.assert(data === null);     // C# 传 null 引用
}
function onOptional(x, y) {
    console.assert(y === undefined);   // C# 未传 optional
}
```

---

## 3. 整数与 `number`

- **唯一整数通道：** JS **`number`**（IEEE-754 双精度）。**禁止** `bigint` 隐式或显式映射为 `long` / `IntPtr` / enum 等（v1）。
- Pop 整型基元 / enum 时：实参须为 **`number`** 且 **`Number.isInteger(value) === true`**（`NaN` / `Infinity` 拒绝）；再按目标类型范围校验。
- Push 整型：`number`；超出 `Number.MAX_SAFE_INTEGER` 的 `ulong` 等须在文档化边界内行为一致（实现可 warn；越界 Pop → throw）。
- **`char`**：按 Unicode 码点（16 位）整型 `number`。
- **`float`/`double`**：任意有限 `number`；向整型窄化时遵循 C# 收窄规则 + 整型校验。

---

## 4. 默认 Marshal 矩阵

| C# 类型 | C# → JS | JS → C# | 说明 |
|---------|---------|---------|------|
| `bool` | `boolean` | `boolean` | |
| `char` | `number`（整数） | `number`（整数） | 见 §3 |
| `byte` … `ulong` | `number`（整数） | `number`（整数） | **禁止 bigint**；见 §3 |
| `float` / `double` | `number` | `number` | |
| `IntPtr` / `UIntPtr` / `nint` / `nuint` | `number`（整数） | `number`（整数） | 指针 **数值**；与 [10-POINTER.md](./10-POINTER.md) 非托管指针 **不同** |
| `T*`（非托管指针） | **Pointer**（opaque internal handle） | **Pointer** | 仅透传；见 [10-POINTER.md](./10-POINTER.md) |
| 函数指针 | **Pointer** | **Pointer** | 同上 |
| `System.TypedReference` | **OpaqueValue** | **OpaqueValue** | 默认即此 |
| `string` | `string` | `string` | |
| `byte[]` | **ByObj exotic** | **ByObj exotic** 或 **Array** | 与 `T[]` 相同；`[TsMarshalAs(Bytes)]` → ↔ **string** |
| `class` | **ByObj exotic** | **ByObj exotic** | 引用身份；`null` ↔ **`null`**；门面 = 声明类型，见 [06-CLASS.md](./06-CLASS.md) |
| `T[]`（szarray） | **ByObj exotic** | **ByObj exotic** 或 **Array** | 见 §5、[07-ARRAY.md](./07-ARRAY.md) |
| `T[,…]`（mdarray） | **ByObj exotic** | **仅 ByObj exotic** | **不**接受 JS Array |
| `enum` | `number`（整数） | `number`（整数）或 **ByObj exotic**（boxed） | 默认不推 exotic；boxed 仅经 `zts.box`；见 [08-ENUM.md](./08-ENUM.md) |
| `struct` | **ByVal exotic** 或 **OpaqueValue** | **ByVal exotic** 或 `new Type(...)` | C#→Lua 常规见 [05-STRUCT.md](./05-STRUCT.md)；`ref`/`in`/`out` 或 `[OpaqueValue]` → OpaqueValue |
| `Delegate` | **function** 或 **Delegate exotic** | **function** 或 **Delegate exotic** | 见 [09-FUNCTION.md](./09-FUNCTION.md) |
| `object` | **ByObj exotic**（`System.Object` 门面） | `boolean`/`number`/`string`/exotic 等 | 门面 = `object`；见 [06-CLASS.md](./06-CLASS.md) |
| `Nullable<T>` | 同 `T` 或 **`null`** | 同 `T`、**`null`** 或 **`undefined`**（无值） | §2 |
| `interface` | **ByObj exotic** | **ByObj exotic** | 同 class；可 `[TsMarshalAs(Object\|UnpackedValues)]` 仅 struct 场景不适用 interface |
| `decimal` | **暂不支持**（默认） | **暂不支持** | v1 默认路径未纳入 |
| `ref struct` | 见 [05-STRUCT.md](./05-STRUCT.md)、[../05-LIB.md](../05-LIB.md) | 同左 | 不能作为普通 by-val 默认传递 |
| `void`（返回值） | `undefined` | — | |

### 4.1 Exotic 形态说明

**ByObj exotic**、**ByVal exotic**、数组 ByObj、boxed enum、Delegate exotic 均为 QuickJS **exotic object**（internal slots + 三表分派），脚本侧经 `.` 访问成员（方法调用 **`obj.Method(args)`** 自动绑定 CLR `this`）。

与下列形态 **不同**：

| 形态 | 特征 | 文档 |
|------|------|------|
| **OpaqueValue** | 无成员分派；opaque exotic / internal handle | [04-OPAQUE.md](./04-OPAQUE.md) |
| **Pointer** | 无 metatable / 三表；仅透传地址令牌 | [10-POINTER.md](./10-POINTER.md) |

---

## 5. 数组（szarray / mdarray）

| C# 类型 | C# → JS | JS → C# |
|---------|---------|---------|
| **`T[]`（szarray）** | **ByObj exotic** | **ByObj exotic**，**或** **Array 形态**（§5.2） |
| **`T[,…]`（mdarray）** | **ByObj exotic** | **仅 ByObj exotic** |
| **`byte[]`** | 同 szarray（除非 `[TsMarshalAs(Bytes)]`） | 同 szarray |

### 5.1 C# → JS

数组实例 Push 为 **ByObj exotic**（`ObjectRegistry` 登记；元素访问经 `get`/`set`，见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §7）。

### 5.2 JS → C#（szarray）

| 实参形态 | Pop 行为 |
|----------|----------|
| **ByObj exotic** | 类型须与目标 `T[]` 一致（或兼容）；传入数组引用 |
| **JS `Array`** | 索引 **0..n-1** 连续、无空洞；按序 Pop 元素为 `T`，构造 **`T[n]`** |
| **`null`** | **`null`** |
| **`undefined`** | 必选形参 → **throw**（§2.3） |

### 5.3 JS → C#（mdarray）

**仅** ByObj exotic 或 **`null`**；**不**接受 JS Array。

### 5.4 Array 形态约束

- **不接受** 稀疏数组、`Array` 带 holes、或类数组 plain object（v1）。
- 空数组 `[]` → **`T[0]`**（零长度，**非** null）。

---

## 6. 引用类型门面（摘要）

对所有 **引用类型** 形参、返回值、字段/属性：

| 概念 | 含义 |
|------|------|
| **Identity** | exotic 内部槽持有的托管对象引用（运行时实际实例） |
| **View / 门面** | 实例分派 **IEO** 与成员可见性；**唯一来源 = 本次 Marshal 的声明类型** |

**规则摘要：**

1. **C# → JS**：按 **声明类型** 选择默认形态与 ByObj IEO；**不**因运行时类型改挂更具体类型或改走 `string` 等特殊 Marshal。
2. **Downcast**：仅 `zts.cast(obj, targetType)`（见 [../05-LIB.md](../05-LIB.md)）。
3. **对象缓存**：键 **`(identity, viewType)`**；`ObjectRegistry` 槽位为 **GC root**（见 [../10-LIFETIME.md](../10-LIFETIME.md)）。

完整规则见 [06-CLASS.md](./06-CLASS.md)。

---

## 7. 相关文档

| 主题 | 文档 |
|------|------|
| `[TsMarshalAs]` 覆盖默认 | [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) |
| `ref` / `in` / `out` | [03-BYREF.md](./03-BYREF.md) |
| OpaqueValue | [04-OPAQUE.md](./04-OPAQUE.md) |
| struct | [05-STRUCT.md](./05-STRUCT.md) |
| class / interface | [06-CLASS.md](./06-CLASS.md) |
| 数组 / `Bytes` | [07-ARRAY.md](./07-ARRAY.md) |
| 枚举 | [08-ENUM.md](./08-ENUM.md) |
| delegate / JS function | [09-FUNCTION.md](./09-FUNCTION.md) |
| 指针 / 不支持类型 | [10-POINTER.md](./10-POINTER.md) |
| 重载与实参匹配 | [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md) |
| `zts.*` API | [../05-LIB.md](../05-LIB.md) |
