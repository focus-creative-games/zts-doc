:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`metatable\index.md`）
:::

﻿---
sidebar_position: 22
title: "属性分派规范（spec/metatable/）"
---

# 属性分派规范（`spec/metatable/`）

本目录规定 ZenTS 在 JavaScript 侧可见的 **类型对象、静态分派（STO）、实例分派（IEO）** 布局，以及 **属性 get/set** 成员分派语义。目录名保留 **metatable** 以与 ZLua 文档结构对齐；内容描述的是 **QuickJS exotic object + internal slots** 分派，**不**要求 ECMAScript `Proxy`。

内容为 **规范性** 描述：Mono 与 Il2Cpp 运行时须表现一致；具体实现（Mono exotic 回调、Il2Cpp native `Dispatch*` 等）见 `impl/metatable/`。

## 文档索引

| 文件 | 内容 |
|------|------|
| [01-LAYOUT.md](./01-LAYOUT.md) | STO / IEO、ByVal·ByObj 双实例分派、类型对象内部槽（`JsConsts`） |
| [02-INDEX.md](./02-INDEX.md) | 属性 get/set 算法、三表职责、miss 语义、方法 this 绑定 |
| [03-BINDING.md](./03-BINDING.md) | public 可见性、Bind 期继承扁平化、成员归类 |
| [04-SPECIAL-TYPES.md](./04-SPECIAL-TYPES.md) | enum、Nullable、struct、array、delegate 特例 |

## 与其它规范的边界

- 类型命名、`CSharp` 路径、泛型/数组类型入口 → [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md)
- C# ↔ JS 值形态与 Push/Pop → [../marshal/](/docs/spec/marshal/)
- 方法重载 dispatch、`register_method` → [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md)
- **Event：无专用子对象**；脚本使用 `add_EventName` / `remove_EventName` 普通方法（见 [03-BINDING.md](./03-BINDING.md)）

## 核心语义（速览）

- 静/实例各一套 **三表**（`methodTable` / `fieldGetterTable` / `fieldSetterTable`），由 exotic object 内部槽引用。
- **属性 miss → `throw Error('zents: …')`**；无 C# 反射 fallback；**禁止**对 CLR 绑定 miss 返回 `undefined`。
- 继承在 **EnsureBinding** 期 **扁平写入** 三表，运行时不上链查找。
- struct 同时提供 **`__byvalInstanceProto`** 与 **`__byobjInstanceProto`**；引用类型仅 ByObj。
- **`obj.Method(args)`** 作为方法调用时自动传入 CLR `this`；**提取**的 method function **不**自动绑定。
- v1 **不**使用 bigint 作为 CLR 整数通道；enum 常量为 **number**。
