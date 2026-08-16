---
sidebar_position: 4
title: "zts 与 csharp:"
description: 脚本侧全局与模块速查。
---

# zts 与 csharp:

脚本侧三条表面分工明确：**类型访问**走 `CSharp` / `csharp:`；**辅助构造与转换**走 `zts`；**实例成员**经 exotic 三表，**不经** `zts`。

权威全文：[02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/) · [05-LIB](/docs/spec/05-LIB/) · [metatable](/docs/spec/metatable/)。

---

## `CSharp` 根对象

全局 **`CSharp`** 是访问托管类型的 **权威低层入口**。程序集与类型均为 **懒加载**。

```javascript
CSharp['Assembly-CSharp']              // 程序集（简单名，无 .dll）
CSharp.AC = CSharp['Assembly-CSharp']; // 可选别名
CSharp.AC.Demo                         // 无命名空间
CSharp.AC['MyGame.UI.Panel']           // 含命名空间：强制括号
CSharp.AC['Outer+Inner']               // 嵌套类型：+ 分隔
```

| 层级 | miss 行为 |
|------|-----------|
| `CSharp[assembly]` | 懒创建并缓存；程序集不存在 → **`throw Error('zts: assembly not found: …')`** |
| `assembly[typeFullName]` | 解析 Type → **EnsureBinding** → 缓存；不存在 → **`throw Error('zts: type not found: …')`** |

**禁止**对不存在的程序集 / 类型返回 `undefined`。

类型对象：静态成员、`new Type(...)` 构造。实例 exotic：实例字段 / 方法（静实例隔离）。

---

## `csharp:` 虚拟模块（推荐）

与 `CSharp[assembly][typeFullName]` **identity 等价** 的 ES `import`；不改变 EnsureBinding / 三表 / miss 语义。

```javascript
import { Demo } from "csharp:Assembly-CSharp";
import { Panel } from "csharp:Assembly-CSharp/MyGame.UI";
import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine";
import { List, List$1 } from "csharp:mscorlib/System.Collections.Generic";

const panel = new Panel();
```

| 规则 | 说明 |
|------|------|
| Specifier | `csharp:` + 程序集简单名 + 可选 `/` + 命名空间或声明类型全名 |
| 拦截时机 | 宿主 `moduleLoader` **之前**；**禁止**把 `csharp:` 传给业务 loader |
| Export | **仅** named export（类型对象）；**无** default export |
| 泛型短名 | `` List`1 `` → `List$1`；无冲突时可额外导出 `List`（同一对象） |
| 嵌套 | 声明类型模块：路径末尾字面量 `+`，如 `"csharp:asm/Foo.Bar+"` |
| `GetFunction` | **不应**以 `csharp:` 作业务模块（named export 一般非 callable） |

完整文法与命名空间 / 嵌套判定：[02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/) §2.11。

---

## Strict miss

对 **CSharp 根、程序集对象、类型对象、CLR 实例 exotic**：

| 操作 | 行为 |
|------|------|
| 读/写未注册成员 | **`throw Error('zts: …')`**（含键名，如 `member not found`） |
| 只写属性读 | **`throw Error('zts: property has no getter: …')`** |
| 普通 JS object | 仍返回 `undefined`（标准语义） |
| `import * as ns; ns.Missing`（`csharp:` 模块命名空间） | 标准 ES → **`undefined`**（**不是** CSharp miss throw） |

**无**反射 fallback。详见 [metatable/02-INDEX](/docs/spec/metatable/02-INDEX/)。

---

## 方法 `this` 绑定

```javascript
demo.setX(1);              // ✅ 方法调用：自动传入 CLR this
const fn = demo.setX;
fn(1);                     // ❌ 提取函数：不自动绑定；行为未定义或抛错（实现须一致且可诊断）

Type.staticMethod(a, b);   // 静态：无 this
```

重载 short 名注册后同样依赖方法调用形式：`demo.run_i32(5)`。见 [04-METHOD-OVERLOAD](/docs/spec/04-METHOD-OVERLOAD/)、[functions 指南](/docs/guides/functions/)。

---

## `zts.*` 摘要表

初始化时 native 注册 `__zts_*` hook，再加载 `ztslib.js` 封装为 `zts.*`（与 `CSharp` 同在主 `JSContext` 全局）。

| API | 说明 |
|-----|------|
| `typeof(typeObject)` | ≡ C# `typeof` → `System.Type` ByObj exotic（**不作** `make_*` 的 typeArg） |
| `types.*` | mscorlib 预置常量（`int32`、`string` 等） |
| `get_type_from_name(name)` | 对标 `Type.GetType`；找不到 → throw |
| `make_generic_type` / `make_generic_method` | 闭合泛型类型 / 单态化泛型方法 |
| `make_szarray_type` / `make_mdarray_type` | 数组类型对象 |
| `new_szarray_*` / `new_mdarray_*` | 创建数组实例 |
| `to_array` / `to_bytes` | szarray → JS Array / 原始字节（blittable） |
| `get_opaquevalue` / `set_opaquevalue` | 同步链内读写 Opaque |
| `to_user_data` | Opaque **拷贝** 为 ByVal struct exotic |
| `box` / `unbox` / `cast` | 装箱 / 拆箱 / 引用类型 IEO 门面 |
| `to_delegate` | JS function → 指定 Delegate 类型（形参常可直传 function） |
| `signature` / `register_method` | 参数括号串；空位挂短名（注册后方法调用绑 `this`） |

失败路径统一 **`throw Error('zts: …')`**，**不**用 `undefined` 表示 miss。

指南：[zts 标准库](/docs/guides/zts-lib/) · 全文 [05-LIB](/docs/spec/05-LIB/)

---

## 相关文档

- [JS 调用 C#](/docs/guides/js-calling-csharp/)
- [类型系统概览](/docs/concepts/type-system-overview/)
- [Exotic 模型](/docs/concepts/exotic-model/)
- [参考总览](/docs/reference/overview/)
