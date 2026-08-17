---
sidebar_position: 12
title: 值类型
description: enum、struct、Nullable 的默认跨边界形态与常见用法。
---

# 值类型

**enum**、**struct**、**Nullable\<T\>** 均为值类型相关形态。行为以 [Struct Marshal](/docs/spec/marshal/05-STRUCT/)、[Enum Marshal](/docs/spec/marshal/08-ENUM/) 为准。

需要 plain object / `UnpackedValues` / Opaque 等少分配套路时，见 [JsMarshalAs](/docs/guides/js-marshal-as/)、[少 GC Marshal](/docs/guides/zero-gc-marshal/)。

## 形态对照

| 类型 | 默认跨边界形态 | 构造实例 |
|------|----------------|----------|
| **enum** | 整数 `number`（常量） | **无** `new EnumType(...)`；boxed 仅用 `zents.box` |
| **struct** | ByVal exotic 等（见规范） | `new Type(...)` / `Type._default()` |
| **Nullable\<T\>** | 有值同 `T`；无值 → `null` / `undefined`（见默认矩阵） | — |

默认 **不能** 用 `{ X: 1, Y: 2 }` 或 `foo(x, y)` 组装 struct 传入 C#，须 `new Type(...)` / ByVal exotic，或显式 `[JsMarshalAs(Table|UnpackedValues)]`。

## enum

跨边界默认就是 **整数 `number`**（类型对象上的常量也是 number，不是 exotic）：

```javascript
const Color = CSharp.AC['MyGame.Color'];
console.log(Color.Red);           // 整型值，非 exotic
host.SetColor(Color.Red);
host.SetColor(1);                  // underlying 整型亦可
```

比较常量时用 **number**，不要当对象比。类型对象 **无** `[[Construct]]`，**不要**写 `new Color(...)`。

需要 **boxed** 枚举（如部分 `object` 形参）时，只用 `zents.box`：

```javascript
const boxed = zents.box(Color, Color.Red);
const boxed2 = zents.box(Color, 2);
console.log(zents.unbox(boxed));     // underlying number
```

**禁止 `bigint`**。细则见 [Enum Marshal](/docs/spec/marshal/08-ENUM/)。

## struct

```javascript
const Point2D = CSharp.AC['MyGame.Point2D'];
const origin = Point2D._default();
const p = new Point2D(3, 4);
p.X = 10;
p.Y = 20;
```

| 传递 | C# 形参 | 行为 |
|------|---------|------|
| ByVal exotic（如 `new Point2D(...)`） | by-val `Point2D` | **拷贝** |
| 同型 ByVal exotic | `ref` / `out` / `in Point2D` | **真 ref**，可写回 |

| 形态 | 典型来源 | 成员访问 |
|------|----------|----------|
| OpaqueValue | C#→JS byref / 同步链临时 | 无 `.`；用 get/set opaque |
| ByVal exotic | `new Type(...)`、`to_user_data` | ByVal IEO |
| ByObj exotic | `zents.box`、装箱路径 | ByObj IEO |

静态成员经类型对象访问；struct **无继承**。`ref struct` 不作普通 by-val。

## Nullable\<T\>

- C# 无值 ↔ JS `null` /（可选槽位）`undefined`
- 有值时按底层 `T` 的规则 Marshal
- 不要给非 Nullable 的值类型传 `null`/`undefined`

## 完整示例（示意）

```csharp
namespace MyGame
{
    public enum Team { None = 0, Red = 1, Blue = 2 }

    public struct Vec2
    {
        public float X, Y;
        public Vec2(float x, float y) { X = x; Y = y; }
        public static float Dot(Vec2 a, Vec2 b) => a.X * b.X + a.Y * b.Y;
    }
}
```

```javascript
const Team = CSharp.AC['MyGame.Team'];
const Vec2 = CSharp.AC['MyGame.Vec2'];
console.log(Team.Red);
console.log(Vec2.Dot(new Vec2(1, 0), new Vec2(0, 1)));
```

## 常见错误

| 现象 | 处理 |
|------|------|
| enum 当对象比较失败 | 用 integer `number` 比较 |
| `new Color(...)` 失败 | enum **无**构造；传整型，或 `zents.box` |
| struct 修改未回写 | by-val 拷贝；对 `ref` 传入同型 ByVal exotic 或 Opaque |
| `{X,Y}` 传入未标注的 struct | 标 `Table`（见 [JsMarshalAs](/docs/guides/js-marshal-as/)），或先 `new Type(...)` |
| `foo(x,y)` 传入未标注的 struct | 标 `UnpackedValues`（见 [少 GC Marshal](/docs/guides/zero-gc-marshal/)） |
| `ref struct` 作 by-val | 不支持 |

## 相关文档

- [少 GC Marshal](/docs/guides/zero-gc-marshal/)
- [JsMarshalAs](/docs/guides/js-marshal-as/)
- [Struct Marshal](/docs/spec/marshal/05-STRUCT/)
- [Enum Marshal](/docs/spec/marshal/08-ENUM/)
- [ref / out / in](/docs/guides/ref-out-in/)
