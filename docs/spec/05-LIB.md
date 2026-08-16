---
sidebar_position: 5
title: "`zts` 标准库"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`05-LIB.md`）
:::


# 05 — `zts` 标准库

> 全局 **`zts`** 表的 JavaScript API。
> 源码：`Packages/.../ZTS~/jslib/ztslib.js`（或等价路径）
> Native：`libil2cpp/zts/lvm/ZTSLib.cpp`（`RegisterGlobals`）

初始化时 native 注册 `__zts_*` 内部 hook，再加载 `ztslib.js` 封装为 `zts.*`。

**相关：** 类型访问 → [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md)；重载 → [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md)；Marshal → [marshal/](/docs/spec/marshal/)；`zts.d.ts` → [14-TYPESCRIPT.md](./14-TYPESCRIPT.md)。

---

## 1. 职责边界

| 层级 | 职责 |
|------|------|
| **`CSharp`** | 程序集 / 类型懒加载；静态成员；`new Type(...)`；权威低层路径 |
| **`csharp:` 模块** | 推荐的 ES `import`；named export 为类型对象，identity 同 `CSharp` |
| **`zts`** | 类型构造辅助、opaque、装箱、数组、delegate、方法别名注册 |
| **实例 exotic object** | 成员经 **三表 / IEO** 访问，**不经** `zts` |

`zts` **不**替代 `CSharp` / `csharp:` 访问类型。

---

## 2. 加载

```javascript
// ztslib.js 初始化
globalThis.zts = globalThis.zts ?? {};
```

Il2Cpp：脚本嵌入 `BuiltinScripts.inc`；Mono：Resources 或同等路径。**内容须与 `ztslib.js` 同步。** 编辑期类型见包内 `ZTS~/types/zts.d.ts`（[14-TYPESCRIPT.md](./14-TYPESCRIPT.md)）。

与 **`CSharp`** 同在域内主 **`JSContext`** 全局对象上暴露（[10-LIFETIME.md](./10-LIFETIME.md) §6）。

---

## 3. 类型实参（`typeArg`）

| 形式 | 示例 |
|------|------|
| `zts.types.*` | `zts.types.int32` |
| `CSharp` 类型对象 | `CSharp.mscorlib['System.Int32']` 或 `import { Int32 } from "csharp:mscorlib/System"` |
| `make_*_type` 返回值 | 闭合泛型 / 数组类型对象 |
| `zts.get_type_from_name` | 见 §4.3 |
| **类型名字符串** | 与 `get_type_from_name` 的 `name` 相同（对标 `Type.GetType`） |

`zts.typeof(typeObject)` 返回 **`System.Type` 反射对象**（ByObj exotic），**不**作为 `make_*_type` 的 typeArg（[02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.4）。

---

## 4. 类型查询

### 4.1 `zts.typeof`

```javascript
zts.typeof(typeObject) → System.Type exotic
```

| 参数 / 返回 | 说明 |
|-------------|------|
| `typeObject` | 任意 ZTS 类型对象 |
| **返回值** | `System.Type` 实例（反射对象） |

```javascript
const intType = zts.typeof(CSharp.mscorlib['System.Int32']);
const ListInt = zts.make_generic_type(
    CSharp.mscorlib['System.Collections.Generic.List`1'],
    zts.types.int32
);
const t2 = zts.typeof(ListInt);
```

**Native：** `__zts_typeof`

### 4.2 `zts.types`

`ztslib.js` 预置常量（mscorlib 全名）：

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

### 4.3 `zts.get_type_from_name`

```javascript
zts.get_type_from_name(typeFullName) → typeObject
```

按名称解析 CLR 类型；失败 → **`throw Error('zts: type not found: …')`**（**不得** 返回 `undefined`）。

| 参数 | 说明 |
|------|------|
| `typeFullName` | 对标 **`System.Type.GetType(string)`**（AQN、泛型、数组等） |

```javascript
const Int32 = zts.get_type_from_name("System.Int32");
const Demo = zts.get_type_from_name(
    "Demo, Assembly-CSharp, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null"
);
const ListInt = zts.get_type_from_name(
    "System.Collections.Generic.List`1[[System.Int32, mscorlib]]"
);
```

**Native：** `__zts_get_type_from_name`

---

## 5. 泛型类型

### 5.1 `zts.make_generic_type`

```javascript
zts.make_generic_type(genericBaseType, typeArg1, ...) → typeObject
```

| 参数 | 说明 |
|------|------|
| `genericBaseType` | 未闭合泛型定义（含 `` ` `` arity） |
| `typeArg…` | 个数须与 arity 一致 |

相同实参 **intern** 同一类型对象。

**Native：** `__zts_make_generic_type`

---

## 6. Opaque 读写

见 [marshal/04-OPAQUE.md](./marshal/04-OPAQUE.md)。

### 6.1 `zts.get_opaquevalue` / `zts.set_opaquevalue`

```javascript
zts.get_opaquevalue(opaque_handle) → value
zts.set_opaquevalue(opaque_handle, new_value)
```

| API | 说明 |
|-----|------|
| `get_opaquevalue` | 按默认 C#→JS 规则返回值；byref 先解引用 |
| `set_opaquevalue` | 按默认 JS→C# 写回槽 |
| 生命周期 | 仅当前 C#→JS 调用未返回期间 |
| 失效 | **`throw Error('zts: invalid opaque parameter handle')`** |

**Native：** `__zts_get_opaquevalue` / `__zts_set_opaquevalue`

---

## 7. 装箱 / 拆箱 / 转换

### 7.1 `zts.box`

```javascript
zts.box(typeArg, value) → byObjExotic
```

| 参数 | 说明 |
|------|------|
| `typeArg` | **值类型**（基元、enum、struct）；引用类型 → **throw** |
| `value` | 基元 / enum `number`、ByVal exotic 等 |

**Native：** `__zts_box`

### 7.2 `zts.unbox`

```javascript
zts.unbox(boxedValue) → value | byValExotic
```

参数须 **ByObj exotic**（boxed）。基元 → boolean/number；enum → number；struct → ByVal exotic。

**Native：** `__zts_unbox`

### 7.3 `zts.cast`

```javascript
zts.cast(obj, targetType) → exotic
```

| 参数 | 说明 |
|------|------|
| `obj` | ByObj class exotic |
| `targetType` | 类型对象或 typeArg |

同一 identity，**IEO 门面 = targetType**。见 [marshal/06-CLASS.md](./marshal/06-CLASS.md)。

**Native：** `__zts_cast`

### 7.4 `zts.to_user_data`（opaque → ByVal 拷贝）

```javascript
zts.to_user_data(opaque_handle) → byValExotic
```

将 **OpaqueValue** **拷贝** 为 ByVal struct exotic（长生命周期）。见 [marshal/05-STRUCT.md](./marshal/05-STRUCT.md)。

**Native：** `__zts_to_user_data`

---

## 8. 数组

与 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §7 一致。

### 8.1 数组类型

```javascript
zts.make_szarray_type(typeArg) → szarrayTypeObject
zts.make_mdarray_type(typeArg, rank) → mdarrayTypeObject   // rank ∈ [1, 32]
```

**Native：** `__zts_make_szarray_type` / `__zts_make_mdarray_type`

### 8.2 数组实例

```javascript
zts.new_szarray_by_element_type(typeArg, length) → szarrayExotic
zts.new_szarray_by_szarray_type(szarrayTypeObject, length) → szarrayExotic

zts.new_mdarray_by_mdarray_type(mdarrayType, lowbounds, sizes) → mdarrayExotic
zts.new_mdarray_by_spec(typeArg, lowbounds, sizes) → mdarrayExotic
```

| 参数 | 说明 |
|------|------|
| `length` | ≥ 0 |
| `lowbounds` / `sizes` | **JS Array**（0..rank-1 下标） |

元素初始化为 `default(T)`。szarray 支持 **`arr.length`**。

**Native：** `__zts_new_szarray_by_element_type` 等

### 8.3 `zts.to_bytes`

```javascript
zts.to_bytes(szarray) → Uint8Array | string
```

将 **一维 szarray** 托管内存按 **原始字节布局** 拷贝。

| 约束 | 说明 |
|------|------|
| 输入 | **仅** szarray exotic |
| 元素 | **blittable**（基元或仅 blittable 字段的 struct） |
| **不接受** | `bool[]`、`char[]`、含引用字段的元素 → **throw** |
| 输出 | `Uint8Array` 或 binary string（实现二选一，须文档化） |

**Native：** `__zts_to_bytes`

### 8.4 `zts.to_array`

```javascript
zts.to_array(szarray) → Array
```

| 约束 | 说明 |
|------|------|
| 输入 | szarray exotic |
| 输出 | JS `Array`，**0..n-1**，`t[i] ↔ arr[i]`（**0 基**） |
| 元素 | 按默认 marshal 转为 JS 值 |

与 Pop **Array 形参**（构造 `T[n]`）方向相反；见 [marshal/07-ARRAY.md](./marshal/07-ARRAY.md) §8.3。

**Native：** `__zts_to_array`

---

## 9. 泛型方法

### 9.1 `zts.make_generic_method`

```javascript
zts.make_generic_method(genericMethodBase, typeArg1, ...) → function
```

| 参数 | 说明 |
|------|------|
| `genericMethodBase` | 类型对象上的 **direct method function** |
| `typeArg…` | 与方法泛型形参一致 |

返回单态化 **direct function**；相同 `(base, typeArgs…)` **intern**。

**不能** 传入 **dispatch function** → **throw**。

**Native：** `__zts_make_generic_method`

```javascript
const bar_int = zts.make_generic_method(MyType.GenericBar, zts.types.int32);
bar_int(obj, 42);
```

---

## 10. Delegate

### 10.1 默认

带 delegate 形参的 C# 方法可直接传 **JS function**（[marshal/09-FUNCTION.md](./marshal/09-FUNCTION.md)）。

### 10.2 `zts.to_delegate`（显式）

```javascript
zts.to_delegate(func, delegateTypeObject) → delegateExotic
```

| 参数 | 说明 |
|------|------|
| `func` | JS function |
| `delegateTypeObject` | 已闭合 delegate 类型对象 |

**Native：** `__zts_to_delegate`

---

## 11. 方法重载辅助

### 11.1 `zts.signature`

```javascript
zts.signature(typeArg1, ...) → string
// "(System.Int32,System.String)"
```

供全签名键与调试对照（[04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §4）。

**Native：** `__zts_create_signature`

### 11.2 `zts.register_method`

```javascript
zts.register_method(aliasName, methodOrClosure);
```

完整语义见 [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §6.1。

要点：

- 全签名键如 `demo['Run(System.Int32)']` 已是 direct，**不必**先 register
- 仅挂 **尚未占用** 的短名；已存在 → **throw**
- 之后 **`demo.run_i32(5)`** 方法调用绑定 `this`

**Native：** `__zts_register_method`

---

## 12. Native 回调一览

| Native | `zts.*` | 说明 |
|--------|---------|------|
| `__zts_typeof` | `typeof` | |
| `__zts_get_type_from_name` | `get_type_from_name` | |
| `__zts_create_signature` | `signature` | |
| `__zts_make_generic_type` | `make_generic_type` | |
| `__zts_make_szarray_type` | `make_szarray_type` | |
| `__zts_make_mdarray_type` | `make_mdarray_type` | |
| `__zts_new_szarray_by_element_type` | `new_szarray_by_element_type` | |
| `__zts_new_szarray_by_szarray_type` | `new_szarray_by_szarray_type` | |
| `__zts_new_mdarray_by_mdarray_type` | `new_mdarray_by_mdarray_type` | |
| `__zts_new_mdarray_by_spec` | `new_mdarray_by_spec` | |
| `__zts_make_generic_method` | `make_generic_method` | |
| `__zts_register_method` | `register_method` | 两参数 |
| `__zts_box` | `box` | |
| `__zts_unbox` | `unbox` | |
| `__zts_cast` | `cast` | |
| `__zts_to_user_data` | `to_user_data` | opaque → ByVal |
| `__zts_to_delegate` | `to_delegate` | |
| `__zts_get_opaquevalue` | `get_opaquevalue` | |
| `__zts_set_opaquevalue` | `set_opaquevalue` | |
| `__zts_to_bytes` | `to_bytes` | |
| `__zts_to_array` | `to_array` | |

---

## 13. 示例

```javascript
import { Demo } from "csharp:Assembly-CSharp";
import { List } from "csharp:mscorlib/System.Collections.Generic";

const demo = new Demo();

const ListInt = zts.make_generic_type(List, zts.types.int32);
const list = new ListInt();

const arr = zts.new_szarray_by_element_type(zts.types.int32, 4);
arr.set(0, 1);

const raw = zts.to_bytes(byteArr);
const view = zts.to_array(arr);

demo['Run(System.Int32)'](10);
const run = demo['Run(System.Int32)'];
zts.register_method("run_hot", run);
demo.run_hot(99);

const child = zts.cast(demo, CSharp['Assembly-CSharp'].Child);
```

---

## 14. `ztslib.js` 骨架（与仓库一致）

```javascript
globalThis.zts = globalThis.zts ?? {};

zts.typeof = (t) => __zts_typeof(t);
zts.get_type_from_name = (n) => __zts_get_type_from_name(n);
zts.signature = (...args) => __zts_create_signature(...args);
zts.make_generic_type = (g, ...args) => __zts_make_generic_type(g, ...args);
zts.make_generic_method = (m, ...args) => __zts_make_generic_method(m, ...args);
zts.make_szarray_type = (e) => __zts_make_szarray_type(e);
zts.make_mdarray_type = (e, r) => __zts_make_mdarray_type(e, r);
zts.new_szarray_by_element_type = (e, n) => __zts_new_szarray_by_element_type(e, n);
zts.new_szarray_by_szarray_type = (t, n) => __zts_new_szarray_by_szarray_type(t, n);
zts.new_mdarray_by_mdarray_type = (t, lb, sz) => __zts_new_mdarray_by_mdarray_type(t, lb, sz);
zts.new_mdarray_by_spec = (e, lb, sz) => __zts_new_mdarray_by_spec(e, lb, sz);
zts.to_bytes = (a) => __zts_to_bytes(a);
zts.to_array = (a) => __zts_to_array(a);
zts.to_delegate = (f, t) => __zts_to_delegate(f, t);
zts.get_opaquevalue = (h) => __zts_get_opaquevalue(h);
zts.set_opaquevalue = (h, v) => __zts_set_opaquevalue(h, v);
zts.to_user_data = (h) => __zts_to_user_data(h);
zts.box = (t, v) => __zts_box(t, v);
zts.unbox = (v) => __zts_unbox(v);
zts.cast = (o, t) => __zts_cast(o, t);
zts.register_method = (name, fn) => __zts_register_method(name, fn);

zts.types = { /* 见 §4.2 */ };
```
