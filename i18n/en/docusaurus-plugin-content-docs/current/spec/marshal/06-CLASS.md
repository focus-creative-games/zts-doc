---
sidebar_position: 12
title: "Class / Interface Marshal"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\06-CLASS.md`）
:::


# Class / Interface Marshal

> **规范性：** 引用类型（`class`、`interface`、`string`、数组实例、delegate 实例等）在 JavaScript 与 C# 之间的默认 Marshal 规则。
> **相关：** 类型对象与成员 → [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md)；`ref`/`out`/`in` → [03-BYREF.md](./03-BYREF.md)；`[TsMarshalAs]` → [02-MARSHAL-AS.md](./02-MARSHAL-AS.md)；`zts.cast` → [../05-LIB.md](../05-LIB.md)。

**平台原则：** Mono 与 Il2Cpp **JS 可见语义一致**；class 实例默认 **ObjectRegistry 槽位 + GC root**（Il2Cpp：`Il2CppObject*`）。

---

## 1. 默认 Marshal（概要）

| 方向 | JS 形态 | 说明 |
|------|---------|------|
| **C# → JS** | **ByObj exotic** | 引用身份；**IEO 门面 = 声明类型**（§2） |
| **JS → C#** | ByObj exotic 或 **`null`** | 校验可赋值；**`undefined`** 对必选引用 → **throw**（[01-OVERVIEW.md](./01-OVERVIEW.md) §2） |
| **`string`** | **`string`** 或 **`null`** | **仅声明类型为 `string`** |
| **`object`**（运行时 `string`） | **ByObj exotic**（`System.Object` 门面） | **不** 改为 JS string |
| **`interface`** | 同 class | 门面 = **接口声明类型** |
| **数组** | ByObj exotic | [07-ARRAY.md](./07-ARRAY.md) |
| **Delegate** | function 或 Delegate exotic | [09-FUNCTION.md](./09-FUNCTION.md) |

ByObj exotic 为 QuickJS **exotic object** + **IEO 三表**；与 OpaqueValue、Pointer 不同。

---

## 2. 声明类型门面（View / Identity）

| 概念 | 含义 |
|------|------|
| **Identity** | exotic 载荷的托管对象引用（运行时实际实例） |
| **View / 门面** | **IEO** 与成员可见性；**唯一来源 = 本次 Marshal 的声明类型** |

### 2.1 规则

1. **C# → JS**：按 **声明类型** 选 IEO；**不**因运行时类型改挂或改走特殊 Marshal。
2. **虚方法**：查找用声明类型 `MethodInfo`；调用对真实 `this` **虚派发**。
3. **非虚 / `new` 隐藏**：走声明类型槽位。
4. **Downcast**：仅 `zts.cast(obj, targetType)`；返回 **新 exotic**（同 identity、新门面）。
5. **缓存**：键 **`(identity, viewType)`**；`ObjectRegistry` 登记为 **GC root**（[../10-LIFETIME.md](../10-LIFETIME.md)）。

### 2.2 示例

```csharp
Base CreateChild() => new Child();
```

```javascript
const o = ObjectFactory.CreateChild();  // 门面 Base
const c = zts.cast(o, Child);             // 门面 Child（须 IsAssignableFrom）
```

### 2.3 `object` 形参

| 项 | 规则 |
|----|------|
| Push | **ByObj exotic**，门面 **`System.Object`** |
| Pop | 接受 boolean / number / string / exotic 等 |
| 运行时 `string` | 仍为 Object exotic，**不是** JS string |

`Nullable<T>`（T 引用类型）：`null` ↔ **`null`**；有值同 class 规则。

---

## 3. `Table` / `UnpackedValues`

**class / interface 不允许**（[02-MARSHAL-AS.md §3](./02-MARSHAL-AS.md)）。误标 → Mono 回退 / Generate 失败。

---

## 4. Interface Marshal

| 项 | 规则 |
|----|------|
| 默认 | **ByObj exotic**；门面 = **接口类型** |
| `null` | ↔ **`null`** |
| `[TsMarshalAs]` | `Object`、`OpaqueValue`（C#→JS） |
| 成员 | 仅接口 + 继承接口可见成员 |

---

## 5. `ref` / `out` / `in` 引用类型（JS → C#）

见 [03-BYREF.md](./03-BYREF.md)。

| JS 实参 | 行为 |
|---------|------|
| **OpaqueValue**（兼容） | handle 地址 |
| **exotic** / JS `string` / **`null`** / 其它 Pop 形态 | → **临时槽** → 临时地址 |
| **`undefined`** | 必选 → **throw** |

### 5.1 写回

| C# 操作 | JS（临时槽路径） |
|---------|------------------|
| `refParam = other`（rebind） | **不可见** |
| 可变对象原地修改 | **可见** |
| `ref string` 赋新串 | **不可见** |

```javascript
let s = "hello";
CS.Demo.ChangeString(s);   // s 仍为 "hello"

const sb = new StringBuilder("hi");
CS.Demo.Append(sb, "!");   // 共享引用
```

### 5.2 C# → JS

`ref`/`out`/`in` 默认 **OpaqueValue**（[04-OPAQUE.md](./04-OPAQUE.md)）。

---

## 6. `string` Marshal 补充

| 声明类型 | C# → JS | JS → C# |
|----------|---------|---------|
| **`string`** | JS **string** | JS **string** 或 **`null`** |
| **`object`**（运行时 string） | Object exotic | object Pop |
| **`[TsMarshalAs(Object)]`** | ByObj exotic（托管 String 对象） | exotic 路径 |

`[TsMarshalAs(Bytes)]` 用于 **`byte[]`**，不是 `System.String`。

---

## 7. 方法 `this` 绑定（与 Marshal 交叉）

```javascript
demo.setX(1);              // ✅ 方法调用：自动 CLR this
const fn = demo.setX;
fn(1);                     // ❌ 提取的函数不绑定 this；throw 或未定义（须一致且可诊断）
```

提取的 function **不** 自动绑定 CLR `this`（[../00-OVERVIEW.md](../00-OVERVIEW.md) §6）。

---

## 8. Mono / Il2Cpp 一致性

Push/Pop、`(identity, viewType)`、`zts.cast`、C#→JS byref Opaque、错误消息（`zts:` 前缀）— **须一致**。

---

## 9. 相关文档

| 文档 | 内容 |
|------|------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | 矩阵、undefined/null |
| [03-BYREF.md](./03-BYREF.md) | byref |
| [04-OPAQUE.md](./04-OPAQUE.md) | Opaque |
| [07-ARRAY.md](./07-ARRAY.md) | 数组 |
| [09-FUNCTION.md](./09-FUNCTION.md) | Delegate |
| [../metatable/](/docs/spec/metatable/) | 三表分派 |
| [../05-LIB.md](../05-LIB.md) | cast、box |
