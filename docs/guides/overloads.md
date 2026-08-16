---
sidebar_position: 10
title: 方法重载
description: 默认分派、全签名键、TsAlias 与 register_method 短名。
---

# 方法重载

JavaScript 无静态类型，同名多签名不能靠编译期选定。ZTS 提供：默认分派、**全签名键**（Bind 自动）、`[TsAlias]`、以及 `zts.register_method` 短名。权威细则：[方法重载规范](/docs/spec/04-METHOD-OVERLOAD/)。

日常 `demo.Run(10)` 在 [JS 调用 C#](/docs/guides/js-calling-csharp/) 已够用；歧义或热路径再读本篇。

## 怎么选

| 方式 | 写法 | 何时用 |
|------|------|--------|
| 默认 dispatch | `demo.Run(10)` | 实参能唯一匹配 |
| **全签名键**（自动） | `demo['Run(System.Int32)'](5)` | 精确点名；**无需** `register_method` |
| `[TsAlias]` | `demo.run_i32(5)` | 能改 C#，热路径短名 |
| `register_method` | 注册后 `demo.run_i32(5)` | 不能改 C#，又要短名 |

### 方法调用 vs 提取函数

| 写法 | CLR `this` |
|------|------------|
| **方法调用** `obj.Method(args)` / `obj['Run(System.Int32)'](5)` | ✅ 自动绑定 |
| **提取** `const fn = obj.Method; fn(args)` | ❌ 不绑定（未定义或抛错；实现须可诊断） |

全签名键含括号，须用属性访问再 **以方法调用形式** 调用：`obj['Run(System.Int32)'](10)`。**不要**写成 Lua 式显式传 `self`。

## 默认 dispatch

```javascript
demo.Run(10);        // Run(int)
demo.Run("hello");  // Run(string)
```

仅一个 public 重载时为零分派；多个时按实参匹配。无匹配 → `throw Error('zts: no overload for …')`。

## 默认参数

支持 C# **尾部**可选形参（`HasDefault`）。JS 实参个数可落在 `[minArity, maxArity]`；省略的尾部在 invoke 时填 C# 默认值。

```csharp
public static int Foo(int x, int y = 5) => x + y;
public static int G(int x) => x;
public static int G(int x, int y = 5) => x + y;
```

```javascript
Demo.Foo(1);       // y=5
Demo.Foo(1, 9);
Demo.G(1);         // 选 G(int)，而非「用默认展开」的 G(int,int)
Demo.G(1, 4);      // G(int, int)
```

| 规则 | 说明 |
|------|------|
| 仅尾部连续默认 | 与 C# 相同：中间不能「跳过」必选形参 |
| 过少实参 | 无法覆盖到首个无默认形参 → 无匹配重载 |
| 多重载 tie-break | 转换分数相同时，**少用默认参数**的候选更优 |
| `undefined` | 可选形参可用；**必选**形参传 `undefined` → 不匹配 |
| 构造 | `new Type(...)` 同样支持 |

## 全签名键（同名冲突时自动注册）

当同一最终名有多个重载时，除 dispatch 外，Bind 还会为每个候选挂 **direct** 键：`方法名(参数 Type.FullName, …)`（**不含**返回类型）。

```javascript
demo.Run(5);                              // dispatch
demo['Run(System.Int32)'](5);            // direct；方法调用绑定 this
demo['Run(System.String)']("hi");

const fn = demo['Run(System.Int32)'];
fn(5);                                    // ❌ 提取后不绑定 this
```

| 键 | 含义 |
|----|------|
| `Run` | 运行时分派 |
| `Run(System.Int32)` | 固定 `Run(int)` |
| `Run(System.String)` | 固定 `Run(string)` |

`zts.signature(zts.types.int32)` 只生成 `"(System.Int32)"`，**不能**单独当键。

## `[TsAlias]` 与 `register_method`

```csharp
[TsAlias("run_i32")]
public void Run(int value) { }
public void Run(string value) { }
```

```javascript
demo.run_i32(10);   // 短名；Run(int) 已换名，不再挂 "Run"
demo.Run("hi");     // 未换名的 Run(string)

const run = demo['Run(System.Int32)'];
zts.register_method("run_hot", run);
demo.run_hot(5);    // 空位短名；已占用名 → throw
```

别名是 **换名**（替换默认 JS 键），不是追加。详见 [TsAlias](/docs/guides/ts-alias/)。扩展方法与实例合并候选见 [扩展方法](/docs/guides/extension-methods/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| 调错重载 / ambiguous | 全签名键、`[TsAlias]` 或 `register_method` |
| `argument mismatch`（带默认） | 必选形参未给够；不能跳过中间参数 |
| 仅用 `'(System.Int32)'` 作键 | **禁止**；须 `Run(System.Int32)` |
| 提取后调用无 this | 保持 `obj.Method(...)` 方法调用形式 |
| `register_method` 报已占用 | 换未使用的别名；不要覆盖 `Run` / 全签名键 |

## 相关文档

- [TsAlias](/docs/guides/ts-alias/) — Attribute + XML
- [方法重载规范](/docs/spec/04-METHOD-OVERLOAD/)
- [zts 标准库](/docs/guides/zts-lib/)
- [扩展方法](/docs/guides/extension-methods/)
