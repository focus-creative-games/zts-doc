---
sidebar_position: 13
title: "C# Extension 方法"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`13-EXTENSION-METHODS.md`）
:::


# 13 — C# Extension 方法

> 约定如何把 C# **extension methods** 暴露到被扩展类型的 JavaScript **实例** method 表（`obj.ExtMethod(args)` 方法调用绑定 `this`）。
> 适用于 **Il2Cpp（Player）** 与 **Mono（Editor）**。
> 成员 Bind → [metatable/03-BINDING.md](./metatable/03-BINDING.md)；重载 → [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md)；别名 → 同文 §5。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| JS 体验 | `obj.ExtFoo(...)` 调用已配置可见的 C# extension（**方法调用**自动传入 CLR `this`） |
| 发现模型 | **被扩展类型 → 扩展类列表**；Bind 该类型时只反射这些扩展类 |
| Attribute | **`[TsExtension]` 标在被扩展类型上**（可列多个扩展类） |
| 调用语义 | **static-as-instance**：进 **IEO method 表**；JS 实参槽 0 → CLR 第 0 参（`this`） |
| 同名 | 与真实例方法 **合并竞争**（无「实例优先」） |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| 全局扫描所有 `ExtensionAttribute` | **不做** |
| 把 `[TsExtension]` 标在扩展类上再反查被扩展类型 | **不做** |
| 仅在扩展类 STO 上当静态方法调用当作「已支持 extension」 | **不足**；必须 IEO + 实例方法调用 |
| Il2Cpp Player 运行时读 XML | **不做**（与 `TsAlias` / MarshalAs 一致） |
| 开放泛型扩展方法（未闭合） | **不支持** |

### 1.3 锁定决策摘要

| 项 | 决策 |
|----|------|
| 配置键 | 被扩展类型；值为扩展类列表 |
| 方法筛选 | `ExtensionAttribute` + `public static` + 首参可从目标类型赋入 |
| Attribute 位置 | **仅**被扩展类型 |
| 重载 | **合并竞争** |

---

## 2. 配置源（发现扩展类列表）

Bind 类型 **T** 时，扩展类列表 = **Attribute 并集 ∪ XML 并集**（§2.3）。

### 2.1 `[TsExtension]`（标在被扩展类型上）

```csharp
using ZTS;

[TsExtension(typeof(TransformExt), typeof(TransformTweenExt))]
public class MyBehaviour : MonoBehaviour { }

// 无法改第三方类型源码时：改用 §2.2 XML
```

| 项 | 约定 |
|----|------|
| 目标 | **Type**（class / struct / interface 等可 Bind 类型） |
| 参数 | 一个或多个 `System.Type`，每个为 **扩展类**（通常为 `static` 类） |
| `AllowMultiple` | **允许**；多条 Attribute 的类型列表取 **并集** |
| 继承元数据 | Bind **T** 时 **walk `BaseType` 链**，收集 T 及基类上的 `[TsExtension]` |
| 接口 | 仅当为接口 **U** 配置了扩展类、且 Bind 的 T 能匹配 `this U` 时注入；**不**因 T 实现某接口就自动注入未配置的扩展类 |

**禁止**将 `[TsExtension]` 标在扩展类上作为发现手段。

### 2.2 XML（`tsExtensionXmlPaths` / `ZTSExtensions`）

与 `TsAlias` **分文件、分 Settings 字段**：

| | Extension | Alias |
|--|-----------|-------|
| Settings | **`tsExtensionXmlPaths`** | **`tsAliasXmlPaths`** |
| 根元素 | **`ZTSExtensions`** | **`TsAlias`** |

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZTSExtensions version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Transform">
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformExt"/>
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformTweenExt"/>
    </Type>
  </Assembly>
</ZTSExtensions>
```

| 属性 | 说明 |
|------|------|
| `Assembly/@name` | **被扩展类型**所在程序集短名 |
| `Type/@fullName` | 被扩展类型 CLR 全名 |
| `Extension/@assembly` | 扩展类所在程序集短名 |
| `Extension/@fullName` | 扩展类 CLR 全名 |

本文件 **只**允许上述结构；不要写入 `Method` / `MarshalAs` / `alias` 等。

### 2.3 合并与平台

| 项 | 约定 |
|----|------|
| 同一被扩展类型 | Attribute 列表 ∪ XML 列表（**并集**） |
| Mono | `Initialize` 加载 `tsExtensionXmlPaths`；Bind 时解析 |
| Il2Cpp | **Generate** 写入静态表；**Player 不读 XML** |
| 扩展类无法解析 | Generate **硬失败**；Mono **throw**（**不**静默丢） |

---

## 3. Bind 期收集扩展方法

在 `EnsureBinding(T)` 中，于类型自身（及继承扁平化后的）真实例方法收集之后：

1. 按 §2 得到扩展类列表（去重）。
2. 对每个扩展类取 `public static` 方法，**同时**满足：
   - 带 `System.Runtime.CompilerServices.ExtensionAttribute`；
   - 至少 1 个参数；首参类型 `P0` 须 **`P0` 可从 `T` 赋入**；
   - **不是**开放泛型方法。
3. 通过筛选的方法以 **实例域** 候选并入 `byobjInstanceMap`；若 `T` 为 struct，**同步**写入 `byvalInstanceMap`（[metatable/03-BINDING.md](./metatable/03-BINDING.md) §5）。
4. 最终 JS 名仍走 `[TsAlias]` / Alias XML / `MethodInfo.Name`。
5. 与真实例方法按最终名分组 → [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §3 合并竞争。

```text
flowchart TD
  Ensure["EnsureBinding T"] --> Attr["读 T 及基类 TsExtension + XML"]
  Attr --> ExtCls["扩展类列表"]
  ExtCls --> Filter["ExtensionAttribute 且 this 可接 T"]
  Filter --> InstMap["写入 instance method 分组"]
  InstMap --> Overload["与真实例同名合并竞争"]
  Overload --> Fill["Fill IEO closures"]
```

已 `EnsureBinding` 的 T **不**因后加载程序集自动重绑。

---

## 4. static-as-instance

CLR 上 extension 为 **static**，JS 侧必须表现为 **实例方法**。

| 项 | 规定 |
|----|------|
| 表 | **仅**实例 **IEO method 表**；**不**挂到被扩展类型 **STO** |
| 调用 | **静态** `Call` / Invoke；JS **`obj.Method(a,b)`** 方法调用 → receiver 为 CLR 参数 **0**；其余实参对齐 `this` 之后形参 |
| `jsArity` | = CLR 形参个数 **减 1** |
| 全签名键 | `MethodName(Types…)` **只含** `this` **之后** 的形参类型全名（[04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §3.7） |
| Mono / Il2Cpp | Emit 与 MethodBridge 均须识别「extension 候选」标志 |

**禁止：**

- 按普通 **static** 路径（无 receiver）；
- 按普通 **instance** 路径（对扩展方法 declaring type 做虚/实例 `this` 解析）。

**提取函数不绑定 `this`：** 与真实例方法相同，`const f = obj.ExtFoo; f()` **不**自动传入 receiver → throw 或未定义（须一致且可诊断）。

---

## 5. 重载：合并竞争

- 扩展方法与真实例方法 **最终 JS 名相同** → **同一** overload 组（同一 `is_static=false`、同一 ByVal/ByObj）。
- 单候选 → direct；多候选 → dispatch；冲突时全签名键 — 规则同 [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) §3。
- **不**插入「实例方法优先于扩展方法」的 tie-break。
- extension 候选评分时 CLR 形参序列 = **去掉 `this` 后** 的序列。

---

## 6. 脚本可见行为（示例）

```csharp
public static class TransformExt
{
    public static void ResetLocal(this Transform t)
    {
        t.localPosition = Vector3.zero;
    }
}

// 源码可改时：
[TsExtension(typeof(TransformExt))]
public class MyWrapperType { }

// 或 XML：Type=UnityEngine.Transform → Extension=TransformExt
```

```javascript
const t = go.transform;
t.ResetLocal();   // IEO；等价 TransformExt.ResetLocal(t)
```

未配置到该被扩展类型（或基类 Attribute / XML）→ **`throw Error('zts: member not found: ResetLocal')`**，与其它未注册成员相同。

---

## 7. 实现提示（非规范性强制文件名）

| 侧 | 提示 |
|----|------|
| 公共 | `TsExtensionAttribute`；`TsExtensionXmlLoader` / `Registry`；Settings `tsExtensionXmlPaths` |
| Mono | `MetaBinding` 收集扩展并入 instance 分组；`MethodEmitter` static-as-instance |
| Il2Cpp | `MetaBinding` + `Invoke*` extension 路径；`ExtensionCodegen` → 生成表 |

---

## 8. 相关文档

- [metatable/03-BINDING.md](./metatable/03-BINDING.md)
- [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md)
- [01-HOST-API.md](./01-HOST-API.md)（`[TsAlias]`）
- [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md)（方法 `this` 绑定）
