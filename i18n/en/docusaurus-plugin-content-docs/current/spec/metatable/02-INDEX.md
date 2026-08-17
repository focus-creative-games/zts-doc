:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`metatable\02-INDEX.md`）
:::

﻿---
sidebar_position: 19
title: "属性分派（get / set）"
---

# 02 — 属性分派（get / set）

本文档规定 JavaScript 通过 **属性读/写** 访问 C# **静态成员**（类型对象 `T` + STO）与 **实例成员**（实例 exotic object + IEO）的分派规则。规范描述的是 **JS 可见语义**；Mono 以 exotic object 回调 + 三表实现，Il2Cpp 以 native indexer 实现，二者（以及任何未来 VM 快路径）**必须表现一致**。

**关联文档：** exotic 布局 → [01-LAYOUT.md](./01-LAYOUT.md)；成员如何写入三表 → [03-BINDING.md](./03-BINDING.md)；方法重载 function → [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md)。

---

## 1. 设计动机

ECMAScript 属性访问与 Lua `__index` 不同：QuickJS 对 exotic object 走 `[[Get]]` / `[[Set]]` 内部算法，**不**保证提供「中间 table 再二次索引」的扩展点。

ZenTS 因此令 **field 与 method 统一** 由接收 `(receiver, key)` 的 indexer 分派（与 xLua `obj_indexer(obj, key)` 同构）。注册期将成员拆入三张普通 JS object（或 native 等价 map），运行时按固定顺序查表，**hot path 不**调用 C# `InstanceIndex` / `StaticTypeIndex`，也不将 key 转为 C# 字符串做反射字典查找。

**严格 miss：** 未注册成员的读写均须 **`throw new Error('zents: …')`**（含键名），**禁止**对 CLR 绑定域静默返回 `undefined`（以免随后 `TypeError: … is not a function` 难以定位）。

**与普通 JS 对象区分：** 对 **非 ZenTS** 的普通 object，`obj.foo` miss 仍返回 `undefined`（标准语义）。仅 **CSharp 根对象、程序集对象、类型对象、CLR 实例 exotic object** 适用本文 strict miss 规则。

---

## 2. 三表职责

每个绑定（静态一套、实例一套；struct 的 ByVal / ByObj 各一套实例三表，成员名相同）在注册期构建三张 **lookup table**，由 indexer 以内部槽或 registry ref 持有。

### 2.1 `methodTable`

| 成员种类 | 表中值 | 属性 get 行为 |
|----------|--------|----------------|
| 实例 / 静态 **方法**（含重载 dispatch function） | compiled bridge function | **直接返回 function**，不 call |
| **索引器 property**（`this[...]`，带参 property） | 包装 function / `get_Item` / `set_Item` 等 dispatch | **直接返回** |
| C# **event** 的 `add_*` / `remove_*` | 与普通方法相同，注册为 **method function** | **直接返回** |
| 构造函数元数据 | **不在此表**（`[[Construct]]` 见 [01-LAYOUT.md](./01-LAYOUT.md)） | — |

**不得**将 field getter 或无参 property 的 getter 放入 `methodTable`。

Event 在 JS 侧仅通过 **`add_EventName` / `remove_EventName`**（及编译器生成的等价方法名）调用，与普通实例/静态方法一样进入 `methodTable`。**不存在** event 专用子对象（例如 `{ get, set, fire }`），也不支持对 event 名做属性赋值。

### 2.2 `fieldGetterTable`

| 成员种类 | 表中值 | 属性 get 行为 |
|----------|--------|----------------|
| **字段**（instance / static） | getter function：`function(receiver) { … }` | `return getter(receiver)` |
| **无参可读 property** | 同上（compiled getter bridge） | `return getter(receiver)` |

只读 property / readonly 字段：仅出现在 `fieldGetterTable`；对该键的属性 set 在 `fieldSetterTable` 未命中时报错（见 §4）。

enum 静态常量若已作为 **number** 直接写在类型对象 `T` 上，则读常量时不经过本表。

### 2.3 `fieldSetterTable`

| 成员种类 | 表中值 | 属性 set 行为 |
|----------|--------|----------------|
| **可写字段** | setter function：`function(receiver, value) { … }` | `setter(receiver, value)` |
| **无参可写 property** | 同上 | `setter(receiver, value)` |

只写 property：仅出现在 `fieldSetterTable`；属性 get 在 `methodTable` 与 `fieldGetterTable` 均未命中、但 `fieldSetterTable` 命中时，报 **`zents: property has no getter: {key}`**（不得返回 `undefined`）。

readonly 字段 / 只读 property：**不在**此表；写入时在 `fieldSetterTable` miss 后报错。

### 2.4 同名冲突

同一绑定（静或实）内键名唯一。若 method 与 property/field 同名（极少见），**`methodTable` 优先**：属性 get 先查 method 表，命中则不再查 getter 表。

---

## 3. 属性 get 算法

查表一律使用 **直接 own-property 查找**（不触发用户可篡改的链式原型；实现须保证三表不被脚本污染），避免三表被用户篡改 metatable / prototype 影响分派。

### 3.1 实例 exotic object（IEO）

`receiver` 为实例 exotic object（ByVal 或 ByObj）。ByVal 与 ByObj 使用各自 IEO 绑定的实例三表，算法相同：

```javascript
function getProperty(receiver, key) {
  const k = String(key);

  const member = lookupOwn(methodTable, k);
  if (member !== undefined) {
    return member;  // 返回 function；不在此 invoke
  }

  const getter = lookupOwn(fieldGetterTable, k);
  if (getter !== undefined) {
    return getter(receiver);
  }

  if (lookupOwn(fieldSetterTable, k) !== undefined) {
    throw new Error(`zents: property has no getter: ${typeFullName}.${k}`);
  }

  throw new Error(`zents: member not found: ${typeFullName}.${k}`);
}
```

要点：

- method / 有参 property / `add_*` / `remove_*`：**返回 function**，由脚本自行 **`receiver.method(args)`** 调用。
- field / 无参 property：**调用 getter** 并将返回值交给 JS。
- **miss：`throw Error`（strict）**。不调用 C# 反射 fallback，不沿继承链在运行时查找（继承已在 Bind 期扁平化，见 [03-BINDING.md](./03-BINDING.md)）。
- 错误消息须含 **`{TypeFullName}.{key}`**（`TypeFullName` 为该绑定类型的 JS 全名）。
- 探测「键是否存在」须用 **`lookupOwn`**（不触发分派），或 `try/catch`；不得依赖属性 get 返回 `undefined` 判断 CLR 成员存在性。

### 3.2 方法调用与 CLR `this` 绑定

当脚本以 **方法调用** 形式调用从 `methodTable` 取得的 function 时，runtime **必须**自动传入 CLR `this`：

```javascript
// ✅ 方法调用（Call expression + MemberExpression 为 base）
obj.instanceMethod(a, b);
// 等价 native：InvokeInstanceMethod(obj, instanceMethodBridge, [a, b])
// bridge 收到的 CLR this = obj 对应托管实例

Type.staticMethod(a, b);
// 静态：无 instance this；若有隐式第一个参数须与 C# 签名一致
```

当 function 被 **提取** 后作为普通 function 调用时，**不**自动绑定 CLR `this`：

```javascript
const fn = obj.instanceMethod;
fn(a, b);
// ❌ 规范：不注入 CLR this；须 throw 或产生可诊断失败（Mono/Il2Cpp 行为一致）
// 不得静默把 globalThis / undefined 当作 this 调过 C# 实例方法
```

**判定规则（规范性）：** bridge function 在注册期标记 `[[NeedsReceiver]]`。QuickJS 侧在 **Call** 路径检测：

| 调用形式 | `[[NeedsReceiver]]` 行为 |
|----------|---------------------------|
| `receiver.method(...)`（method call） | 注入 `receiver` 为 CLR this，再 marshal 其余参数 |
| `method(...)`（`method` 为提取的引用） | **不**注入；若 `NeedsReceiver` → **`throw new Error('zents: method requires receiver: …')`** 或等价 |
| `method.call(other, …)` / `apply` | 显式传入的 `thisArg` 若为合法 ZenTS 实例 exotic object，用作 CLR this；否则按 marshal 规则校验 |

**与 ZLua 对照：** ZLua `obj:Method()` 冒号传 self；ZenTS 用 **`obj.Method()`** 点号 + 方法调用检测达到同等效果。ZLua 提取 closure 不传 self 的行为与 ZenTS 一致。

### 3.3 静态类型对象（STO）

逻辑与 §3.1 相同，但：

- `receiver` 为 **类型对象 `T`**（静态门面）。
- 使用 **静态** 三表（与实例三表 **不可共用**）。
- static getter closure 按静态语义实现（无 instance GCHandle pop，静态 field 读类型静态数据段）。

**STO 回退：** 三表均未命中时，查 STO **保留键**（如 struct 的 `_default` callable）。仍无则 **`throw new Error('zents: member not found: ' + typeFullName + '.' + key)`**。

**类型对象直查：** 若 `key` 已存在于 `T` 本体（如 enum 常量 number），JS 引擎在触发分派 `[[Get]]` 之前即返回值；indexer 不负责这些键。

`[[Construct]]` 不参与属性 get；构造通过 `new T(...)` 触发。

---

## 4. 属性 set 算法

### 4.1 实例 exotic object（IEO）

```javascript
function setProperty(receiver, key, value) {
  const k = String(key);

  const setter = lookupOwn(fieldSetterTable, k);
  if (setter !== undefined) {
    setter(receiver, value);
    return;
  }

  throw new Error(`zents: instance member not writable: ${typeFullName}.${k}`);
}
```

要点：

- **无返回值**。
- **miss：strict throw**。包括：不存在字段、只读 property、method、`add_*` / `remove_*`、event 名等**一切不可写**成员。
- **禁止**在实例 exotic object 上写入 arbitrary 新键（不模拟普通 JS object 的 expando 语义）。

### 4.2 静态类型对象（STO）

与 §4.1 相同，使用静态 `fieldSetterTable`；miss 时报错，消息使用 **static** 前缀（见 §6）。

enum 常量、静态 readonly 字面量等不可写键：miss 后报错，与 C# 静态 readonly 一致。

---

## 5. Strict miss 与无反射

| 操作 | miss 行为 |
|------|-----------|
| 属性 get | **`throw Error`**（strict；见 §6） |
| 属性 set | **`throw Error`**（strict） |

**禁止**在 miss 时调用 C# 反射或 `InstanceIndex` / `StaticTypeIndex` 兜底。未在 Bind 期注册进三表的 public 成员，对 JS 等同于不存在（读、写均 throw）。

继承的实例/静态成员须在 **EnsureBinding** 时**扁平写入**当前类型三表（见 [03-BINDING.md](./03-BINDING.md)），因此运行时 **不**沿继承链向上查找。

---

## 6. 错误消息约定

所有消息 **`message` 须以 `zents:` 开头**（允许其后空格）。

| 场景 | 消息（示意） |
|------|----------------|
| 属性 get miss（无 getter / 无 method / STO 回退仍无） | `zents: member not found: {TypeFullName}.{key}` |
| 属性 get 只写 property（仅 setter 表命中） | `zents: property has no getter: {TypeFullName}.{key}` |
| 属性 set 无 setter / 不可写（实例） | `zents: instance member not writable: {TypeFullName}.{key}` |
| 属性 set 无 setter / 不可写（静态） | `zents: static member not writable: {TypeFullName}.{key}` |
| 提取实例方法调用缺 receiver | `zents: method requires receiver: {TypeFullName}.{methodName}` |
| getter 内部类型错误 | bridge 抛出，保持 `zents:` 前缀 |

只读 property 写入、对 method 名赋值等，均归入上表「不可写」语义。

---

## 7. Bootstrap 与工厂（概念）

宿主启动时 **一次** 加载 indexer 工厂函数（registry 缓存 ref）。每个类型绑定调用工厂，传入该类型的静/实例三表 ref，得到共享逻辑的 get/set 分派函数：

```javascript
function bindIndexer(methodTable, fieldGetterTable, fieldSetterTable, typeFullName) {
  function getProperty(receiver, key) { /* §3 */ }
  function setProperty(receiver, key, value) { /* §4 */ }
  return { getProperty, setProperty };
}
```

**每类型不生成独立 JS 源码**；三表为 registry ref 或 side table，传入工厂。Il2Cpp 等价逻辑在 native 侧实现同一语义。

---

## 8. 与 `register_method` 的交互

`zents.register_method`（及 Mono 等价 API）在运行时向目标类型的 method 表挂一个 **新的** 最终名 → **direct** function（完整规则见 `../04-METHOD-OVERLOAD.md` §6.1）。

- `aliasName` **尚不存在** → 写入；之后属性 get 返回该 function。
- `aliasName` **已存在**（单个方法或 overload 组）→ **throw**，不覆盖、不并入。
- 与 field / property 的 method 优先规则见 §2.4；`register_method` 仍只检查 **method 侧**是否已占用该名。

注册到 method 表的 function **同样**遵守 §3.2 `[[NeedsReceiver]]` 规则。

---

## 9. Mono / Il2Cpp 一致性

下列项在 Mono 与 Il2Cpp 上 **必须一致**（实现路径可不同）：

- 已注册 method / field / property / `add_*` / `remove_*` 的读写语义
- 属性 get miss → **throw**；属性 set miss → throw
- 静/实例三表隔离；实例 exotic object 不能隐式访问静态成员
- Bind 期继承扁平化；派生类覆盖基类同名键
- **无** event 子对象；**无** 反射 fallback
- **`obj.Method(args)`** 自动绑定 CLR `this`；提取 function **不**绑定
- **`zents:`** 错误前缀

性能与 GC 属于实现文档（`impl/metatable/`），不在本文范围。

---

## 10. `undefined` 与属性读写的边界

| 场景 | 行为 |
|------|------|
| CLR 绑定成员 miss | **throw**（§6）；**不是** `undefined` |
| 将 `undefined` 写入可写 CLR 字段/property | 按 marshal 规则 Pop（见 `../marshal/`）；可能与 `null` 不同 |
| 可选 C# 参数未传 | JS 侧为 `undefined`（marshal 分册） |
| `typeof undeclaredVar` | 标准 JS `undefined`；与 ZenTS 无关 |

**禁止**实现为「CLR miss 返回 `undefined`」以兼容松散 JS 习惯。
