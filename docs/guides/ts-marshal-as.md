---
sidebar_position: 18
title: TsMarshalAs
description: 覆盖默认 Marshal；Bytes / Opaque / UnpackedValues / Table / Object 与 XML。
---

# TsMarshalAs

当默认 Marshal（见 [Marshal 总览](/docs/spec/marshal/01-OVERVIEW/)）不够用时，用 **`[TsMarshalAs]`** 或 **XML** 覆盖。权威全文：[02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)。少分配专题见 [少 GC Marshal](/docs/guides/zero-gc-marshal/)。

## 何时需要

- `byte[]` ↔ JS string（`Bytes`）
- struct 用 **多实参槽** 或 **单个 plain object** 组装（`UnpackedValues` / `Table`）
- C#→JS 强制 **Opaque**（`ref`/`out`/`in` **默认已是**）
- 巨大 `string` 不想拷成 JS string（`Object` → ByObj exotic）
- 预编译 DLL 无法改源码 → Settings 挂 XML

可标注：**参数 / 返回值 / 字段 / 属性 / 类型（class、struct）**。
**不可**标在方法上；**不可**标在仍含未绑定泛型形参的槽位。

## 常用 `TsMarshalType`

| 值 | 适用（摘要） | 用途 |
|----|--------------|------|
| `Default` | 全部 | 不覆盖 |
| `Bytes` | `byte[]` / `string` | octet ↔ JS string |
| `OpaqueValue` | **仅 C#→JS** | Push Opaque；byref 默认已是 |
| `UnpackedValues` | **struct**（**不含** Nullable / class） | 多连续实参 ↔ `Members` |
| `Table` | **struct** / **`Nullable<struct>`**（不含 class） | 单个 plain object ↔ `Members` |
| `Object` | 实质几乎只对 **`string`** | 强制 ByObj exotic（原 zlua `UserData`） |

`Table` / `UnpackedValues` **必须**配置 `Members`；名字以 `?` 结尾表示 Table 侧缺键不赋值。

## 用例

### Bytes

```csharp
public void Send([TsMarshalAs(TsMarshalType.Bytes)] byte[] payload) { }
```

```javascript
host.Send("\0\1\2\3");   // JS string，原始字节语义
```

### UnpackedValues（struct 多槽）

形参占用 **N 个** JS 实参槽（N = `Members` 长度），热路径常用：

```csharp
using ZTS;

public struct Vec2 { public float X, Y; }

public class Mover
{
    public void Move(
        [TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
        Vec2 delta) { /* ... */ }

    [return: TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "X", "Y" })]
    public Vec2 Origin() => new Vec2 { X = 0, Y = 0 };
}
```

```javascript
const m = new CSharp.AC.Mover();
m.Move(3.0, 4.0);           // 两槽 → X, Y

const pair = m.Origin();    // C#→JS：长度 N 的 Array（或 bridge 约定），见规范
```

类型级标注：

```csharp
[TsMarshalAs(TsMarshalType.UnpackedValues, Members = new[] { "x", "y", "z" })]
public struct Vector3 { public float x, y, z; }
```

### Table（struct / Nullable\<struct\>）

占用 **1** 个实参槽；可读性更好，但 JS 侧有 plain object 分配：

```csharp
public void Submit(
    [TsMarshalAs(TsMarshalType.Table, Members = new[] { "Id", "X", "Y", "Tag?" })]
    Packet p) { }

public void TryPlace(
    [TsMarshalAs(TsMarshalType.Table, Members = new[] { "X", "Y" })]
    Vector2? pos) { }
```

```javascript
host.Submit({ Id: 1, X: 2, Y: 3 });   // Tag 可省略
host.TryPlace({ X: 1, Y: 2 });
host.TryPlace(null);                    // Nullable 无值
```

### OpaqueValue / Object

```csharp
// by-val 强制 Opaque（C#→JS）；ref/out/in 无需再标
public void PushPos([TsMarshalAs(TsMarshalType.OpaqueValue)] Vector3 p) { }

public void HandleHuge(
    [TsMarshalAs(TsMarshalType.Object)] string payload) { }
```

Opaque 用 `zts.get_opaquevalue` / `set_opaquevalue`；**不可**跨帧保存。`Object` on `string` 走 ByObj，避免生成巨大 JS string（仍会产生 userdata GC）。

### params 陷阱

默认 **不能** `Sum(1,2,3)` 多槽隐式收集；须传 **单个** Array / 数组 exotic / `null`。

## 优先级与 XML

**槽位 Attribute → XML → 类型级 Attribute → 内置默认**；Attribute 胜 XML。

非法类型/方向 → 回退 `Default` + Editor 日志；缺 `Members` 等 → **绑定期 / Generate 失败**。

Settings **`marshalAsXmlPaths`**；根元素 **`ZTSMarshalAs`**。Mono 运行时解析；Il2Cpp 在 **Generate** 写入表，**Player 不读 XML**。别名走独立 `tsAliasXmlPaths`。完整 schema 见 [规范 §9](/docs/spec/marshal/02-MARSHAL-AS/)。

## 相关文档

- [少 GC Marshal](/docs/guides/zero-gc-marshal/)
- [值类型](/docs/guides/value-types/)
- [02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)
- [OPAQUE](/docs/spec/marshal/04-OPAQUE/)
