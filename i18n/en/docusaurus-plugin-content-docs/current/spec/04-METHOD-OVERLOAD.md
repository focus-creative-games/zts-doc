---
sidebar_position: 4
title: "方法重载"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`04-METHOD-OVERLOAD.md`）
:::


# 04 — 方法重载

> C# 方法重载在 JavaScript 侧的解析与调用策略。适用于 **Il2Cpp（Player）** 与 **Mono（Editor）**。
> 继承与 Bind 规则见 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §5；`zts` API 见 [05-LIB.md](./05-LIB.md)。

---

## 1. 问题与目标

C# 允许同名方法因参数类型/个数不同而重载；JavaScript 无静态类型，无法仅凭 `obj.Run(x)` 在编译期选定重载。

| 目标 | 说明 |
|------|------|
| 易用 | `demo.Run(10)` 在常见场景下应能工作 |
| 精确 | 同名冲突时 Bind 期自动挂 **全签名键**；亦可 `[TsAlias]` / `register_method` 挂短名 |
| 性能 | 热路径优先单候选 direct（全签名键、别名、或本地缓存 closure），避免反复 dispatch |
| 一致 | Mono 与 Il2Cpp 选中同一重载，错误信息一致（`zts:` 前缀） |

**方法 `this`：** `obj.Method(args)` 作为 **方法调用** 时自动传入 CLR `this`；**提取** 的函数 **不** 自动绑定（[00-OVERVIEW.md](./00-OVERVIEW.md) §6）。

---

## 2. 三层机制（优先级）

```text
flowchart LR
    A["访问键 finalName"] --> B{该键下候选数}
    B -->|1| C["direct function"]
    B -->|≥ 2| E["dispatch function"]
    E --> F["按 §3.6 选 overload"]
    S["全签名键 Name(Types…)"] --> C
    G["[TsAlias] / 本地缓存"] --> C
    H["register_method 新名"] --> C
```

1. **按最终名字分组**（§3、§5）：每个方法以其 **最终 JS 名**（C# 默认名、`[TsAlias]` / XML 别名）进入分组；**同名允许多候选**（仅 Bind 期）。
2. **单候选 → direct；多候选 → dispatch**（§3.6）。
3. **同名多候选时额外挂全签名键**（§3.7）：每个冲突重载再注册 **direct** 键 `MethodName(ParamTypeFullNames…)`（**不含**返回类型）。
4. **运行时**（§6）：`register_method` 仅允许挂到 **尚不存在** 的新最终名（§6.1）。

---

## 3. 默认名与 dispatch

### 3.1 注册规则（按最终名字分组）

在同一类型、同一 `is_static` 域、同一实例形态（ByVal / ByObj）内：

| 该最终名下的候选数 | 三表键绑定 |
|--------------------|------------|
| 1 | **direct method function** |
| ≥ 2 | **dispatch function**（§3.6 选具体重载） |

来源：多个 C# 同名重载；`[TsAlias]` 撞名；**C# extension**（[13-EXTENSION-METHODS.md](./13-EXTENSION-METHODS.md)）与实例方法 **同一最终名** → **合并竞争**（无「实例优先」）。

> **`zts.register_method` 除外：** 运行时 **禁止** 使用已存在的最终名（§6.1）。

静态与实例 **分表**（STO `staticMap` vs IEO `byvalInstanceMap` / `byobjInstanceMap`）。

### 3.2 重载候选顺序

分派时在 **applicable** 重载中按 **§3.6 better function member** 选优；**不得**因 metadata 顺序跳过更优重载。

同分 tie-break：

1. Codegen 声明顺序
2. 反射兜底：完整签名字典序

### 3.3 参数匹配规则

在 **JS 实参个数**可接受的前提下，按实参索引逐 **CLR 形参**判断（`UnpackedValues` 占多槽，见 [marshal/02-MARSHAL-AS.md](./marshal/02-MARSHAL-AS.md) §5.5）。与 marshal `TryPop` 一致，包括但不限于：

| JS 实参 | C# 形参 | 规则 |
|---------|---------|------|
| `number`（整数） | `int` / `long` 等 | 范围内；**禁止 bigint** |
| `number`（非整数） | `int` | **不匹配** |
| `number` | `float` / `double` | 允许 |
| `string` | `string` | 允许 |
| **`null`** | 引用 / `Nullable<T>` | 允许 |
| **`undefined`** | 必选形参 | **不匹配**（或 throw，见 overload 失败路径） |
| **`undefined`** | 可选（`HasDefault`） | 使用默认值 |
| **`undefined`** | `Nullable<T>` | 无值 |
| exotic | 引用类型 | 运行时类型可赋值 |
| 基元 / `string` | **`object`** | `ImplicitBoxing` / `ImplicitReference` |
| ByVal 值类型 | **`object` / interface** | 可装箱时 `ImplicitBoxing` |
| 基元 | **class / interface（非 object）** | **不匹配** |
| `Array` / exotic + `params T[]` | `params` | **单实参槽**；**不**多实参隐式收集 |
| N 连续实参 | `UnpackedValues` | 占用 **N** 槽 |

**可选 / 默认参数：**

| 规则 | 说明 |
|------|------|
| 适用范围 | 方法与构造；**尾部连续** `HasDefault` 段 |
| 实参个数 | `minJsArity ≤ argCount ≤ jsArity` |
| 填充 | Bind 期物化默认值；invoke 写入未提供形参 |
| 选优 | 转换 kind 相同时 **`optionalUsed` 更小** 更优 |

```csharp
void Foo(int x, int y = 5);
void G(int x);
void G(int x, int y = 5);
```

| JS | 结果 |
|----|------|
| `Foo(1)` | OK；`y` 默认 |
| `Foo()` | 不适用 |
| `G(1)` | 选 `G(int)` |
| `G(1, 4)` | 选 `G(int,int)` |

**构造函数：** `new Type(...)` 使用相同分派（含默认参数）。

### 3.4 性能说明

dispatch 为低效路径。热点应使用：

- **全签名键**（§3.7，已是 direct）；
- **单候选** `[TsAlias]` 名；
- `register_method` 短名；
- 本地缓存：`const run = demo['Run(System.Int32)']`。

### 3.5 失败错误

无匹配 → **`throw new Error('zts: no overload for Demo.Run matching …; candidates: …')`**。

### 3.6 隐式转换分类与最优重载

#### 3.6.1 设计原则

1. **`ConversionKind` 只描述 C# 隐式转换类别**。
2. **选优与 C# better function member 一致**。
3. **Mono / Il2Cpp** 须选中同一重载。

#### 3.6.2 `ConversionKind`

| Kind | 含义 |
|------|------|
| `Identity` | 类型相同 |
| `ImplicitNumeric` | 隐式数值拓宽 |
| `ImplicitEnum` | integer `number` → enum |
| `NullLiteral` | **`null`** → 引用 / Nullable |
| `ImplicitReference` | 子类→父类；`string`→`object` |
| `ImplicitBoxing` | 值类型→`object` / interface |
| `None` | 不匹配 |

优劣链：

`Identity` ≻ `ImplicitNumeric` ≻ `ImplicitEnum` ≻ `NullLiteral` ≻ `ImplicitReference` ≻ `ImplicitBoxing`

**`undefined` 对必选形参** → `None`（除非 optional 规则接管）。

#### 3.6.3 Better function member

1. 逐形参 `GetConversionKind`；任一 `None` → 不适用。
2. M 优于 N：存在 i 使 M 更优，且无 j 使 N 更优。
3. 仍相同：比 `optionalUsed`。
4. 仍无 strictly better → Ambiguous 或声明顺序 tie-break。

#### 3.6.4 invoke 期隐式 Box

仅当 Kind 为 `ImplicitBoxing` 时，在 **已选定重载** 的 `TryPop` 内 Box。**禁止**在 `GetConversionKind` 循环内 Box。

### 3.7 同名冲突：全签名键（Bind 期自动）

候选数 ≥ 2 时，除 dispatch 外，为 **每个** 候选再注册 direct 键：

```text
<MethodName>(<Type0.FullName>,<Type1.FullName>,…)
```

| 规则 | 说明 |
|------|------|
| 何时 | **仅** 该最终名下 ≥ 2 候选 |
| 方法名 | C# `MethodInfo.Name`（非 `[TsAlias]` 短名） |
| 参数 | `Type.FullName` 逗号分隔；**不含**返回类型 |
| 绑定 | 该候选 **direct function** |

**示例：** `Run(int)` 与 `Run(string)`：

| 键 | 绑定 |
|----|------|
| `Run` | dispatch |
| `Run(System.Int32)` | direct → `Run(int)` |
| `Run(System.String)` | direct → `Run(string)` |

```javascript
const demo = new CSharp.AC.Demo();

demo.Run(5);                              // dispatch
demo.Run("hi");                           // dispatch

demo['Run(System.Int32)'](5);             // direct；方法调用绑定 this
demo['Run(System.String)']("hi");

const fn = demo['Run(System.Int32)'];
fn(5);                                    // ❌ 不绑定 this
```

短名冒号式体验：`register_method` 或 `[TsAlias]` → `demo.run_i32(5)`。

---

## 4. 签名字符串规范

### 4.1 `zts.signature`

```javascript
const sig = zts.signature(zts.types.int32);
// "(System.Int32)"

const sig0 = zts.signature();
// "()"
```

- 参数为 typeArg（类型对象、`zts.types.*`、mscorlib 字符串）
- **不包含** 方法名
- 格式：括号 + **`Type.FullName`** 列表

Native：`__zts_create_signature`（`ZTSLib`）。`ztslib.js` 封装为 `zts.signature(...)`。

### 4.2 全签名键 = 方法名 + §4.1

```text
"Run" + "(System.Int32)"  →  "Run(System.Int32)"
```

**禁止** 仅用 `"(System.Int32)"` 作键。

---

## 5. 别名机制（`[TsAlias]`）

### 5.1 模型：换名 + 按最终名分组

`[TsAlias]` / XML 指定 **唯一最终 JS 名**，**替换** C# 默认名（**不**双挂）。

| 来源 | 条件 |
|------|------|
| `[TsAlias("…")]` | Attribute 非空 |
| XML `Method/@alias` | 无 Attribute 时 |
| `MethodInfo.Name` | 以上皆无 |

```
按 finalName 聚合 → 1 → direct；≥ 2 → dispatch
```

- **允许**别名与默认名 / 其它别名 **重复**（撞名 → overload 组）；
- **不允许**「默认名 + 别名」双挂。

### 5.2 示例

```csharp
public class Demo
{
    public void Run(int value) { }
    public void Run(string value) { }

    [TsAlias("Foo")]
    public void Bar(string s) { }   // 不再挂 "Bar"

    [TsAlias("run_i32")]
    public void Run(long value) { } // 不再挂默认 "Run" 对此重载
}
```

```javascript
demo.Run(10);         // dispatch（int/string）
demo.Foo("hi");       // dispatch（Foo(int)+Bar(string)）
demo.run_i32(10);     // direct → Run(long)
```

### 5.3 C# Attribute

```csharp
[TsAlias("run_i32")]
public void Run(int value) { ... }
```

定义于 `ZTS.Common`。Attribute **优先于** XML。

### 5.4 XML 配置（独立于 MarshalAs）

| 约束 | 说明 |
|------|------|
| **独立路径** | Settings **`tsAliasXmlPaths`**（与 `marshalAsXmlPaths` **分开**） |
| **独立根元素** | **`TsAlias`** |
| **分文件** | 不得写入 `ZTSMarshalAs` |

```xml
<?xml version="1.0" encoding="utf-8"?>
<TsAlias version="1">
  <Assembly name="Assembly-CSharp">
    <Type fullName="Demo">
      <Method name="Run" signature="(System.Int32)" alias="run_i32"/>
    </Type>
  </Assembly>
</TsAlias>
```

| 属性 | 含义 |
|------|------|
| `Method/@name` | CLR 方法名 |
| `Method/@signature` | 与 MarshalAs XML 相同约定 |
| `Method/@alias` | **必填**；最终 JS 名 |

Mono 运行时加载；Il2Cpp **Generate** 静态表；Player **不**读 XML。

同一 `(assembly, type, methodName, signature)` 多条 alias → **失败**。不同方法撞同一最终名 **允许**。

### 5.5 静态 / 实例

分组 **不得**跨静/实例或 ByVal/ByObj。

### 5.6 与 field / property 同名

`__index` 仍 **methodTable 优先**（[metatable/02-INDEX.md](./metatable/02-INDEX.md)）。

---

## 6. 运行时 API

优先顺序：

1. **全签名键**（§3.7）
2. Bind 期 **`[TsAlias]`**
3. **`register_method`** 挂新短名

### 6.1 `zts.register_method`

```javascript
zts.register_method(aliasName, methodOrClosure);
```

**用途：** 把 **direct** closure 挂到 **尚不存在** 的短名；之后 **`obj.aliasName(args)`** 方法调用绑定 `this`。

```javascript
const demo = new CSharp.AC.Demo();

demo['Run(System.Int32)'](5);           // 全签名 direct

const run_i32 = demo['Run(System.Int32)'];
zts.register_method("run_i32", run_i32);

demo.run_i32(5);                         // ✅ 方法调用 + this
```

| 参数 | 说明 |
|------|------|
| `aliasName` | 非空；**新**最终名 |
| `methodOrClosure` | **direct method function**（`IsDirectMethodClosure`） |

**写入目标（由 closure 内嵌 `TypeBinding` 推断）：**

| closure 域 | 写入 |
|------------|------|
| 静态 | `staticMap` |
| 实例 ByVal | `byvalInstanceMap` |
| 实例 ByObj | `byobjInstanceMap` |

| 情况 | 行为 |
|------|------|
| `aliasName` **不存在** | 写入 direct |
| `aliasName` **已存在** | **`throw Error('zts: …')`** |
| 传入 **dispatch** | **throw** |

与 `[TsAlias]`：Bind 期允许撞名；`register_method` **仅空位挂名**。

Native：`__zts_register_method`。

---

## 7. 调用约定摘要

| 场景 | 写法 |
|------|------|
| 默认分派 | `demo.Run(10)` |
| 全签名键 | `demo['Run(System.Int32)'](10)` |
| `[TsAlias]` | `demo.run_i32(20)` |
| `register_method` 后 | `demo.run_cached(20)` |
| 静态 | `Demo.Add(3, 5)` |
| 提取函数 | `const f = demo.Run; f(10)` ❌ |

---

## 8. Mono / Il2Cpp 一致性

分组、全签名键、别名重复、签名格式、dispatch、选中重载、`register_method` 两参数与占用名拒绝、错误文案 — **须一致**。

---

## 9. 完整示例

```csharp
public class Demo
{
    public void Run(int value) { }
    [TsAlias("run_str")]
    public void Run(string value) { }
    public void Foo(int x) { }
    [TsAlias("Foo")]
    public void Bar(string s) { }
    public static int Add(int a, int b) => a + b;
    [TsAlias("add_i32")]
    public static int Add(int x) => x;
}
```

```javascript
const demo = new CSharp.AC.Demo();

demo.Run(10);
demo.Run("ab");
demo['Run(System.Int32)'](10);

demo.Foo("hi");

const run_i32 = demo['Run(System.Int32)'];
zts.register_method("run_cached", run_i32);
demo.run_cached(20);

console.assert(CSharp.AC.Demo.add_i32(7) === 7);
```

---

## 10. 实现落点（参考）

| 模块 | 职责 |
|------|------|
| `ValueMarshaling` | `ConversionKind`、`TryPop` |
| `FindMatchingMethod` | applicable + better member |
| `MetaBinding` | dispatch、direct、`register_method` |
| `ZTSLib` | `__zts_create_signature`、`__zts_register_method` |

C# Extension 见 [13-EXTENSION-METHODS.md](./13-EXTENSION-METHODS.md)。
