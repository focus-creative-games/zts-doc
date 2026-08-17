---
sidebar_position: 6
title: Exotic 对象模型
description: "C# 类型与实例在 QuickJS 中的 exotic 分派、三表与 strict miss。"
---

# Exotic 对象模型

:::tip 谁该读本文
**需要理解 `obj.Member` 底层如何查表、为何报错 `zents: member not found` 的开发者。** 日常用法见 [JS 调用 C#](/docs/guides/js-calling-csharp/)、[方法重载](/docs/guides/overloads/)。对照 ZLua 的「元表模型」：ZenTS 用 QuickJS **exotic object + internal slots**，**不**要求 ECMAScript `Proxy`。
:::

C# 类型在 JS 中以 **类型对象 `T`** 暴露静态成员；实例以 **实例 exotic object** 暴露实例成员。属性分派走 **三表 + strict miss**：未注册成员直接 **`throw Error`**，**不**回退到 C# 反射，也 **不**返回 `undefined`。

## 总体布局

```text
flowchart TB
    T[类型对象 T] --> STO[STO 静态分派]
    STO --> SMT[静态三表]
    T --> ByObjProto[ByObj IEO 原型]
    T -.->|仅 struct| ByValProto[ByVal IEO 原型]
    Inst[实例 exotic] --> ByObjProto
    InstSV[struct ByVal 实例] --> ByValProto
```

| 概念 | 作用 |
|------|------|
| **类型对象 `T`** | 静态门面；`Type.StaticField`、`new Type(...)` |
| **STO** | 静态 `[[Get]]` / `[[Set]]` / `[[Construct]]` |
| **IEO** | 实例分派原型；ByObj（引用/装箱）与 ByVal（struct payload）可分离 |
| **三表** | `methodTable` / `fieldGetterTable` / `fieldSetterTable`（静、实例各一套） |

脚本 **不应**依赖内部槽键名或 native 布局细节；稳定行为以 [metatable 规范](/docs/spec/metatable/) 为准。

## 三表分派

每个静态域或实例域各维护三张表：

| 表 | 读 (`[[Get]]`) | 写 (`[[Set]]`) |
|----|----------------|----------------|
| **methodTable** | 方法、dispatch、别名、`add_`/`remove_` | — |
| **fieldGetterTable** | 字段、无参 property 读 | — |
| **fieldSetterTable** | — | 字段、无参 property 写 |

```text
flowchart TD
    K[访问键 key] --> R{读 or 写?}
    R -->|读| M[methodTable]
    M -->|命中| OK1[返回函数 / 值]
    M -->|未命中| G[fieldGetterTable]
    G -->|命中| OK2[返回字段/property 值]
    G -->|未命中| E1["throw Error strict miss"]

    R -->|写| S[fieldSetterTable]
    S -->|命中| OK3[写入字段/property]
    S -->|未命中| E2["throw Error strict miss"]
```

:::note 写路径
写路径 **不**查 methodTable；给不存在的键赋值直接报错。
:::

## 查表时序（实例读）

```text
sequenceDiagram
    participant J as QuickJS
    participant I as instance Get
    participant M as methodTable
    participant G as fieldGetterTable

    J->>I: demo.GetX 或 demo.x
    I->>M: lookup "GetX" / "x"
    alt method 命中
        M-->>I: bridge function
    else method 未命中
        I->>G: lookup "x"
        G-->>I: getter 或值
    end
    I-->>J: 结果或 Error
```

## strict miss 示例

以下均 **直接 throw**，不会尝试反射查找 private 或未绑定父类成员：

```javascript
const demo = new Demo();
const _ = demo.nonExistentField; // Error: zents: member not found: …
demo.nonExistentField = 1;       // Error: member not found / not writable
demo.PrivateMethod();            // Error（private 未注册）
```

**与 dispatch 的区别：** 多重重载时 `demo.Run(x)` 在 methodTable 上可能是 **单个 dispatch 函数**，内部分派到具体桥接，仍算 methodTable 命中。

## 方法调用形态

| 情况 | 行为 |
|------|------|
| `obj.Method(args)` | 方法调用：自动传入 CLR `this` |
| `const f = obj.Method; f(args)` | **不**自动绑定 this（与常见 JS 一致） |
| 单一 public 重载 | methodTable 直接桥接 |
| 多个重载 | dispatch 函数（运行时分派） |
| `[JsAlias("run_i32")]` | 额外键 `run_i32` → 单桥接 |

签名字符串 **不是** 推荐的日常 JS 属性键；日常用短名 + dispatch / 别名。

Event **无**专用 `{ get, set, fire }` 对象；使用 `add_EventName` / `remove_EventName`。

## 平台实现

| 运行时 | 分派实现 |
|--------|----------|
| Mono (Editor) | Exotic + 托管侧查三表 / Emit 桥 |
| Il2Cpp (Player) | native `Dispatch*` + `MetaBinding` / TypeRegistry |

**JS 可见语义一致**；Il2Cpp 可内联字段 offset 读，仍走同一分派顺序。

## 与 Proxy / ZLua 的关系

| 方案 | 分派载体 |
|------|----------|
| ZLua | userdata + Lua 元表三表 |
| **ZenTS** | QuickJS **exotic object** + internal slots |
| ECMAScript `Proxy` | 规范 **不要求**；若实现内部使用，不得改变可见行为 |

## 何时读规范

| 问题 | 文档 |
|------|------|
| 布局与内部槽 | [01-LAYOUT](/docs/spec/metatable/01-LAYOUT/) |
| 索引算法 | [02-INDEX](/docs/spec/metatable/02-INDEX/) |
| 注册期绑定 | [03-BINDING](/docs/spec/metatable/03-BINDING/) |
| struct / enum 特殊形态 | [04-SPECIAL-TYPES](/docs/spec/metatable/04-SPECIAL-TYPES/) |
| dispatch 算法 | [方法重载](/docs/spec/04-METHOD-OVERLOAD/) |

## 相关文档

- [类型系统概览](/docs/concepts/type-system-overview/)
- [metatable 规范索引](/docs/spec/metatable/)
- [JS 表面参考](/docs/reference/js-surface/)
- [方法重载指南](/docs/guides/overloads/)
