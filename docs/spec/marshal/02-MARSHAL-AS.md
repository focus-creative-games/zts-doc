---
sidebar_position: 8
title: "`[TsMarshalAs]` 与 `TsMarshalType`"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\02-MARSHAL-AS.md`）
:::


# `[TsMarshalAs]` 与 `TsMarshalType`

> **规范性：** 参数、返回值、字段、属性及类型（`class` / `struct`）上的 Marshal 覆盖规则。
> **默认矩阵：** 未覆盖时见 [01-OVERVIEW.md](./01-OVERVIEW.md)。
> **源码：** `ZTS.Common` 中的 `TsMarshalAsAttribute`、`TsMarshalType`（枚举名以本文为准，含 **`OpaqueValue`**）。
> **外部配置：** 预编译程序集可通过 XML 配置等价规则，见 **§9**。

---

## 1. 概述

`[TsMarshalAs]` 可标注于：

- **参数**、**返回值**、**字段**、**属性**
- **类型**（`class` / `struct` 上的类型级默认）

**不可** 标注于 **方法**（绑定期 `TsMarshalAsConfigurationException` 或 Mono 路径告警回退）。

**不可** 作用于 **未确定（open / 含泛型形参）的 CLR 类型位置**（§1.1）；可作用于 **已闭合** 的泛型类型位置（如 `List<int>` 形参）。XML 规则与 Attribute **同一约束**（§9.3.1）。

覆盖标注须符合 **§3 合法集合**，否则 **§4.1** 回退 `Default` 并在 Editor 打错误日志。

```csharp
public enum TsMarshalType
{
    Default,
    Object,           // 强制 ByObj exotic（原 zlua UserData）
    Bytes,
    OpaqueValue,
    UnpackedValues,   // struct / closed generic struct：多 JS 实参 ↔ 列出的成员（不含 Nullable）
    Table,            // struct / closed generic struct / Nullable<struct>：单个 plain object ↔ 列出的成员
}

[AttributeUsage(
    AttributeTargets.Parameter | AttributeTargets.ReturnValue |
    AttributeTargets.Field | AttributeTargets.Property |
    AttributeTargets.Class | AttributeTargets.Struct)]
public sealed class TsMarshalAsAttribute : Attribute
{
    public TsMarshalType MarshalType { get; }

    /// <summary>
    /// <see cref="TsMarshalType.Table"/> / <see cref="TsMarshalType.UnpackedValues"/> 必填。
    /// 元素为 CLR 字段名或 property 名，可混合；顺序即 UnpackedValues 的实参顺序 / Table 的读写顺序。
    /// 名字以 '?' 结尾表示 Table、JS→C# 时缺键不赋值（§6）。
    /// </summary>
    public string[] Members { get; set; }

    public TsMarshalAsAttribute(TsMarshalType marshalType = TsMarshalType.Default);
}
```

> **命名说明：** 文档与 XML 使用 **`TsMarshalType.Object`**（语义等同 zlua 的 `UserData` / ByObj exotic）。实现 C# 枚举名须与本文一致。

### 1.1 泛型：只允许「已确定」的类型位置

`[TsMarshalAs]`（及等价 XML）**不得**用在仍含未绑定泛型形参的类型上：

| 禁止 | 允许 |
|------|------|
| 类型级标在开放定义上 | 类型级标在 **非泛型** `class` / `struct` 上 |
| 形参/字段类型为泛型形参 `T` | 闭合构造：`List<int>` 形参等 |
| 泛型方法上未确定的槽位 | 同一方法上类型已闭合的槽位 |

违反 → **Il2Cpp Generate / XML 失败**；**Mono Attribute** 路径见 **§4.1**。

---

## 2. `TsMarshalType` 枚举说明

| 值 | 适用方向 | 说明 |
|----|----------|------|
| **`Default`** | 双向 | 使用 [01-OVERVIEW.md](./01-OVERVIEW.md) 默认规则。 |
| **`Object`** | 双向 | **仅** 可标注于 **托管引用类型** 与 **struct**（§3）。强制 **ByObj / ByVal exotic** 形态。<br>• **实质有效目标：** 几乎只有 **`string`**——默认 C#↔JS 为 JS **string**，标注后改为 **ByObj exotic**（托管 `System.String`）<br>• **class / 数组 / 普通 struct：** 默认已是 exotic，标注与 `Default` **等价**<br>• **`Delegate`：** 可标注但 **无实质作用**（仍按 [09-FUNCTION.md](./09-FUNCTION.md)） |
| **`Bytes`** | 双向 | C# **`byte[]`** ↔ JS **`string`**（原始 octet）。Pop 时 **不接受** exotic / Array（标注于 `byte[]` 时）。 |
| **`OpaqueValue`** | **仅 C# → JS** | Push **OpaqueValue**（见 [04-OPAQUE.md](./04-OPAQUE.md)）。<br>• **`ref`/`in`/`out`** 默认已是 OpaqueValue<br>• by-val 可对 struct / 引用 / enum / 指针等显式标注；**基元** 与 **`IntPtr` 族禁止** by-val 标注<br>• 脚本经 `zts.get_opaquevalue` / `zts.set_opaquevalue` |
| **`UnpackedValues`** | **双向** | **普通 struct / closed 泛型 struct**（**不含** Nullable）。`Members` 列出的成员与 **连续多个 JS 实参** 互转；占用 **N 个实参槽**（§5.6） |
| **`Table`** | **双向** | **struct / closed 泛型 struct / `Nullable<struct>`**。单个 **plain object**（`{}` 键值）↔ 成员；`Nullable` 无值 → **`null`** 或 **`undefined`**（§6）；须 **`Members`** |

---

## 3. 各类型的合法 `TsMarshalType` 集合

每个 CLR 槽位仅允许 **§2** 中相容的值（**`Default` 对所有类型均合法**）。下表列出 **`Default` 之外** 可显式标注的值。

**`OpaqueValue`：** 仅 C#→JS 方向可标注（§3.1）。**基元** 与 **`IntPtr` 族** **仅 `Default`**。

| C# 类型（分类） | 合法 `TsMarshalType`（`Default` 除外） | 说明 |
|-----------------|----------------------------------------|------|
| **基元** | （无；**仅 `Default`**） | **`ref`/`in`/`out` 基元** → 默认 OpaqueValue |
| **`IntPtr` / `UIntPtr` / `nint` / `nuint`** | （无；**仅 `Default`**） | 整型数值 Marshal |
| **`string`** | `Object`、`Bytes`、`OpaqueValue` | `Object` → ByObj exotic |
| **`byte[]`** | `Bytes`、`Object`、`OpaqueValue` | |
| **`T[]`（szarray）** | `Object`、`OpaqueValue` | |
| **`T[,…]`（mdarray）** | `Object`、`OpaqueValue` | JS→C# **不** 因标注接受 Array |
| **`enum`** | `OpaqueValue` | boxed 用 `zts.box` |
| **`struct`** | `Object`、`OpaqueValue`、`Table`、`UnpackedValues` | |
| **`class` / `interface`** | `Object`、`OpaqueValue` | **不可** `Table` / `UnpackedValues` |
| **`Delegate`** | `Object`、`OpaqueValue` | `Object` 无实质作用 |
| **`object`** | `Object`、`OpaqueValue` | |
| **`ref` / `in` / `out T`** | （通常无需标注） | C#→JS 默认 OpaqueValue |
| **`Nullable<T>`**（`T` struct） | `Object`、`OpaqueValue`、**`Table`** | **不含** `UnpackedValues` |
| **非托管指针 / 函数指针** | `OpaqueValue` | 默认可 Pointer 透传 |
| **`TypedReference`** | （默认即 OpaqueValue） | 其它非法 |
| **`decimal`** | `OpaqueValue` | 默认暂不支持 |
| **`ref struct`** | `OpaqueValue` | |
| **`params T[]`** | `OpaqueValue`（仅 C#→JS） | 默认同 szarray |

### 3.1 方向过滤

| `TsMarshalType` | 允许标注的方向 |
|-----------------|----------------|
| `Object`、`Bytes`、`Table`、`UnpackedValues` | **双向** |
| `OpaqueValue` | **仅 C# → JS**；标于纯 JS→C# 形参 → **非法** |

---

## 4. 非法标注与配置错误

### 4.1 Mono Attribute：日志 + 回退 Default

Mono 解析 Attribute 时非法组合 → **按 `Default` 处理** + **Editor 错误日志**；Player 静默回退。

### 4.2 Il2Cpp Generate / XML：可硬失败

同类配置错误可 **中止 Generate**，不写入 Player 绑定表。

运行时 arity 错误（`UnpackedValues` 实参个数 ≠ `Members.Length`）→ **`throw Error('zts: …')`**。

---

## 5. `Table` 与 `UnpackedValues`（值类型）

| 目标 | `Table` | `UnpackedValues` |
|------|---------|------------------|
| 普通 struct / closed 泛型 struct | ✓ | ✓ |
| `Nullable<T>`（T 为 struct） | ✓ | ✗ |
| class / interface / ref struct / 基元 / enum | ✗ | ✗ |

**默认：** **不** 接受 plain object 或多实参组装；须显式标注 + **`Members`**。

### 5.1 成员名单

- `string[]`：CLR field / property 名，可混合。
- **`Nullable<T>` + `Table`：** 名单解析在 **`T`** 上。
- **`UnpackedValues` 顺序** = JS 实参顺序；**`Table` 键** = 成员名（字符串键）。

### 5.2 `UnpackedValues` 示例

```csharp
void Foo([TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "Y", "X" })] Vector2 v);
```

```javascript
Foo(2.0, 1.0);   // 第一实参 → Y，第二 → X
```

```csharp
[return: TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
Vector2 GetPos();
// JS: const [x, y] = CS.Demo.GetPos();  // 或多返回值绑定为 Array，见 bridge 约定
```

### 5.3 `Table` 示例

```csharp
void Foo([TsMarshalAs(TsMarshalType.Table, Members = new[] { "X", "Y" })] Vector2 v);
```

```javascript
Foo({ X: 1, Y: 2 });
```

```javascript
Bar(null);                  // Nullable 无值
Bar(undefined);             // 同无值（§01 §2.3）
Bar({ X: 1, Y: 2 });
```

### 5.4 嵌套限制

名单成员若为 struct，默认 **不** 自动展开；须该成员自身标注或走 exotic 默认路径（v1 可限制名单仅含标量 / enum / string）。

### 5.5 实参槽占用与调用约定

| `TsMarshalType` | 占用 JS 实参槽数 |
|-----------------|------------------|
| **`Table`** 及其它（除 UnpackedValues） | **1** |
| **`UnpackedValues`** | **N**（`N = Members.Length`） |

- **JS → C#：** 桥接按 **实参光标** 推进：`argIndex += 该形参槽数`。
- **重载分派：** 「JS 实参个数」= 各形参槽数之和（见 [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md)）。
- **C# → JS 返回值：** `Table` → plain object；`UnpackedValues` → **JS Array**（长度 N，按 Members 顺序）或 bridge 约定的多值形态。

---

## 6. Table 可选成员：`?` 后缀

仅 **`Table`** 且 **JS → C#**：

- `"Tag?"` → plain object **缺该键** 时跳过赋值。
- **无 `?`** 的成员缺键 → **`throw Error`**。
- **`UnpackedValues` 不支持 `?`**。

```javascript
Foo({ X: 1, Y: 2 });              // OK；Tag 默认
Foo({ X: 1 });                     // 缺 Y → throw
```

---

## 7. `params T[]` 形参

**范围：** 普通 C# 方法 / 构造函数上的 **`params`**。**GetFunction delegate bridge** 上的 `params` **不支持**（见 [09-FUNCTION.md](./09-FUNCTION.md)）。

**Marshal：** 与 szarray 相同（C#→JS **ByObj exotic**；JS→C# **exotic** 或 **Array**）。

| 传入 | C# 收到 |
|------|---------|
| **ByObj exotic** | 该数组引用 |
| **`[]`** | **`T[0]`** |
| **`Array` `{ … }`** | 构造的 **`T[n]`** |
| **`null`** | **`null`** |
| **`undefined`** | **throw**（§01 §2.3；**非** 空数组） |

**禁止 JS 多实参隐式收集：** `Sum(1, 2, 3)` **非法**；须 `Sum([1,2,3])` 或传 exotic。

```javascript
CS.Demo.Sum([1, 2, 3]);
CS.Demo.Sum([]);           // T[0]
CS.Demo.Prefix(0, [1, 2]);
CS.Demo.Sum(null);
```

---

## 8. 解析优先级

1. 参数 / 返回值上的 `[TsMarshalAs]`（≠ Default）
2. XML 对应规则（§9）
3. 字段 / 属性上的 Attribute → XML
4. 类型级（**仅非泛型**）Attribute → XML
5. [01-OVERVIEW.md](./01-OVERVIEW.md) 内置默认

**Attribute 优先于 XML。** 非法标注：Mono 回退 §4.1；Generate 失败 §4.2。

---

## 9. XML 外部配置（预编译程序集）

> **与 `[TsAlias]` 分离：** 别名使用 **`tsAliasXmlPaths`** / 根元素 **`TsAlias`**（见 [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md) §5.4）。

### 9.1 配置入口

Editor **`ZTS.Settings`**（`ProjectSettings/ZTS.asset`）：

- **`marshalAsXmlPaths`**：仅承载 `ZTSMarshalAs` 规则
- **`tsAliasXmlPaths`**：别名专用（分开配置）

### 9.2 文件格式

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZTSMarshalAs version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Vector3">
      <MarshalAs type="Table" members="x,y,z" />
    </Type>
    <Type fullName="UnityEngine.Transform">
      <Method name="LookAt" signature="(UnityEngine.Vector3)">
        <Param index="0">
          <MarshalAs type="UnpackedValues" members="x,y,z" />
        </Param>
      </Method>
    </Type>
  </Assembly>
</ZTSMarshalAs>
```

| 元素 / 属性 | 含义 |
|-------------|------|
| `Assembly/@name` | 程序集简单名 |
| `Type/@fullName` | CLR 全名；嵌套 `Outer+Inner`；泛型声明 ``Foo`1`` |
| `Method/@name` / `@signature` | 与 overload 文档一致；**不含**返回类型 |
| `Param/@index` | **0-based**；**不含** `this` |
| `MarshalAs/@type` | `Default` / `Object` / `Bytes` / `OpaqueValue` / `UnpackedValues` / `Table` |
| `MarshalAs/@members` | 逗号分隔；`?` 表示 Table 可选键 |

**禁止：** 方法级直接 `MarshalAs`；`Param` 用 `name` 定位；历史名 `UserData` → 须写 **`Object`**。

### 9.3 校验与重复

- 加载时元数据校验；闭合泛型实例作 `Type` 容器 → **失败**
- 同一目标键重复规则 → **整次加载失败**
- Attribute 与 XML 同目标：**Attribute 生效**

### 9.4 Mono 运行时

按 Settings **惰性**加载；热路径 O(1) 查表；**不**拼字符串匹配。

### 9.5 Il2Cpp

**Generate** 写入 C++ 表（**仅名字**，无 metadata token）；Player **不**解析 XML。

---

## 10. 相关文档

| 主题 | 文档 |
|------|------|
| 默认矩阵 / undefined/null | [01-OVERVIEW.md](./01-OVERVIEW.md) |
| OpaqueValue | [04-OPAQUE.md](./04-OPAQUE.md) |
| struct | [05-STRUCT.md](./05-STRUCT.md) |
| 数组 / Bytes | [07-ARRAY.md](./07-ARRAY.md) |
| 方法别名 XML | [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md) §5.4 |
