---
sidebar_position: 4
title: 类型系统概览
description: "CSharp 根对象、csharp: import、静实例隔离与构造模型。"
---

# 类型系统概览

:::tip 谁该读本文
**已在 JS/TS 中访问 C#、需要理解 `CSharp` / `csharp:` 与静/实例隔离的开发者。** 入门语法见 [JS 调用 C#](/docs/guides/js-calling-csharp/)；权威契约见 [02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/)。
:::

## 设计目标

| 目标 | 说明 |
|------|------|
| 统一入口 | 普通类型经 **`CSharp`** 懒加载；脚本推荐 **`import { T } from "csharp:…"`**，与 `CSharp` **同一类型对象** |
| 语义贴近 C# | `Type.Static()`、`obj.Method()`、`new Type(...)` |
| 静实例隔离 | 静态与实例成员使用 **独立** 三表 |
| 仅 public | JS 仅可访问 `public` 成员 |
| Bind 期扁平继承 | 继承成员在 EnsureBinding 写入当前类型三表；**无**运行时沿链查找 |
| strict miss | 未注册成员 **`throw Error('zts: member not found: …')`** |

## 两条等价入口

```text
flowchart TB
    R[CSharp 根对象] --> A[assembly 对象]
    A --> T[类型对象 Demo]
    IM["import from csharp:asm/ns"] --> T
    T --> SMT[静态三表\nmethod / getter / setter]
    T --> IEO[实例分派原型 IEO]
    T --> Ctor["new Type(...)"]
    Ctor --> INST[实例 exotic object]
    INST --> IEO
```

| 入口 | 写法 | 用途 |
|------|------|------|
| **`csharp:`（推荐）** | `import { Demo } from "csharp:Assembly-CSharp"` | 业务脚本、TS 声明友好 |
| **`CSharp`（权威低层）** | `CSharp['Assembly-CSharp'].Demo` | 调试、嵌套类型、adaptor |

`csharp:` 在宿主 `moduleLoader` **之前**拦截；**禁止**把 `csharp:` 交给业务 loader。

### 程序集别名（惯例）

```javascript
CSharp.AC = CSharp["Assembly-CSharp"];
const demo = new CSharp.AC.Demo();
```

### 命名空间与嵌套类型

| 场景 | 写法 |
|------|------|
| 无命名空间 + 合法标识符 | `CSharp.AC.Demo` |
| **有命名空间** | `CSharp.AC['MyGame.UI.Panel']`（**必须**整段键） |
| **嵌套类型** | `CSharp.AC['Outer+Inner']`（`+` 分隔，**禁止**用 `.`） |
| `csharp:` 带命名空间 | `import { Panel } from "csharp:Assembly-CSharp/MyGame.UI"` |

**禁止** `CSharp.AC.MyGame.UI.Panel`——`.` 属于 CLR 全名字符串，不是 JS 路径。

## 静实例隔离

静态成员与实例成员 **不得混用**：

| 操作 | 正确 | 错误 |
|------|------|------|
| 静态方法 | `Demo.Add(1, 2)` | `demo.Add(1, 2)`（若 `Add` 仅为静态） |
| 实例方法 | `demo.GetX()` | `Demo.GetX()`（无静态同名时 miss） |
| 静态字段 | `Demo.s_x = 1` | `demo.s_x = 1` |

:::info 方法 this
`obj.Method(args)` 作为 **方法调用** 时自动传入 CLR `this`。把方法提取为独立函数再调用时 **不** 自动绑定（与常见 JS 行为一致）。
:::

```text
flowchart LR
    subgraph Static["类型对象 / STO（静态域）"]
        SM[methodTable]
        SG[fieldGetter]
        SS[fieldSetter]
    end

    subgraph Instance["实例 exotic / IEO（实例域）"]
        IM[methodTable]
        IG[fieldGetter]
        IS[fieldSetter]
    end

    JS["JS 脚本"] -->|Type.Static| Static
    JS -->|obj.Method| Instance
```

## 构造

| 类型 | 构造方式 |
|------|----------|
| class / struct | `new Type(...args)` |
| struct 默认实例 | 类型上的 `_default`（若提供） |
| enum | **无** `new`；用静态字面量 / 数值规则 |
| Nullable | 经类型 `[[Construct]]` 构造 element |

**禁止**依赖脚本侧 `_ctor` 字段——规范不在类型对象上暴露与构造等价的 `_ctor` 属性。

## 懒加载与 EnsureBinding

首次取得某类型对象时，运行时扫描 public 成员并填充静/实例三表：

```text
sequenceDiagram
    participant J as JS
    participant T as 类型对象
    participant N as EnsureBinding

    J->>T: import / CSharp.AC.Demo
    alt 未绑定
        T->>N: 触发绑定
        N->>T: 注册 method/field/event 表
    end
    J->>T: demo.Run(10)
```

| 运行时 | 绑定实现 |
|--------|----------|
| Mono | Expression Emit + 懒绑定 |
| Il2Cpp | Generate stub + 懒绑定 |

## 泛型与数组（摘要）

| 场景 | 入口 |
|------|------|
| 开放泛型定义 | `CSharp.mscorlib['System.Collections.Generic.List`1']` |
| 闭合泛型 | `zts.make_generic_type(...)` 等（见 [05-LIB](/docs/spec/05-LIB/)） |
| 数组类型 | 类型系统 §7 / [数组指南](/docs/guides/arrays/) |

详见 [泛型指南](/docs/guides/generics/)。

## undefined / null 与 miss

| 场景 | 行为 |
|------|------|
| 读 **C# 绑定**不存在的成员 | **`throw Error`**（不是 `undefined`） |
| 读普通 JS 对象缺失属性 | ECMAScript 默认 `undefined` |
| CLR 引用 `null` | JS **`null`** |
| 必选引用形参传 `undefined` | **`throw Error`**（须显式 `null`） |

完整规则见 [Marshal 概览](/docs/concepts/marshal-overview/)。

## 何时读规范

| 问题 | 文档 |
|------|------|
| 成员如何分派？ | [Exotic 对象模型](/docs/concepts/exotic-model/) |
| 重载与别名？ | [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/) · [TsAlias](/docs/guides/ts-alias/) |
| 数组 / 继承？ | [类型系统规范](/docs/spec/02-TYPE-SYSTEM/) |
| 扩展方法？ | [扩展方法](/docs/guides/extension-methods/) |

## 相关文档

- [JS 调用 C#](/docs/guides/js-calling-csharp/)
- [Exotic 对象模型](/docs/concepts/exotic-model/)
- [类型系统规范](/docs/spec/02-TYPE-SYSTEM/)
- [JS 表面参考](/docs/reference/js-surface/)
