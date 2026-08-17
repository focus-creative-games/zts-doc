:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`metatable\04-SPECIAL-TYPES.md`）
:::

﻿---
sidebar_position: 21
title: "特殊类型的分派行为"
---

# 04 — 特殊类型的分派行为

本文档汇总 **enum**、**Nullable\<T\>**、**struct**、**数组**、**委托（delegate）** 在 exotic 布局与属性分派上的特例。值如何 Push/Pop、ByVal/ByObj payload 布局等 Marshal 细节见 [../marshal/](/docs/spec/marshal/) 各分册；本文只描述 **JavaScript 脚本可见** 的对象结构、内部方法与索引入口。

**关联文档：** 通用布局 → [01-LAYOUT.md](./01-LAYOUT.md)；索引算法 → [02-INDEX.md](./02-INDEX.md)；绑定规则 → [03-BINDING.md](./03-BINDING.md)。

---

## 1. 枚举（enum）

### 1.1 类型对象与静态访问

enum 经 `CSharp[assembly][typeFullName]` 解析为类型对象 `E`，带 `__enum : true`、STO 与 ByObj IEO。**无** `__byvalInstanceProto`。

Bind 期将该 enum 所有 **public static literal** 字段写入 **`E` 本体**为 **number**（值为 C# underlying 整型，通常为 `number`；**不是** bigint）。读 `E.Red` 时若键已在 `E` 上，不触发分派 `[[Get]]`。

STO 提供 **属性 get/set**（静态三表），但 **无 `[[Construct]]`**、**无 `_default`**。**禁止** `new EnumType(...)` 构造实例，**禁止**在 `E` 或 STO 上挂 `_ctor`。

对 enum 常量的赋值：属性 set strict throw，与 static readonly 一致。

### 1.2 Boxed 实例

需要 **boxed enum**（ByObj exotic object）时使用 **`zents.box`**（`../05-LIB.md`），**不**提供类型对象构造入口：

```javascript
const Color = CSharp.AC['MyGame.Color'];
const redBox = zents.box(Color, Color.Red);
```

产物挂接 **`E.__byobjInstanceProto`**，`__zents_ud_kind` 为 `"byobj"`。实例三表通常为空或极少成员（enum 无 public 实例 field/method）；`toString` 建议形如 `EnumFullName(value)`。

默认跨边界传参仍用 **number**（`../marshal/08-ENUM.md`）；`zents.box` 仅用于需要 **object 形参**、装箱语义的场景。

### 1.3 与 class / struct 对比（分派）

| 项 | enum |
|----|------|
| 类型对象常量 | number 键 |
| `[[Construct]]` | **无** |
| `_default` | **无** |
| 实例 exotic object | 仅 `zents.box` → ByObj |
| 继承扁平化 | **无**（enum 无继承链合并） |

---

## 2. Nullable\<T\>（闭合值类型）

`System.Nullable\`1` 经 `zents.make_generic_type` 闭合为类型对象 `N`，带 **`__nullable : true`**，与 `__struct` / `__enum` 互斥。

### 2.1 布局特例

- **无** `__byvalInstanceProto`、**无** `__byobjInstanceProto`、**无** IEO。
- STO **仅** 含 **`[[Construct]]`** 与可选 **`toString`**；**无**静态成员属性 get/set（不暴露 Nullable 类型自身的 static 成员绑定）。

### 2.2 `[[Construct]]` 语义

`new N(...)` 或 `N(...)`（若实现允许 callable）构造的是 **element 类型 `T` 的有值表示**，**不是** Nullable 包装实例。native 将 construct 绑定到 **element 类型** 的构造逻辑（与 `new T(...)` / 基元转换一致）：

```javascript
const NullableInt = zents.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zents.types.int32
);
const n = new NullableInt(42);   // JS number，非 exotic object

const NullablePoint = zents.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    Point2D
);
const p = new NullablePoint(1, 2);   // Point2D ByVal exotic object
```

| `T` 种类 | `N(...)` 返回值 |
|----------|-----------------|
| 基元 | 对应 JS 基元（boolean / number） |
| struct | **`T` 的 ByVal exotic object** |
| enum | **不支持**此入口（enum 无 construct） |

**null / 无值** 不经 `N(...)` 表达；向 C# 传 `Nullable<T>` 的 null 时直接传 JS **`null`**（**不是** `undefined`；见 [../00-OVERVIEW.md](../00-OVERVIEW.md) §1.4、`../marshal/01-OVERVIEW.md`）。

---

## 3. 值类型 struct

struct 类型对象含 **`__struct : true`**，同时挂 **`__byvalInstanceProto`** 与 **`__byobjInstanceProto`**（见 [01-LAYOUT.md](./01-LAYOUT.md) §4）。

### 3.1 静态入口

| 入口 | 位置 | 语义 |
|------|------|------|
| `new Type(...)` | STO `[[Construct]]` | 有参 public 构造 → **ByVal exotic object**（与规范默认构造产物一致） |
| `Type._default()` | STO 保留键 `_default`，经静态属性 get → STO 回退 | 无参 **零初始化** 实例，等价 `default(T)`；**不**调用用户带参构造 |

**禁止** `_ctor` 字段；**禁止** enum/Nullable 的 `_default`。

### 3.2 实例成员与双 IEO

- **ByVal exotic object**：`[[DispatchProto]]` = `T.__byvalInstanceProto`；字段/方法经 ByVal 三表索引；`this` 指向 payload（`../marshal/05-STRUCT.md`）。
- **ByObj exotic object**（boxed struct）：`[[DispatchProto]]` = `T.__byobjInstanceProto`；同一成员名，ByObj 三表 function。
- **静态成员**经 `T` / STO 访问，与 class 路径相同。

```javascript
const p = new Point(3, 4);
p.translate(1, 0);        // ✅ 方法调用，自动 ByVal this

const move = p.translate;
move(1, 0);               // ❌ 提取 function，不绑定 this（§02-INDEX §3.2）
```

struct **无** C# 实例继承；Bind 期 **不** 合并基类实例成员（值类型无派生实例继承场景）。可选 `zents.box` 在 ByVal 与 ByObj 间转换（marshal 分册）。

---

## 4. 数组（szarray / mdarray）

数组类型对象结构与普通引用类型类似：**仅 ByObj IEO**（数组对象为 `Il2CppArray*` / 等价引用）。STO **无** `[[Construct]]`（数组实例由 `zents.new_szarray_*` / `zents.new_mdarray_*` 创建，见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md)）。

### 4.1 实例特性

| 特性 | 行为 |
|------|------|
| `length` | szarray：`arr.length` = `Length`；mdarray：`arr.length` = 各维 `GetLength(d)` 之**积**（可寻址元素总数），**不是**单维长度 |
| 整数键 `arr[i]` | **不**实现；读写在运行时 **不** 走 `[[Get]]`/`[[Set]]` 整数键 |
| 属性 get/set | 走实例三表 |

### 4.2 元素访问：`get` / `set`

Bind 期向实例 **`methodTable`** 注册 native 方法 **`get`** / **`set`**（**非** `get_Item` 命名）：

```javascript
arr.set(0, 10);      // szarray：1 个下标 + value
console.assert(arr.get(0) === 10);

matrix.set(0, 1, 7); // mdarray：rank 个下标 + value
```

实参个数：`get` 须等于 **rank**；`set` 须等于 **rank + 1**（末参为 value）。下标为 **C# 各维下标**（含 `lowerBound`），须为 **number**（**禁止** bigint 下标）。越界 → `throw new Error('zents: …')`。

`get` / `set` 为 **实例方法**，须 **`arr.get(0)`** 方法调用形式；提取后调用遵守 [02-INDEX.md](./02-INDEX.md) §3.2。

仍可通过三表绑定的 **`GetValue` / `SetValue`** 等方法访问；基元断言优先 `get`（未装箱）。与 `zents.to_array` 的 0 基 JS Array 语义不同，见 `../marshal/07-ARRAY.md`。

---

## 5. 委托（delegate）

委托类型对象 + **ByObj IEO**。委托 **实例** exotic object 在 ByObj IEO 上额外注册 **`[[Call]]`**：

```javascript
const cb = new SomeDelegate((x) => x * 2);
const result = cb(21);   // 等价 invoke；非 cb.Invoke(21) 必需
```

`[[Call]]` 实参个数须与 `Invoke` 签名一致；JS function → delegate 的 Marshal 见 `../marshal/09-FUNCTION.md`。静态成员（若有）仍经 STO 三表；**无** event 子对象。

委托实例 **不是** 典型「实例 method + receiver」模型：`[[Call]]` 直接 invoke multicast；**无** `[[NeedsReceiver]]` 提取问题。

---

## 6. 其它类型（摘要）

| 类型 | 分派要点 |
|------|----------|
| **class** | 仅 `__byobjInstanceProto`；`[[Construct]]` → 实例构造；继承成员 Bind 期扁平化 |
| **interface** | 可解析类型对象；通常无 public 构造，`new` 不可用 |
| **抽象类** | 仅 public 构造可 `new`；protected 构造对 JS 不可见 |
| **静态类** | 仅静态三表；无 `[[Construct]]`、无 IEO |

---

## 7. Marshal 交叉引用

| 主题 | 文档 |
|------|------|
| enum 默认 number 与 box | `../marshal/08-ENUM.md` |
| struct ByVal / ByObj | `../marshal/05-STRUCT.md` |
| class / 引用门面 | `../marshal/06-CLASS.md` |
| 数组创建与 `get`/`set` | `../marshal/07-ARRAY.md` |
| Delegate ↔ JS function | `../marshal/09-FUNCTION.md` |
| Nullable null / 有值 | `../marshal/01-OVERVIEW.md` |
| `undefined` vs `null` | `../marshal/01-OVERVIEW.md` |

分派层只保证 **入口与索引语义** 与上表一致；具体栈上类型校验与 GC 行为以 marshal 分册为准。

---

## 8. v1 数值类型限制

| 场景 | 规范 |
|------|------|
| enum 常量 | **number** |
| 数组下标 | **number**（整数） |
| CLR 整数通道 | **number**；**不支持** bigint |
| 脚本传入 bigint 给 C# 整数参数 | **throw** `zents: bigint is not supported for CLR integer types in v1`（或等价） |
