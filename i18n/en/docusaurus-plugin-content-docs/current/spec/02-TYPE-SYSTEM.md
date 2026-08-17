:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`02-TYPE-SYSTEM.md`）
:::

﻿---
sidebar_position: 3
title: "类型系统"
---

# 02 — 类型系统

> JS 侧访问 C# **类型、成员与构造** 的规范。适用于 **Il2Cpp（Player）** 与 **Mono（Editor）**。
> 脚本推荐 **`import { T } from "csharp:…"`**（§2.11）；`CSharp[assembly][typeFullName]` 为权威低层路径。
> **成员属性分派** → [metatable/](/docs/spec/metatable/)
> **参数 Marshal（Push/Pop）** → [marshal/](/docs/spec/marshal/)

**平台原则：** Il2Cpp 侧重零 GC 与 direct `methodPointer`；Mono 可反射 / Emit，但 **JS 可见语义必须与 Il2Cpp 一致**。

---

## 1. 设计目标

| 目标 | 说明 |
|------|------|
| 统一入口 | 普通类型经 `CSharp` 根对象懒加载；脚本推荐 `import { T } from "csharp:…"`（§2.11），与 `CSharp` **解析到同一类型对象** |
| 语义贴近 C# | `Type.staticMethod()`、`obj.instanceMethod()`、`new Type(...)` |
| 静实例隔离 | 静态与实例使用 **独立** 元数据与三表 |
| 仅 public | JS 仅可访问 `public` 成员 |
| Bind 期扁平继承 | 静/实例成员均在 **EnsureBinding** 写入当前类型三表；**无**运行时沿继承链查找 |
| 属性 miss | 读/写未注册成员 → **`throw Error('zents: …')`**（见 [metatable/02-INDEX.md](./metatable/02-INDEX.md)） |
| 方法 this | `obj.Method(args)` 作为 **方法调用** 时自动传入 CLR `this`；提取函数 **不** 自动绑定 |

---

## 2. 类型命名与解析

### 2.1 `CSharp` 根对象

```
CSharp                          -- 全局对象，属性 miss → 懒加载程序集
  └─ {assemblyName}             -- 程序集对象
       └─ {typeFullName}         -- 类型对象（§3）
```

**程序集名**为简单名（不含 `.dll`），如 `Assembly-CSharp`、`mscorlib`。

```javascript
CSharp.AC = CSharp['Assembly-CSharp'];   // 可选别名
```

脚本侧 **推荐** 使用 `import { T } from "csharp:…"`（§2.11），不必经过全局 `CSharp`。`CSharp` 仍是权威低层入口（调试、嵌套类型、adaptor）。

### 2.2 类型访问语法

#### 无命名空间（全局命名空间）

合法标识符时可用点号：

```javascript
CSharp.AC.Demo
CSharp['Assembly-CSharp'].Demo
```

#### 含命名空间（强制括号）

**禁止** `CSharp.AC.MyGame.UI.Panel`；须整段 `typeFullName` 为键：

```javascript
CSharp.AC['MyGame.UI.Panel']
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

**规则：** namespace 中的 `.` 属于 **字符串键**，不是 JS 对象路径。

#### 程序集名含特殊字符

```javascript
CSharp['Assembly-CSharp']['MyGame.UI.Panel']
```

| 场景 | 写法 |
|------|------|
| 无 namespace + 合法标识符 | `CSharp.{asm}.{TypeName}` |
| **有 namespace** | `CSharp.{asm}['Ns.Type']` **必须** |
| **嵌套类型** | `CSharp.{asm}['Outer+Inner']` **必须**（`+` 分隔） |
| 含 `-`、`+`、`` ` `` 等 | 对应段用 `['...']` |

### 2.3 命名空间与嵌套类型

- **命名空间：** `MyGame.UI.Panel` → namespace `MyGame.UI`，类名 `Panel`
- **嵌套类型：** `{OuterFullName}+{NestedClassName}`，与 `Type.FullName` 一致

```javascript
CSharp.AC['TopClass+NestedClass']
CSharp.AC['MyGame.UI.Outer+Inner']

// 禁止用 '.' 连接嵌套层：
// CSharp.AC['Outer.Inner']   ✗
```

类型对象内部槽 `[[FullName]]` 存上述字符串；native **不做** `.` ↔ `+` 转换。

### 2.4 类型实参（typeArg）

用于 `zents.make_generic_type`、`make_szarray_type` 等（见 `05-LIB.md`）。

| 形式 | 说明 |
|------|------|
| `CSharp[assembly][typeFullName]` 或 `csharp:` named export | 类型对象（二者 identity 相同，§2.11） |
| `zents.make_generic_type` / `make_szarray_type` / `make_mdarray_type` 返回值 | intern 类型对象 |
| mscorlib **字符串** | 如 `"System.Int32"`；**仅** corlib |
| `zents.types.*` | mscorlib 全名常量 |

**禁止：** 任意普通 JS object、非 ZenTS exotic object、`zents.typeof(...)` 返回值作为 `make_*_type` 的 typeArg（`typeof` 供签名等，见 §2.7）。

### 2.5 泛型类型

```javascript
const ListDef = CSharp.mscorlib['System.Collections.Generic.List`1'];
const List_int = zents.make_generic_type(ListDef, zents.types.int32);

const Dict_str_int = zents.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
    zents.types.string,
    zents.types.int32
);
```

- `genericBaseType`：未闭合定义（含 `` ` `` 与 arity）
- 实参个数须与 arity 一致；相同实参 **intern** 同一类型对象

### 2.6 数组类型

```javascript
const int_arr = zents.make_szarray_type(zents.types.int32);      // int[]
const md_type = zents.make_mdarray_type(zents.types.int32, 2);   // int[,]
```

`rank ≥ 1`；szarray 与 mdarray 为不同类型。

### 2.7 `zents.typeof`

```javascript
// 等价于 C# typeof(Demo) / typeof(List<int>)
const t = zents.typeof(CSharp.AC.Demo);
const ListInt = zents.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zents.types.int32
);
const t2 = zents.typeof(ListInt);   // 闭合泛型 / 数组等任意类型对象均可
```

`typeObject` 为 **任意** ZenTS 类型对象。**返回值** 为该类型的 **`System.Type` 反射对象**（class exotic object），语义对应 C# `typeof(T)`。可供需要 `System.Type` 的 API / 签名场景使用；**不**作为 §2.4 typeArg。

### 2.8 `zents.types` / `zents.get_type_from_name`

见 `05-LIB.md` §4.2、§4.3。`get_type_from_name(typeFullName)` 对标 `System.Type.GetType(string)`，返回类型对象（支持 AQN、泛型、数组）。

### 2.9 类型获取途径

| 途径 | 适用 | 示例 |
|------|------|------|
| `CSharp[assembly][typeFullName]` | class、struct、enum、delegate、interface、嵌套、**未闭合泛型定义** | `CSharp.AC['Outer+Inner']` |
| **`import { T } from "csharp:…"`** | 同上（按程序集 + 命名空间 / 声明类型）；见 §2.11 | `import { Panel } from "csharp:Assembly-CSharp/MyGame.UI"` |
| `zents.get_type_from_name` | 单字符串解析（AQN / 泛型 / 数组） | `zents.get_type_from_name("System.Int32[]")` |
| `zents.make_generic_type` | **闭合泛型** | `List<int>` |
| `zents.make_szarray_type` | `T[]` | |
| `zents.make_mdarray_type` | `T[,…]` | |

**不**经 `CSharp[...]` 或 `csharp:` 模块直接解析：闭合泛型、数组类型（须 `make_*` 或 `get_type_from_name`）。

#### 懒加载

```
CSharp[assemblyName] 属性 miss → 创建程序集对象 → 缓存

assembly[typeFullName] 属性 miss → 解析 Type → EnsureBinding → 缓存
```

| miss | 行为 |
|------|------|
| 程序集不存在 | **`throw Error('zents: assembly not found: {assemblyName}')`** |
| 类型不存在 | **`throw Error('zents: type not found: {typeFullName}')`** |

**禁止**对不存在的程序集 / 类型返回 `undefined`。

`EnsureCSharpRoot` **仅在启动时一次**；之后 C# 侧取得全局 `CSharp` 根对象。

### 2.10 类型对象元数据（解析用）

下列为 **脚本可读** 或 **调试可见** 的约定字段（实现可通过 `Symbol` 或不可枚举属性暴露；键名以 `JsConsts` 为准）：

| 字段 | 说明 |
|------|------|
| `__typeid` | 闭合泛型 / 数组等反查 id |
| `__assembly` | 程序集简单名 |
| `__fullname` | §2.3 规范全名 |
| `__name` | 短名 |
| `__struct` | struct：`true` |
| `__enum` | enum：`true` |
| `__nullable` | `Nullable<T>` 闭合类型：`true` |
| `__byvalInstanceProto` | struct 的 ByVal 实例分派原型；Nullable **无** |
| `__byobjInstanceProto` | ByObj 实例分派原型 |
| `__klass` | native：`Il2CppClass*` / Mono typeId |

### 2.11 `csharp:` 虚拟模块（推荐脚本写法）

> 权威解析仍是 **`CSharp[assembly][typeFullName]`**（§2.1–§2.9）。本节是与之 **identity 等价** 的 ES `import` 语法，不改变 EnsureBinding、三表或 miss 语义。
> Loader 约定见 [01-HOST-API.md](./01-HOST-API.md) §1.3；**不是** [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) 的 `CS.*` 全局链。

脚本推荐：

```javascript
import { MyClass } from "csharp:Assembly-CSharp/foo";
import { Panel } from "csharp:Assembly-CSharp/MyGame.UI";
import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine";
import { Demo } from "csharp:Assembly-CSharp";          // 无命名空间

const panel = new Panel();
```

对应关系：

| `import` | 等价核心路径 |
|----------|----------------|
| `{ MyClass } from "csharp:Assembly-CSharp/foo"` | `CSharp['Assembly-CSharp']['foo.MyClass']` |
| `{ Panel } from "csharp:Assembly-CSharp/MyGame.UI"` | `CSharp['Assembly-CSharp']['MyGame.UI.Panel']` |
| `{ Demo } from "csharp:Assembly-CSharp"` | `CSharp['Assembly-CSharp'].Demo`（全局命名空间） |

#### 2.11.1 Specifier 文法

```
csharp-specifier := "csharp:" assembly [ "/" ns-or-decl ]
assembly         := CLR 程序集简单名（不含 `.dll`；可含 `.` 与 `-`，如 `UnityEngine.CoreModule`、`Assembly-CSharp`）
ns-or-decl       := CLR 命名空间（可含 `.`）
                  | 声明类型的 `typeFullName`（嵌套用 `+`）
                  | 声明类型 `typeFullName` 后接字面量 `+`（强制嵌套模块，见 §2.11.3）
```

| 规则 | 说明 |
|------|------|
| 前缀 | **必须** 为 `csharp:`（保留 scheme）。**禁止** 裸 `"Assembly-CSharp"` 以免与业务 `moduleLoader` specifier 冲突 |
| 第一个 `/` | 分隔 **程序集** 与 **路径**；程序集名不得含 `/` |
| 第二个及以后 `/` | **非法** → `throw Error('zents: invalid csharp module specifier: …')`（命名空间用 `.`，不用再切路径段） |
| 无 `/` 或 `/` 后为空 | 该程序集 **全局命名空间**（`Type.Namespace` 为空） |
| 绝对 specifier | `csharp:` 开头 **原样** 作为模块名；`module_normalize` **不得** 按相对路径改写 |
| 大小写 | 与 `CSharp` 根对象相同（CLR 简单名 / 命名空间） |

非法示例：`csharp:`、`csharp:/foo`、`csharp:asm/MyGame/UI`、`csharp:asm/../x`。

#### 2.11.2 模块种类与 named export

每个合法 specifier 对应 **一个** 合成 ES 模块（无 JS 源码；由 loader 创建 C module 或等价物）。**无** default export。

**命名空间模块**（路径不含强制嵌套后缀 `+`，且按 §2.11.3 判定为命名空间）：

- 导出该程序集中、`DeclaringType == null`、且 `Type.Namespace` 等于该路径（全局命名空间则为空）的 **public** 类型。
- named export 名为 §2.11.4 的 **导出名**（通常为 CLR 短名）。
- **不**导出：嵌套类型、闭合泛型、数组类型、无法编码为合法 JS `IdentifierName` 的名字（仍可用 `CSharp[...]`）。

**声明类型模块**（嵌套模块，§2.11.3）：

- 导出该声明类型的 **直接** public 嵌套类型（一层；更深嵌套再以其 `typeFullName` 打开模块）。

同一模块内导出名冲突（编码后相同）→ 模块实例化失败：`throw Error('zents: csharp export name conflict: {name} in {specifier}')`。

#### 2.11.3 命名空间 vs 嵌套类型

C# 允许 `namespace Foo.Bar` 与类型 `Foo.Bar` 并存。解析路径 `P`（不含末尾强制 `+`）时：

| 条件 | 模块种类 |
|------|----------|
| `P` 为空 | 全局命名空间模块 |
| 存在 public 非嵌套类型，其 `Namespace == P` | **命名空间模块**（即使同时存在全名为 `P` 的类型） |
| 否则，且程序集中存在 `typeFullName == P` 的类型 | **声明类型模块**（导出其直接嵌套类型） |
| 否则 | **空模块**（无 named export；程序集必须存在） |

强制声明类型模块：路径以字面量 `+` 结尾（`P` = 去掉末尾 `+` 后的 `typeFullName`）。用于「命名空间 `P` 与类型 `P` 并存」时导入该类型的嵌套类型。

```javascript
import { Baz } from "csharp:Assembly-CSharp/Foo.Bar";     // 命名空间 Foo.Bar 中的 Baz
import { Inner } from "csharp:Assembly-CSharp/Foo.Bar+";  // 类型 Foo.Bar 的嵌套 Inner
import { Deep } from "csharp:Assembly-CSharp/Foo.Bar+Inner+"; // 更深一层
```

**禁止**把嵌套类型挂到外层类型对象的自有属性上（避免与静态成员撞名）。嵌套类型 **只** 经声明类型模块的 named export 或 `CSharp[asm]['Outer+Inner']` 取得。

#### 2.11.4 导出名编码

| CLR 短名 | named export | 说明 |
|----------|--------------|------|
| `Panel`、`Demo` | `Panel`、`Demo` | 合法标识符原样 |
| `` List`1 `` | `List$1` | `` ` `` → `$` |
| `` Dictionary`2 `` | `Dictionary$2` | 同上 |
| 嵌套 `Inner` | `Inner` | 由声明类型模块导出，不是 `Outer+Inner` |

无 arity 糖：**若** 去掉 `` `$N` `` 后缀后的名字在该模块内不与其它 export 冲突，则 **额外** 导出该短名，且与带 `$N` 的 export **同一类型对象**：

```javascript
import { List, List$1 } from "csharp:mscorlib/System.Collections.Generic";
console.assert(List === List$1);
const ListInt = zents.make_generic_type(List, zents.types.int32);
```

同命名空间同时存在 `Foo` 与 `` Foo`1 `` → **不**导出无 arity 的糖名；`` Foo`1 `` 仅 `Foo$1`。`Foo` 仍指向非泛型类型。

开放泛型的 **构造** 仍走 `zents.make_generic_type`（§2.5）；`csharp:` 只提供类型定义对象。

#### 2.11.5 Identity、惰性与 miss

| 项 | 规范 |
|----|------|
| Identity | `import { T }` 得到的对象 **必须** 与 `CSharp[assembly][typeFullName]` **同一引用** |
| 成员绑定 | EnsureBinding 急切度 **不得高于** 取得该类型对象的 `CSharp[...]` 路径 |
| 同模块其它类型 | 静态 `import { Panel }` **只** 物化 `Panel`；**禁止** 因打开该命名空间模块而对未 import 的类型做 EnsureBinding |
| `CSharp` 上 miss | 仍 **throw**（§2.9） |
| `csharp:` 未导出的静态 import | 遵循 **普通 ES 模块** 链接失败（名字不在 export 列表） |
| `import * as ns; ns.Missing` | 标准模块命名空间 → **`undefined`**（**不是** `CSharp` 的 miss throw） |

程序集不存在 → **`throw Error('zents: assembly not found: {assemblyName}')`**（与 `CSharp` 相同），**不得** 交给宿主 `moduleLoader`。

声明类型模块的 `typeFullName` 不存在 → **`throw Error('zents: type not found: {typeFullName}')`**。

#### 2.11.6 Loader 与 `GetFunction`

`csharp:` 由 ZenTS 运行时 **在宿主 `moduleLoader` 之前** 拦截并合成模块，**不得** 把 `csharp:` specifier 传给业务 loader。与第三方原生 C 模块的优先级见 [build/05-NATIVE-MODULES.md](./build/05-NATIVE-MODULES.md)：`csharp:` 为 ZenTS 保留，**禁止** 第三方以同一前缀注册。

`csharp:` 模块的 named export 是 **类型对象**，一般 **不是** 业务 callable。`GetFunction<T>(jsModule, jsExportName)` **不应** 以 `csharp:` specifier 作为脚本入口；若误用，按现有规则因「非 callable」抛 C# 异常。

合成模块 **无** 源码、**无** 相对 `import`；业务模块用绝对 `"csharp:…"` 引用。声明文件如何生成见 [14-TYPESCRIPT.md](./14-TYPESCRIPT.md) §6。

#### 2.11.7 非目标（本节明确不做）

| 项 | 说明 |
|----|------|
| 整程序集短名摊平 | **不** 把 `foo.MyClass` 与 `bar.MyClass` 都导出为 `csharp:asm` 上的 `MyClass`（短名只在同一命名空间 / 同一声明类型内唯一） |
| 命名空间对象链 | **不** 提供官方 `CS.MyGame.UI.Panel`；迁移见 [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) |
| 闭合泛型 / 数组 export | 继续 `zents.make_*` / `get_type_from_name` |
| CommonJS `require` | v1 范围外 |
| 运行时依赖 `.d.ts` | QuickJS **不**加载声明文件。生成契约、入库与 `tsc` 见 [14-TYPESCRIPT.md](./14-TYPESCRIPT.md) |

---

## 3. 类型对象与 exotic 布局

> 三表布局与属性分派算法：[metatable/01-LAYOUT.md](./metatable/01-LAYOUT.md)、[metatable/02-INDEX.md](./metatable/02-INDEX.md)

### 3.1 类型对象（静态门面）

每个 C# 类型对应类型对象 `T` + 静态分派载体 **STO**（Static Type Object dispatch）：

```
T  (类型对象，exotic)
├─ __assembly / __fullname / __name / __typeid / __by*InstanceProto / __klass
├─ StaticField / StaticMethod（经 STO 三表分派）
└─ ...

STO（内部槽 + 三表）
├─ 静态属性 get/set  → method / fieldGetter / fieldSetter 三表
└─ [[Construct]]     → 实例构造 dispatch（enum 无）
```

**通过类型对象仅访问静态成员**；**唯一例外**：`new T(...)` 触发 `[[Construct]]` 构造实例。

### 3.2 实例分派 **IEO**

与 STO **完全独立**：

```
IEO（ByVal 或 ByObj 实例 exotic）
├─ 实例属性 get/set  → 实例三表（Bind 期已含继承成员）
├─ [[Finalize]]      → ByObj：ObjectRegistry；ByVal：struct 释放
├─ length            → 数组（§7.3）
└─ __type            → 指回类型对象 T
```

```
instance exotic object
  [[DispatchProto]] = IEO  -- 门面 = 声明类型 / view
  [[Payload]]       = 对象指针或 struct 拷贝
```

同一托管对象可有多个 exotic object（不同 view）；`zents.cast` 切换门面（`spec/marshal/06-CLASS.md`）。

**禁止**经实例属性分派 **隐式**访问静态成员；须使用类型对象 `T` 访问静态成员（见 §3.3）。

### 3.3 静实例互查

| 引用 | 用途 |
|------|------|
| `T.__byvalInstanceProto` → ByVal IEO | 构造时挂接 |
| `T.__byobjInstanceProto` → ByObj IEO | 构造 class、boxed struct 等时挂接 |
| `instance.__type` → `T` | `typeof`、register_method 域推断 |
| `TypeBinding` | 持有 staticMap、byval/byobj instance map |

### 3.4 延迟初始化（EnsureBinding）

类型 **首次访问** 时完整构建（**仅 public**）：

- 字段、无参/有参 property、方法、构造函数
- **继承链 public 成员扁平写入** 当前类型三表（§5）
- `[JsAlias]` 换名后的最终名（可与其它方法默认名/别名重复，见 overload §5）

### 3.5 枚举

经 `CSharp[...]` 得类型对象 `E`：

- Bind 期：**public static literal** → 类型对象自有属性，值为 **number**（underlying 整型）
- **无** `[[Construct]]` / `_default` / `_ctor`
- 默认跨边界：**number**（`spec/marshal/08-ENUM.md`）；**禁止** bigint
- boxed 实例：**仅** `zents.box(E, value)` → ByObj

```javascript
const Color = CSharp.AC['MyGame.Color'];
console.assert(Color.Red === 0);
const redBox = zents.box(Color, Color.Red);
```

### 3.6 Nullable\<T\>

闭合 `Nullable<T>` 类型对象 `N`：

- `__nullable : true`；**无** `__byvalInstanceProto` / `__byobjInstanceProto` / IEO
- STO **仅** `[[Construct]]` → 构造 **element 类型 `T`** 的有值实参（非 Nullable 包装实例）
- `null` → JS **`null`**（**不是** `undefined`；见 [00-OVERVIEW.md](./00-OVERVIEW.md) §1.4）

```javascript
const NullableInt = zents.make_generic_type(
    CSharp.mscorlib['System.Nullable`1'],
    zents.types.int32
);
CS.Service.Take(NullableInt(42));   // 有值：number
CS.Service.Take(null);              // null
```

### 3.7 struct

类型对象含 `__struct : true`：

```
[[Construct]]  → 有参构造 dispatch → ByVal exotic object
_default()     → 无参 default(T) exotic object（仅 struct，经 STO 静态分派回退）
```

```javascript
const Point = CSharp.AC['MyGame.Point2D'];
const zero = Point._default();
const p = new Point(3, 4);
// 或 Point(3, 4) 若实现支持 callable 构造；规范推荐 new
```

- 实例：**ByVal exotic object**（`spec/marshal/05-STRUCT.md`）
- **无继承**；静态成员不向上查找（值类型无派生静态场景）

---

## 4. 成员暴露规则

### 4.1 可见性

仅 `public` 进入绑定表。`internal` / `protected` / `private` 对 JS 不可见。

### 4.2 字段

| 访问 | 实例 | 静态 |
|------|------|------|
| 读 | `obj.field` | `Type.field` |
| 写 | `obj.field = v` | `Type.field = v` |

只读字段赋值 → 属性 set miss → throw。

### 4.3 属性

| 类型 | JS 访问 |
|------|----------|
| 无参 property | `obj.prop` / `Type.prop`（getter/setter 经三表） |
| 有参 property（含索引器） | **`get_PropName(...)` / `set_PropName(...)`** 方法形式 |

**数组**元素：**`get` / `set` 实例方法**（§7.4），不走 `get_Item` 命名，不用 `arr[i]` 原生下标（数组 exotic object 不实现 `[[Get]]` 整数键）。

### 4.4 方法

见 `04-METHOD-OVERLOAD.md`：单重 → direct function；多重 → dispatch；`[JsAlias]` / `register_method`。

**调用约定：**

```javascript
obj.instanceMethod(a, b);     // ✅ 方法调用：自动传入 CLR this
const f = obj.instanceMethod;
f(a, b);                      // ❌ 提取函数：不自动绑定 this

Type.staticMethod(a, b);      // 静态：无 this
```

### 4.5 事件（无专用对象）

**不提供** Event 子对象 `{ get, set, fire }`。

C# `event` 在 JS 侧暴露为普通 **add / remove** 方法（与编译器生成名一致）：

```javascript
demo.add_ValueChanged((v) => console.log(v));
demo.remove_ValueChanged(handler);
```

若类型提供 `raise`/`invoke` 等 public 方法，按普通方法绑定；**无** `fire` 特殊键。

### 4.6 构造函数

| 类型 | 构造入口 |
|------|----------|
| class / struct | `new Type(...)` → `[[Construct]]`；struct 另有 `Type._default()` |
| enum | **无**；`zents.box` |
| Nullable\<T\> | `N(...)` 或 `new N(...)` → element `T` 的值；null 用 `null` |
| 抽象类 / 接口 | 无 public 构造则 construct throw |

- 构造 **不参与继承**；仅用 **当前类型** 声明的 public 实例构造函数
- **禁止**在类型对象挂与 `[[Construct]]` 等价的 `_ctor` 字段（struct 的 `_default` 除外）

---

## 5. 继承（Bind 期扁平化）

### 5.1 静态成员

静态属性分派在 `staticMap` 未命中时 **不**递归查父类。

为与 C#「可通过派生类型名访问继承 static 成员」一致，在 **EnsureBinding** 将基类 public 静态成员 **扁平复制** 到派生 `staticMap`（派生同名覆盖）。

### 5.2 实例成员（Bind 期扁平化，无运行时 promotion）

**不采用：** 属性 miss 时沿继承链查找并 **提升** 到成员表（promotion）。绑定完成后 miss 即 **throw**。

**现行规范：** 与静态相同，在 **Bind 期** 将基类 public 实例成员（字段、无参 property、方法）**扁平写入** 派生类型的 `byvalInstanceMap` / `byobjInstanceMap` 三表；派生声明 **覆盖** 基类同名项。

运行时属性 get/set：

```
1. 查 methodTable / fieldGetterTable / fieldSetterTable（及 STO 回退）
2. 命中 → 返回或调用
3. 未命中 → throw Error('zents: …')（见 metatable/02-INDEX.md）
```

**无** 步骤「沿继承链查找」或「提升到 instanceMap」。

**虚方法：** 仍通过 bridge 对 **真实实例** 虚派发；Bind 表项指向的子类 override bridge 保证 C# 语义。

### 5.3 方法与 dispatch 的继承

若继承树上同一 `is_static` 域存在多个 public **最终同名**候选（含基类扁平化结果、`[JsAlias]` 撞名），Bind 后该键绑定 **dispatch function**。分派时候选列表含该最终名下全部 applicable 重载；选优规则见 `04-METHOD-OVERLOAD.md` §3.6、§5。

---

## 6. 泛型方法

针对 **方法自身** 带泛型参数，如 `void Foo<T>(T a)`。闭合泛型类上的方法 **不** 走本节。

### 6.1 调用约定

```javascript
// Type.Foo 为 direct generic method function
const foo_int = zents.make_generic_method(Type.Foo, zents.types.int32);
foo_int(obj, value);   // 静态则无需 obj
```

使用 `05-LIB.md` `make_generic_method` 单态化泛型方法 function。

### 6.2 缓存

相同 `(genericMethodBase, typeArgs…)` **intern** 为同一 inflated direct function（Il2Cpp：写入 `NameMetaMap` 内部签名键）。

---

## 7. 数组

### 7.1 创建

```javascript
const arr = zents.new_szarray_by_element_type(zents.types.int32, 10);
const arr2 = zents.new_szarray_by_szarray_type(int_arr_type, 10);
const matrix = zents.new_mdarray_by_spec(zents.types.int32, [0,0], [2,3]);
```

### 7.2 `length`

| 形态 | `arr.length` |
|------|----------------|
| szarray | `Length` |
| mdarray | `∏ GetLength(d)`（可寻址元素总数） |

各维长度仍用 `GetLength(dimension)`。

### 7.3 元素访问：`get` / `set`

**不** 实现 `arr[i]` 整数键访问（exotic object 不对 CLR 下标做 `[[Get]]`/`[[Set]]`）。

```javascript
arr.set(0, 10);
const v = arr.get(0);

matrix.set(0, 1, 7);
const x = matrix.get(0, 1);
```

| API | 说明 |
|-----|------|
| `get` | 实参个数 = `rank`；返回元素类型的 JS 形态（基元未装箱） |
| `set` | 前 `rank` 个为 **C# 下标**（含 lowerBound），最后一参为 value |

与 `zents.to_array` 的 **0 基** JS Array 不同（`05-LIB.md` §8.4）。

### 7.4 互转

| API | 说明 |
|-----|------|
| `zents.to_bytes` | blittable 元素 szarray → 按内存字节拷贝为 `Uint8Array` / binary string（实现二选一，须文档化） |
| `zents.to_array` | szarray → JS `Array`（0..n-1 连续索引） |

---

## 8. 特殊类型概要

| 类型 | 说明 |
|------|------|
| 接口 | 可解析；不可构造（无 public 构造） |
| 抽象类 | 仅 public 构造可 `new` |
| 静态类 | 仅静态成员；无 `[[Construct]]` |
| 枚举 | §3.5；`spec/marshal/08-ENUM.md` |
| Nullable\<T\> | §3.6 |
| 委托 | 类型对象 + 实例 IEO `[[Call]]`；`spec/marshal/09-FUNCTION.md` |
| struct | §3.7；`spec/marshal/05-STRUCT.md` |
| class | ByObj；`spec/marshal/06-CLASS.md` |

---

## 9. Mono / Il2Cpp 一致性

| 项 | 要求 |
|----|------|
| `CSharp` 路径与 `typeFullName` | 一致 |
| `csharp:` specifier / 导出名 / identity | 一致 |
| 静实例隔离 | 一致 |
| Bind 期继承扁平化 | 一致 |
| 属性 miss → throw | 一致 |
| Event → add_/remove_ | 一致 |
| 构造、dispatch、泛型方法 | 一致 |
| 数组 `length`、`get`/`set` | 一致 |
| 方法 this 绑定规则 | 一致 |
| 错误消息 | 一致或等价（`zents:` 前缀） |

---

## 10. 示例

```javascript
import { Demo } from "csharp:Assembly-CSharp";
import { Panel } from "csharp:Assembly-CSharp/MyGame.UI";
import { Point2D } from "csharp:Assembly-CSharp/MyGame";
import { List } from "csharp:mscorlib/System.Collections.Generic";

const demo = new Demo();
const panel = new Panel();

const p = new Point2D(3, 4);
const zero = Point2D._default();

const ListInt = zents.make_generic_type(List, zents.types.int32);
const list = new ListInt();

demo.add_Changed(() => {});

const arr = zents.new_szarray_by_element_type(zents.types.int32, 4);
arr.set(0, 42);
```

等价的低层写法（调试、嵌套类型、adaptor 内部仍可用）：

```javascript
CSharp.AC = CSharp['Assembly-CSharp'];

const demo = new CSharp.AC.Demo();
const panel = new CSharp.AC['MyGame.UI.Panel']();
const Inner = CSharp.AC['MyGame.UI.Outer+Inner'];
```

---

## 11. 实现落点

| 主题 | Il2Cpp | Mono |
|------|--------|------|
| 类型懒加载 | `TypeRegistry` | `JsMonoAppDomain` / MetaBinding |
| `csharp:` 虚拟模块 | `JsLoader` 拦截 + `JS_NewCModule`（或等价） | 同等：`JS_SetModuleLoaderFunc` 链，**先于** 宿主 `moduleLoader` |
| 三表 indexer | `MetaBinding` / `Dispatch*` | exotic internal slots + JS 回调 |
| 继承扁平 | `MetaBinding::EnsureBinding` | `MetaBinding.cs` |
| 数组 get/set | `ArrayMarshal` + instance map | 等价绑定 |

细节见 `impl/IL2CPP.md`、`impl/MONO.md`。
