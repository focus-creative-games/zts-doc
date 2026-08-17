---
sidebar_position: 18
title: "Exotic 布局"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`metatable\01-LAYOUT.md`）
:::


# 01 — Exotic 布局

本文档规定 ZenTS 在 JavaScript 侧暴露的**类型对象**、**静态分派载体（STO）**与**实例分派载体（IEO）**的结构。所有内部槽键名与 `JsConsts.h`（或 `JsConsts.cs`）一致；JS 脚本通过成员访问、`typeof`、构造等 API 间接依赖这些布局，但不应依赖 native 实现细节（如 Dispatch 闭包、三表内存布局等——见 `impl/metatable/`）。

**关联文档：** 属性分派算法 → [02-INDEX.md](./02-INDEX.md)；注册期规则 → [03-BINDING.md](./03-BINDING.md)；特殊类型 → [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)；类型解析与 `CSharp` 路径 → [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md)。

---

## 1. 总体模型

每个已绑定的 C# 类型在 JS 中对应一个 **类型对象** `T`（exotic object）。`T` 是访问**静态成员**的门面：脚本写 `Type.StaticField`、`Type.StaticMethod()` 时，实际经由 **STO** 上的属性 get/set 分派。

**实例成员**挂在 **实例 exotic object** 上。引用类型（class、interface、数组、委托、boxed enum 等）仅使用 **ByObj** 形态的 exotic object 与一套 **ByObj IEO**。值类型 struct 同时支持 **ByVal**（payload 在内部槽）与 **ByObj**（boxed `Il2CppObject*`）两种 exotic object，各挂接**独立**的实例分派原型；二者共享同一套成员名集合，但 bridge 在解析 `this` 时策略不同（摘要见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)，细节见 `../marshal/05-STRUCT.md`）。

静态绑定与实例绑定在注册期各自构建**独立的三张成员表**（`methodTable`、`fieldGetterTable`、`fieldSetterTable`，见 [02-INDEX.md](./02-INDEX.md)）。三表作为 exotic object **内部槽**或 registry 引用持有，**不**作为普通 enumerable 属性挂在 `T` 或实例对象上，避免用户脚本误改分派表。

类型在**首次被访问**时通过 `EnsureBinding` 完整构建分派原型与成员表（延迟绑定），而非启动时全量注册。

**与 Proxy 的关系：** 规范 **不** 要求使用 ECMAScript `Proxy` 实现上述分派。实现 **必须** 使用 QuickJS **exotic object**（或等价 native 对象类）配合 **internal slots** 完成 `[[Get]]` / `[[Set]]` / `[[Call]]` / `[[Construct]]` 语义。若实现内部使用 Proxy 作为辅助，**不得**改变本文规定的 JS 可见行为。

---

## 2. 类型对象 `T`

类型对象是一张 **exotic object**，承载类型身份元数据，并作为静态成员访问的 `receiver`（静态 field getter 的 `obj` 参数为 `T`）。下列键来自 `JsConsts` 及绑定约定（脚本侧只读访问方式由实现定义，键名须稳定）：

| 键 / 槽 | 常量 | 说明 |
|---------|------|------|
| `__fullname` | `JsConsts::FullName` | JS 规范类型全名（含 namespace、`+` 嵌套分隔，与 CLR `Type.FullName` 对齐） |
| `__klass` | `JsConsts::Klass` | 实现用：指向 native 类型描述（Il2Cpp 为 `Il2CppClass*` 句柄；Mono 为等价 type id） |
| `__byvalInstanceProto` | `JsConsts::ByValInstanceProto` | struct 的 ByVal 实例分派原型；**仅 struct** 存在 |
| `__byobjInstanceProto` | `JsConsts::ByObjInstanceProto` | ByObj 实例分派原型：class、struct boxed、enum boxed、数组、委托等 |
| `__struct` | `JsConsts::Struct` | 仅 struct：`true` |
| `__enum` | `JsConsts::Enum` | 仅 enum：`true` |
| `__nullable` | `JsConsts::Nullable` | 仅 `Nullable<T>` 闭合类型：`true`；与 `__struct` / `__enum` **互斥** |

类型族标记（`__struct` / `__enum` / `__nullable`）至多出现一个，供脚本与 API 区分构造入口与实例形态。

**不在类型对象上重复挂载**与 STO 三表重复的 method / getter 键，以免出现「直查 `T`」与「走属性分派」双路径。枚举 public 常量、`RegisterStaticLiteralFields` 写入的字面量等例外：可直接作为 `T` 的普通属性存在（读 `E.Red` 时若键已在 `T` 上则不走分派表）。

类型对象的 **静态分派** 经内部槽 **STO** 完成（概念上等价 ZLua SMT）。静态成员读写一律经 STO 的属性 get/set，不得把静态成员混入实例 exotic object 的分派表。

**禁止**在 `T` 上注册与 `[[Construct]]` 等价的 `_ctor` 字段；class / struct 带参构造仅通过 `new Type(...)` 触发（见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)）。

---

## 3. 静态分派 STO

每个类型对象对应唯一一套静态分派状态，与实例分派**完全隔离**。

```
STO（内部槽，挂于 T）
├─ [[Get]] / [[Set]]  → 静态成员 indexer（引用 static methodTable, fieldGetterTable, fieldSetterTable）
├─ [[Construct]]      → 实例构造 dispatch（class / struct；Nullable 见 §4；enum **无**）
├─ [[Default]]        → 可选；**仅 struct** 的无参默认实例 callable（键名 JsConsts::Default，脚本见 `_default`）
└─ toString           → 可选；默认返回类型 __fullname
```

`[[Construct]]` 与 `_default` **不**进入三表。静态属性 get 在三表均未命中时，须能回退到 STO 保留键（例如取 `_default` callable），再未命中则 **throw**（见 [02-INDEX.md](./02-INDEX.md)）。

enum 的 STO 提供 **`[[Get]]` / `[[Set]]`**（静态三表），但 **无 `[[Construct]]`**、**无 `_default`**（见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)）。

Nullable 的 STO **仅** 含 **`[[Construct]]`**（构造 element 类型 `T` 的值），**无**静态成员 `[[Get]]`/`[[Set]]`（见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)）。

---

## 4. 实例分派 IEO

实例 exotic object 通过内部槽 `[[DispatchProto]]` 指向声明类型（或 view 类型）对应的 **IEO 分派原型**。布局如下（键名均来自 `JsConsts`）：

```
IEO（ByVal 或 ByObj 分派原型）
├─ [[Get]] / [[Set]]  → 实例 indexer（引用 instance methodTable, fieldGetterTable, fieldSetterTable）
├─ [[Finalize]]       → 释放 exotic object 生命周期跟踪（ByVal 非 blittable struct、ByObj 引用等）
├─ __type             → 指回类型对象 T（静实例互查）
├─ __zents_ud_kind      → "byval" | "byobj"（JsConsts::UdKindByVal / UdKindByObj）
├─ toString           → 可选（如 boxed struct / enum 走 Object.ToString）
├─ length             → 可选（**数组** szarray / mdarray，见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)）
└─ [[Call]]           → 可选（**仅委托** ByObj exotic object，见 [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md)）
```

### 4.1 ByVal 实例分派（`T.__byvalInstanceProto`）

- 适用于 struct 的 **ByVal exotic object**（payload 内嵌于 `[[Payload]]` 槽）。
- `__zents_ud_kind` 为 `"byval"`。
- 实例 indexer 使用的三表与 ByObj 侧**成员名集合相同**，但 getter / setter / method bridge 按 ByVal 解析 `this`（指向 payload，不含 object header）。
- blittable struct 可无 `[[Finalize]]`；含托管引用字段的 struct 须注册 finalize。

### 4.2 ByObj 实例分派（`T.__byobjInstanceProto`）

- 适用于：class 实例、struct 的 boxed 实例、boxed enum、`System.Array` 派生数组、委托等。
- `__zents_ud_kind` 为 `"byobj"`。
- indexer 按 ByObj 规则解析 `this`（`Il2CppObject*` / 等价 GCHandle）。
- class 仅挂接此一套 IEO（**无** `__byvalInstanceProto`）。
- struct 除 ByVal IEO 外**另建** ByObj IEO；enum 仅有 ByObj IEO（供 `zents.box` 产物）。
- 委托在 ByObj IEO 上额外挂 `[[Call]]`，使 `delegate(arg1, …)` 直接 invoke。

**禁止**在实例 exotic object 根上重复挂载与三表同名的成员键。实例对象 **不得**通过属性 get **隐式**访问静态成员；须使用类型对象 `T`（见 [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §3.3）。

---

## 5. 静实例互查

类型首次绑定时建立下列引用，之后不变：

| 引用 | 用途 |
|------|------|
| `T.__byvalInstanceProto` → ByVal IEO | 构造 / push ByVal struct exotic object 时挂接分派原型 |
| `T.__byobjInstanceProto` → ByObj IEO | 构造 class、boxed struct、boxed enum、数组等时挂接分派原型 |
| `instance.__type` → `T` | 从实例反查类型、`zents.typeof`、重载注册等 |

同一托管对象可因 **view 类型**不同而对应不同 `T` / IEO，但 identity 仍为同一实例；`zents.cast` 用于切换门面（Marshal 见 `../marshal/06-CLASS.md`）。

---

## 6. 注册顺序

创建类型对象时 native 侧须遵循下列顺序，避免先挂接 STO 再写入实例分派字段而触发静态 `[[Set]]`：

1. 创建空类型对象 `T`，写入 `__fullname`、`__klass` 及类型族标记。
2. 构建 **ByVal IEO**（若适用）及其实例三表，写入 `T.__byvalInstanceProto`。
3. 构建 **ByObj IEO** 及其实例三表，写入 `T.__byobjInstanceProto`。
4. 构建 **STO** 及静态三表，挂接静态分派。

enum 常量等可直接写入 `T` 的步骤可在挂接 STO 之前或之后，但须在类型对象对脚本可见之前完成。

---

## 7. 实例分派键（现行）

规范以 **`__byvalInstanceProto` / `__byobjInstanceProto`** 区分 struct 双形态；引用类型仅暴露 `__byobjInstanceProto`。`Nullable<T>` **不**挂接任何实例分派字段。键名以 `JsConsts` 为准。

---

## 8. 延迟绑定 `EnsureBinding`

`EnsureBinding(klass)` 在类型**第一次**需要成员分派或构造原型时执行：扫描 public 成员、沿继承链扁平化写入静/实例三表（见 [03-BINDING.md](./03-BINDING.md)），创建 STO / IEO 并建立 §5 互查引用。未闭合泛型定义、含未绑定泛型参数的类型的绑定策略由类型系统分册规定；本目录仅要求：**一旦绑定完成，JS 可见布局与索引语义稳定且与本文一致**。

---

## 9. QuickJS 对象模型映射（实现参考）

下列映射 **不** 增加脚本可见 API，仅供实现者对齐 QuickJS：

| 规范概念 | QuickJS 实现选项 |
|----------|------------------|
| 类型对象 `T` | 自定义 `JSClass` exotic object |
| STO `[[Get]]`/`[[Set]]` | class 级 `get_own_property` / `set_property` 或等价钩子 |
| 实例 exotic object | 另一 `JSClass`；`[[DispatchProto]]` 指向 IEO 的三表 |
| `[[Construct]]` | 类型对象 class 的 `call`/`construct` 钩子 |
| 三表 | `JSValue` 对象引用存于 `opaque` / side table |

无论采用何种钩子组合，**JS 可见语义**须与 [02-INDEX.md](./02-INDEX.md) 一致。
