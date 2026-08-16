---
sidebar_position: 3
title: Attributes
description: TsMarshalAs / TsAlias / TsExtension。
---

# Attributes

宿主与绑定相关的三个特性均定义于 **`ZTS.Common`**。完整语义见对应规范；本页为签名、合法值与链接速查。

| 特性 | 用途 | 规范 |
|------|------|------|
| `[TsMarshalAs]` | 覆盖默认 Marshal | [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/) |
| `[TsAlias]` | 方法 JS **最终名**（替换默认名） | [04-METHOD-OVERLOAD](/docs/spec/04-METHOD-OVERLOAD/) §5 |
| `[TsExtension]` | 在被扩展类型上声明扩展类列表 | [13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/) |

---

## `[TsMarshalAs]`

覆盖 C# ↔ JS 双向调用时的默认 Marshal。可标于 **参数、返回值、字段、属性**，以及 **类型**（`class` / `struct` 上的类型级默认）。

**禁止**标注在 **方法** 上（绑定期配置异常或 Mono 告警回退）。

```csharp
using ZTS;

public enum TsMarshalType
{
    Default,
    Object,           // 强制 ByObj / ByVal exotic（对 string：默认 JS string → 托管 String exotic）
    Bytes,            // byte[] ↔ JS string（原始 octet）
    OpaqueValue,      // 仅 C#→JS：Push OpaqueValue
    UnpackedValues,   // struct：多 JS 实参 ↔ Members
    Table,            // struct / Nullable<struct>：plain object ↔ Members
}

[AttributeUsage(
    AttributeTargets.Parameter | AttributeTargets.ReturnValue |
    AttributeTargets.Field | AttributeTargets.Property |
    AttributeTargets.Class | AttributeTargets.Struct)]
public sealed class TsMarshalAsAttribute : Attribute
{
    public TsMarshalType MarshalType { get; }
    public string[] Members { get; set; }  // Table / UnpackedValues 必填
    public TsMarshalAsAttribute(TsMarshalType marshalType = TsMarshalType.Default);
}
```

### 合法值摘要（`Default` 除外）

| C# 类型 | 可显式标注 |
|---------|------------|
| 基元 / `IntPtr` 族 | **仅 `Default`** |
| `string` | `Object`、`Bytes`、`OpaqueValue` |
| `byte[]` | `Bytes`、`Object`、`OpaqueValue` |
| `T[]` / mdarray | `Object`、`OpaqueValue` |
| `enum` | `OpaqueValue` |
| `struct` | `Object`、`OpaqueValue`、`Table`、`UnpackedValues` |
| `class` / `interface` | `Object`、`OpaqueValue` |
| `Nullable<T>`（T 为 struct） | `Object`、`OpaqueValue`、`Table`（**无** `UnpackedValues`） |
| `ref` / `in` / `out` | 默认已是 OpaqueValue（通常无需再标） |

**方向：** `OpaqueValue` **仅** C#→JS；标于纯 JS→C# 形参 → 非法。

**非法组合：** Mono Attribute → 错误日志 + 回退 `Default`；Il2Cpp Generate / XML → 可硬失败。

**开放泛型位置禁止标注**（须已闭合）。预编译 DLL 可用独立 MarshalAs XML（与 Alias / Extension **分文件**）。

指南：[TsMarshalAs](/docs/guides/ts-marshal-as/) · [少 GC Marshal](/docs/guides/zero-gc-marshal/) · [Marshal 概览](/docs/concepts/marshal-overview/)

---

## `[TsAlias]`

为方法指定 **唯一最终 JS 名**，**替换** `MethodInfo.Name`（**不**双挂）。允许与其它默认名 / 别名撞名 → 进入同一 overload 组；单候选则为 direct。

```csharp
using ZTS;

[AttributeUsage(AttributeTargets.Method, AllowMultiple = false, Inherited = false)]
public sealed class TsAliasAttribute : Attribute
{
    public string Alias { get; }
    public TsAliasAttribute(string alias);
}

[TsAlias("run_i32")]
public void Run(int value) { ... }
```

| 项 | 约定 |
|----|------|
| 目标 | 仅 **Method**；每方法最多一个别名 |
| 继承 | **不**继承到子类重写 |
| 优先级 | Attribute **>** XML（Settings **`tsAliasXmlPaths`**，根元素 **`TsAlias`**） |
| Player | Generate 写入静态表；**不**运行时读 XML |

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

指南：[TsAlias](/docs/guides/ts-alias/) · [重载](/docs/guides/overloads/)

---

## `[TsExtension]`

标在 **被扩展类型** 上，列出扩展类；Bind 时把匹配的 `public static` extension 注入该类型 **实例** method 表（`obj.ExtMethod(args)` 方法调用绑定 `this`）。

**禁止**标在扩展类上再反查；**不做**全局扫描所有 `ExtensionAttribute`。

```csharp
using ZTS;

[TsExtension(typeof(TransformExt), typeof(TransformTweenExt))]
public class MyBehaviour : MonoBehaviour { }
```

| 项 | 约定 |
|----|------|
| 目标 | **Type**；`AllowMultiple` 允许，多条取 **并集** |
| 继承 | Bind 时 walk `BaseType` 链收集 |
| XML | Settings **`tsExtensionXmlPaths`**，根元素 **`ZTSExtensions`**（与 Alias **分文件**） |
| 同名 | 与真实例方法 **合并竞争**（无「实例优先」） |
| 开放泛型扩展 | **不支持** |

指南：[扩展方法](/docs/guides/extension-methods/) · 规范 [13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/)

---

## Mono / Il2Cpp

| 特性 | Mono (Editor) | Il2Cpp (Player) |
|------|:-------------:|:---------------:|
| `TsMarshalAs` | ✅（非法 → 日志回退） | ✅（Generate/XML 可硬失败） |
| `TsAlias` | ✅ | ✅（Generate 静态表） |
| `TsExtension` | ✅ | ✅（Generate 静态表） |

## 相关文档

- [宿主 API](/docs/spec/01-HOST-API/)
- [Marshal 规范](/docs/spec/marshal/)
- [参考总览](/docs/reference/overview/)
