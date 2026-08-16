---
sidebar_position: 17
title: zts 标准库
description: "日常最常用的 zts API；其余见规范。"
---

# zts 标准库

| 层 | 职责 |
|----|------|
| **`CSharp` / `csharp:`** | 程序集 / 类型 / 成员 / 构造 |
| **`zts`** | 类型构造辅助、opaque、数组、delegate、重载短名 |
| **实例 exotic** | 成员经三表 / IEO，**不经** `zts` |

全文 API：[05-LIB](/docs/spec/05-LIB/)、TypeScript 声明见 [14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)。本篇只列最常用。失败路径统一 **`throw Error('zts: …')`**，**不**返回 `undefined` 表示 miss。

## 类型实参与查询

| API | 用途 |
|-----|------|
| `zts.types.int32` 等 | 预置类型实参（见规范表） |
| `zts.typeof(typeObject)` | ≡ C# `typeof`，返回 `System.Type` **ByObj exotic**（**不作** `make_*` 的 typeArg） |
| `zts.get_type_from_name(name)` | 对标 `Type.GetType`；找不到 → throw |

## 重载

同名多候选时，Bind 已自动挂全签名键（如 `Run(System.Int32)`），一般 **不必** 先调库：

```javascript
demo['Run(System.Int32)'](5);   // 方法调用绑定 this
```

需要短名时再 `register_method`：

```javascript
const run_i32 = demo['Run(System.Int32)'];
zts.register_method("run_i32", run_i32);
demo.run_i32(5);   // 注册后的好处：可读短名 + 方法调用 this
```

`zts.signature(...)` 只生成参数括号部分（如 `"(System.Int32)"`），用于对照/拼接；**不能**单独当键。见 [方法重载](/docs/guides/overloads/)。

## 泛型与数组

```javascript
const ListInt = zts.make_generic_type(
  CSharp.mscorlib['System.Collections.Generic.List`1'],
  zts.types.int32
);
const list = new ListInt();

const arr = zts.new_szarray_by_element_type(zts.types.int32, 4);
arr.set(0, 1);
const view = zts.to_array(arr);
const raw = zts.to_bytes(byteArr);  // blittable 元素
```

见 [泛型](/docs/guides/generics/)、[数组](/docs/guides/arrays/)。

## Opaque / 装箱 / 门面

| API | 用途 |
|-----|------|
| `get_opaquevalue` / `set_opaquevalue` | 同步链内读写 Opaque |
| `to_user_data` | Opaque **拷贝** 为 ByVal struct exotic |
| `box` / `unbox` | 值类型装箱 / 拆箱 |
| `cast` | 引用类型 IEO 门面切换 |

`ref` struct：传同型 `new Type(...)` ByVal exotic 即可写回。见 [ref/out/in](/docs/guides/ref-out-in/)。

## Delegate

```javascript
const d = zts.to_delegate(fn, ActionIntType);  // 第二参须已闭合
```

形参已是具体 `Action`/`Func` 时通常 **不必** 调用。见 [委托与函数](/docs/guides/functions/)。

## 其它（需要时再查规范）

`make_generic_method`、`make_mdarray_type` / `new_mdarray_*`、Native `__zts_*` —— 见 [05-LIB](/docs/spec/05-LIB/)。

## 相关文档

- [05-LIB](/docs/spec/05-LIB/)
- [方法重载](/docs/guides/overloads/)
- [泛型](/docs/guides/generics/)
- [数组](/docs/guides/arrays/)
- [Attributes](/docs/reference/attributes/)
