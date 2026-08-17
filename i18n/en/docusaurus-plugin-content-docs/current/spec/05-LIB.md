---
sidebar_position: 5
title: "`zents` 标准库"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`05-LIB.md`）
:::


# 05 — `zents` 标准库

> 全局 **`zents`** 表的 JavaScript API。
> 源码：`Packages/.../ZenTS~/jslib/zentslib.js`（或等价路径）
> Native：`libil2cpp/zents/lvm/ZenTSLib.cpp`（`RegisterGlobals`）

初始化时 native 注册 `__zents_*` 内部 hook，再加载 `zentslib.js` 封装为 `zents.*`。

**相关：** 类型访问 → [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md)；重载 → [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md)；Marshal → [marshal/](/docs/spec/marshal/)；`zents.d.ts` → [14-TYPESCRIPT.md](./14-TYPESCRIPT.md)。

---

## 1. 职责边界

| 层级 | 职责 |
|------|------|
| **`CSharp`** | 程序集 / 类型懒加载；静态成员；`new Type(...)`；权威低层路径 |
| **`csharp:` 模块** | 推荐的 ES `import`；named export 为类型对象，identity 同 `CSharp` |
| **`zents`** | 类型构造辅助、opaque、装箱、数组、delegate、方法别名注册 |
| **实例 exotic object** | 成员经 **三表 / IEO** 访问，**不经** `zents` |

`zents` **不**替代 `CSharp` / `csharp:` 访问类型。

---

## 2. 加载

```javascript
// zentslib.js 初始化
globalThis.zents = globalThis.zents ?? {};
```

Il2Cpp：脚本嵌入 `BuiltinScripts.inc`；Mono：Resources 或同等路径。**内容须与 `zentslib.js` 同步。** 编辑期类型见包内 `ZenTS~/types/zents.d.ts`（[14-TYPESCRIPT.md](./14-TYPESCRIPT.md)）。

与 **`CSharp`** 同在域内主 **`JSContext`** 全局对象上暴露（[10-LIFETIME.md](./10-LIFETIME.md) §6）。

---

## 3. 类型实参（`typeArg`）

| 形式 | 示例 |
|------|------|
| `zents.types.*` | `zents.types.int32` |
| `CSharp` 类型对象 | `CSharp.mscorlib['System.Int32']` 或 `import { Int32 } from "csharp:mscorlib/System"` |
| `make_*_type` 返回值 | 闭合泛型 / 数组类型对象 |
| `zents.get_type_from_name` | 见 §4.3 |
| **类型名字符串** | 与 `get_type_from_name` 的 `name` 相同（对标 `Type.GetType`） |

`zents.typeof(typeObject)` 返回 **`System.Type` 反射对象**（ByObj exotic），**不**作为 `make_*_type` 的 typeArg（[02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.4）。

---

## 4. 类型查询

### 4.1 `zents.typeof`

```javascript
zents.typeof(typeObject) → System.Type exotic
```

| 参数 / 返回 | 说明 |
|-------------|------|
| `typeObject` | 任意 ZenTS 类型对象 |
| **返回值** | `System.Type` 实例（反射对象） |

```javascript
const intType = zents.typeof(CSharp.mscorlib['System.Int32']);
const ListInt = zents.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zents.types.int32
);
const t2 = zents.typeof(ListInt);
```

**Native：** `__zents_typeof`

### 4.2 `zents.types`

`zentslib.js` 预置常量（mscorlib 全名）：

| 键 | CLR 全名 |
|----|----------|
| `void` | `System.Void` |
| `bool` | `System.Boolean` |
| `char` | `System.Char` |
| `byte` / `sbyte` | `System.Byte` / `System.SByte` |
| `short` / `ushort` | `System.Int16` / `System.UInt16` |
| `int` / `int32` | `System.Int32` |
| `uint` | `System.UInt32` |
| `long` / `ulong` | `System.Int64` / `System.UInt64` |
| `float` | `System.Single` |
| `double` | `System.Double` |
| `intptr` / `uintptr` | `System.IntPtr` / `System.UIntPtr` |
| `decimal` | `System.Decimal` |
| `object` | `System.Object` |
| `string` | `System.String` |

### 4.3 `zents.get_type_from_name`

```javascript
zents.get_type_from_name(typeFullName) → typeObject
```

按名称解析 CLR 类型；失败 → **`throw Error('zents: type not found: …')`**（**不得** 返回 `undefined`）。

| 参数 | 说明 |
|------|------|
| `typeFullName` | 对标 **`System.Type.GetType(string)`**（AQN、泛型、数组等） |

```javascript
const Int32 = zents.get_type_from_name("System.Int32");
const Demo = zents.get_type_from_name(
    "Demo, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
);
const ListInt = zents.get_type_from_name(
    "System.Collections.Generic.List`1[[System.Int32, mscorlib]]"
);
```

**Native：** `__zents_get_type_from_name`

---

## 5. 泛型类型

### 5.1 `zents.make_generic_type`

```javascript
zents.make_generic_type(genericBaseType, typeArg1, ...) → typeObject
```

| 参数 | 说明 |
|------|------|
| `genericBaseType` | 未闭合泛型定义（含 `` ` `` arity） |
| `typeArg…` | 个数须与 arity 一致 |

相同实参 **intern** 同一类型对象。

**Native：** `__zents_make_generic_type`

---

## 6. Opaque 读写

见 [marshal/04-OPAQUE.md](./marshal/04-OPAQUE.md)。

### 6.1 `zents.get_opaquevalue` / `zents.set_opaquevalue`

```javascript
zents.get_opaquevalue(opaque_handle) → value
zents.set_opaquevalue(opaque_handle, new_value)
```

| API | 说明 |
|-----|------|
| `get_opaquevalue` | 按默认 C#→JS 规则返回值；byref 先解引用 |
| `set_opaquevalue` | 按默认 JS→C# 写回槽 |
| 生命周期 | 仅当前 C#→JS 调用未返回期间 |
| 失效 | **`throw Error('zents: invalid opaque parameter handle')`** |

**Native：** `__zents_get_opaquevalue` / `__zents_set_opaquevalue`

---

## 7. 装箱 / 拆箱 / 转换

### 7.1 `zents.box`

```javascript
zents.box(typeArg, value) → byObjExotic
```

| 参数 | 说明 |
|------|------|
| `typeArg` | **值类型**（基元、enum、struct）；引用类型 → **throw** |
| `value` | 基元 / enum `number`、ByVal exotic 等 |

**Native：** `__zents_box`

### 7.2 `zents.unbox`

```javascript
zents.unbox(boxedValue) → value | byValExotic
```

参数须 **ByObj exotic**（boxed）。基元 → boolean/number；enum → number；struct → ByVal exotic。

**Native：** `__zents_unbox`

### 7.3 `zents.cast`

```javascript
zents.cast(obj, targetType) → exotic
```

| 参数 | 说明 |
|------|------|
| `obj` | ByObj class exotic |
| `targetType` | 类型对象或 typeArg |

同一 identity，**IEO 门面 = targetType**。见 [marshal/06-CLASS.md](./marshal/06-CLASS.md)。

**Native：** `__zents_cast`

### 7.4 `zents.to_user_data`（opaque → ByVal 拷贝）

```javascript
zents.to_user_data(opaque_handle) → byValExotic
```

将 **OpaqueValue** **拷贝** 为 ByVal struct exotic（长生命周期）。见 [marshal/05-STRUCT.md](./marshal/05-STRUCT.md)。

**Native：** `__zents_to_user_data`

---

## 8. 数组

与 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §7 一致。

### 8.1 数组类型

```javascript
zents.make_szarray_type(typeArg) → szarrayTypeObject
zents.make_mdarray_type(typeArg, rank) → mdarrayTypeObject   // rank ∈ [1, 32]
```

**Native：** `__zents_make_szarray_type` / `__zents_make_mdarray_type`

### 8.2 数组实例

```javascript
zents.new_szarray_by_element_type(typeArg, length) → szarrayExotic
zents.new_szarray_by_szarray_type(szarrayTypeObject, length) → szarrayExotic

zents.new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) → mdarrayExotic
zents.new_mdarray_by_spec(typeArg, lowbounds, sizes) → mdarrayExotic
```

| 参数 | 说明 |
|------|------|
| `length` | ≥ 0 |
| `lowbounds` / `sizes` | **JS Array**（0..rank-1 下标） |

元素初始化为 `default(T)`。szarray 支持 **`arr.length`**。

**Native：** `__zents_new_szarray_by_element_type` 等

### 8.3 `zents.to_bytes`

```javascript
zents.to_bytes(szarray) → Uint8Array | string
```

将 **一维 szarray** 托管内存按 **原始字节布局** 拷贝。

| 约束 | 说明 |
|------|------|
| 输入 | **仅** szarray exotic |
| 元素 | **blittable**（基元或仅 blittable 字段的 struct） |
| **不接受** | `bool[]`、`char[]`、含引用字段的元素 → **throw** |
| 输出 | `Uint8Array` 或 binary string（实现二选一，须文档化） |

**Native：** `__zents_to_bytes`

### 8.4 `zents.to_array`

```javascript
zents.to_array(szarray) → Array
```

| 约束 | 说明 |
|------|------|
| 输入 | szarray exotic |
| 输出 | JS `Array`，**0..n-1**，`t[i] ↔ arr[i]`（**0 基**） |
| 元素 | 按默认 marshal 转为 JS 值 |

与 Pop **Array 形参**（构造 `T[n]`）方向相反；见 [marshal/07-ARRAY.md](./marshal/07-ARRAY.md) §8.3。

**Native：** `__zents_to_array`

---

## 9. 泛型方法

### 9.1 `zents.make_generic_method`

```javascript
zents.make_generic_method(genericMethodBase, typeArg1, ...) → function
```

| 参数 | 说明 |
|------|------|
| `genericMethodBase` | 类型对象上的 **direct method function** |
| `typeArg…` | 与方法泛型形参一致 |

返回单态化 **direct function**；相同 `(base, typeArgs…)` **intern**。

**不能** 传入 **dispatch function** → **throw**。

**Native：** `__zents_make_generic_method`

```javascript
const bar_int = zents.make_generic_method(MyType.GenericBar, zents.types.int32);
bar_int(obj, 42);
```

---

## 10. Delegate

### 10.1 默认

带 delegate 形参的 C# 方法可直接传 **JS function**（[marshal/09-FUNCTION.md](./marshal/09-FUNCTION.md)）。

### 10.2 `zents.to_delegate`（显式）

```javascript
zents.to_delegate(func, delegateTypeObject) → delegateExotic
```

| 参数 | 说明 |
|------|------|
| `func` | JS function |
| `delegateTypeObject` | 已闭合 delegate 类型对象 |

**Native：** `__zents_to_delegate`

---

## 11. 方法重载辅助

### 11.1 `zents.signature`

```javascript
zents.signature(typeArg1, ...) → string
// "(System.Int32,System.String)"
```

供全签名键与调试对照（[04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §4）。

**Native：** `__zents_create_signature`

### 11.2 `zents.register_method`

```javascript
zents.register_method(aliasName, methodOrClosure);
```

完整语义见 [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §6.1。

要点：

- 全签名键如 `demo['Run(System.Int32)']` 已是 direct，**不必**先 register
- 仅挂 **尚未占用** 的短名；已存在 → **throw**
- 之后 **`demo.run_i32(5)`** 方法调用绑定 `this`

**Native：** `__zents_register_method`

---

## 12. Native 回调一览

| Native | `zents.*` | 说明 |
|--------|---------|------|
| `__zents_typeof` | `typeof` | |
| `__zents_get_type_from_name` | `get_type_from_name` | |
| `__zents_create_signature` | `signature` | |
| `__zents_make_generic_type` | `make_generic_type` | |
| `__zents_make_szarray_type` | `make_szarray_type` | |
| `__zents_make_mdarray_type` | `make_mdarray_type` | |
| `__zents_new_szarray_by_element_type` | `new_szarray_by_element_type` | |
| `__zents_new_szarray_by_szarray_type` | `new_szarray_by_szarray_type` | |
| `__zents_new_mdarray_by_mdarray_type` | `new_mdarray_by_mdarray_type` | |
| `__zents_new_mdarray_by_spec` | `new_mdarray_by_spec` | |
| `__zents_make_generic_method` | `make_generic_method` | |
| `__zents_register_method` | `register_method` | 两参数 |
| `__zents_box` | `box` | |
| `__zents_unbox` | `unbox` | |
| `__zents_cast` | `cast` | |
| `__zents_to_user_data` | `to_user_data` | opaque → ByVal |
| `__zents_to_delegate` | `to_delegate` | |
| `__zents_get_opaquevalue` | `get_opaquevalue` | |
| `__zents_set_opaquevalue` | `set_opaquevalue` | |
| `__zents_to_bytes` | `to_bytes` | |
| `__zents_to_array` | `to_array` | |

---

## 13. 示例

```javascript
import { Demo } from "csharp:Assembly-CSharp";
import { List } from "csharp:mscorlib/System.Collections.Generic";

const demo = new Demo();

const ListInt = zents.make_generic_type(List, zents.types.int32);
const list = new ListInt();

const arr = zents.new_szarray_by_element_type(zents.types.int32, 4);
arr.set(0, 1);

const raw = zents.to_bytes(byteArr);
const view = zents.to_array(arr);

demo['Run(System.Int32)'](10);
const run = demo['Run(System.Int32)'];
zents.register_method("run_hot", run);
demo.run_hot(99);

const child = zents.cast(demo, CSharp['Assembly-CSharp'].Child);
```

---

## 14. `zentslib.js` 骨架（与仓库一致）

```javascript
globalThis.zents = globalThis.zents ?? {};

zents.typeof = (t) => __zents_typeof(t);
zents.get_type_from_name = (n) => __zents_get_type_from_name(n);
zents.signature = (...args) => __zents_create_signature(...args);
zents.make_generic_type = (g, ...args) => __zents_make_generic_type(g, ...args);
zents.make_generic_method = (m, ...args) => __zents_make_generic_method(m, ...args);
zents.make_szarray_type = (e) => __zents_make_szarray_type(e);
zents.make_mdarray_type = (e, r) => __zents_make_mdarray_type(e, r);
zents.new_szarray_by_element_type = (e, n) => __zents_new_szarray_by_element_type(e, n);
zents.new_szarray_by_szarray_type = (t, n) => __zents_new_szarray_by_szarray_type(t, n);
zents.new_mdarray_by_mdarray_type = (t, lb, sz) => __zents_new_mdarray_by_mdarray_type(t, lb, sz);
zents.new_mdarray_by_spec = (e, lb, sz) => __zents_new_mdarray_by_spec(e, lb, sz);
zents.to_bytes = (a) => __zents_to_bytes(a);
zents.to_array = (a) => __zents_to_array(a);
zents.to_delegate = (f, t) => __zents_to_delegate(f, t);
zents.get_opaquevalue = (h) => __zents_get_opaquevalue(h);
zents.set_opaquevalue = (h, v) => __zents_set_opaquevalue(h, v);
zents.to_user_data = (h) => __zents_to_user_data(h);
zents.box = (t, v) => __zents_box(t, v);
zents.unbox = (v) => __zents_unbox(v);
zents.cast = (o, t) => __zents_cast(o, t);
zents.register_method = (name, fn) => __zents_register_method(name, fn);

zents.types = { /* 见 §4.2 */ };
```
