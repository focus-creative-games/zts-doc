---
sidebar_position: 15
title: 泛型
description: 闭合泛型类型与泛型方法在 JS 侧的构造与调用。
---

# 泛型

用 `zts.make_generic_type` 得到 **闭合** 泛型类型对象，再像普通类型一样构造与调成员。数组见 [数组](/docs/guides/arrays/)。权威：[05-LIB](/docs/spec/05-LIB/)、[类型系统](/docs/spec/02-TYPE-SYSTEM/)。

开放泛型定义本身 **不可** 直接 `new` 实例化。

## 闭合泛型类型

未闭合定义须带 **反引号 arity**：``List`1``、``Dictionary`2``。

```javascript
const ListInt = zts.make_generic_type(
  CSharp.mscorlib['System.Collections.Generic.List`1'],
  zts.types.int32
);

const list = new ListInt();
list.Add(10);
list.Add(20);
```

```javascript
const DictStrInt = zts.make_generic_type(
  CSharp.mscorlib['System.Collections.Generic.Dictionary`2'],
  zts.types.string,
  zts.types.int32
);

const dict = new DictStrInt();
dict.Add("hp", 100);
```

亦可配合 `csharp:` 模块：

```javascript
import { List } from "csharp:mscorlib/System.Collections.Generic";

const ListInt = zts.make_generic_type(List, zts.types.int32);
const list = new ListInt();
```

第一个参数为 **泛型定义类型对象**，其后为类型实参（`zts.types.*`、类型对象、名称字符串等，见 [typeArg](/docs/spec/05-LIB/)）。相同实参 **intern** 同一类型对象。

也可用 AQN 一次解析闭合类型：

```javascript
const ListInt2 = zts.get_type_from_name(
  "System.Collections.Generic.List`1[[System.Int32, mscorlib]]"
);
```

## 泛型方法

方法 **自身** 带类型参数（如开放 `Foo<T>`）时，用 `zts.make_generic_method` 得到单态化 **direct function**：

```javascript
const bar_int = zts.make_generic_method(MyType.GenericBar, zts.types.int32);
bar_int(obj, 42);   // 注意：提取后的调用须自行保证 this 约定；优先保持方法调用形态
```

| 规则 | 说明 |
|------|------|
| 第一参 | 类型对象上的 **direct** method function |
| 传入 **dispatch** | **throw** |
| 已闭合类上的普通方法（如 `List<int>.Add`） | **不**走此路径 |

见 [类型系统](/docs/spec/02-TYPE-SYSTEM/)、[05-LIB §9](/docs/spec/05-LIB/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| arity 错误 | 检查 `` `1 `` / `` `2 `` 与实参个数 |
| `List` 找不到 | 使用 `System.Collections.Generic.List`1`` 全名 + 括号键 |
| 对开放定义直接 `new` | 先 `make_generic_type` |
| 对 dispatch 调 `make_generic_method` | 先消歧为 direct（全签名键 / 单候选） |

## 相关文档

- [zts 库规范](/docs/spec/05-LIB/)
- [类型系统](/docs/spec/02-TYPE-SYSTEM/)
- [数组](/docs/guides/arrays/)
- [zts 标准库](/docs/guides/zts-lib/)
