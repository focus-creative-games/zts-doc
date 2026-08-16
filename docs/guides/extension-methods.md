---
sidebar_position: 16
title: 扩展方法
description: "[TsExtension] 与 XML 将 C# extension 挂到被扩展类型的实例方法表。"
---

# 扩展方法

把 C# **extension methods** 挂到被扩展类型的 JS **实例** method 表，支持 `obj.ExtFoo(...)`（方法调用绑定 CLR `this`）。权威：[13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/)。

**不做**全局扫描 `ExtensionAttribute`。配置模型是：**被扩展类型 → 扩展类列表**；Bind 该类型时再反射这些扩展类。

## 配置

| 方式 | 用法 |
|------|------|
| 能改被扩展类型源码 | **`[TsExtension(typeof(FooExt), …)]` 标在被扩展类型上** |
| 第三方 / 预编译类型 | Settings **`tsExtensionXmlPaths`** + 根元素 **`ZTSExtensions`** |

`[TsExtension]` **不要**标在扩展类上（否则为发现扩展必须扫全程序集）。

```csharp
using ZTS;

public static class TransformExt
{
    public static void ResetLocal(this UnityEngine.Transform t)
    {
        t.localPosition = UnityEngine.Vector3.zero;
    }
}

[TsExtension(typeof(TransformExt))]
public class PlayerView : MonoBehaviour { }
```

```xml
<?xml version="1.0" encoding="utf-8"?>
<ZTSExtensions version="1">
  <Assembly name="UnityEngine.CoreModule">
    <Type fullName="UnityEngine.Transform">
      <Extension assembly="Assembly-CSharp" fullName="MyGame.TransformExt"/>
    </Type>
  </Assembly>
</ZTSExtensions>
```

| 项 | 说明 |
|----|------|
| Attribute / XML | 同一被扩展类型取 **并集** |
| 基类 | Bind **T** 时收集 **基类**上的 `[TsExtension]` |
| Il2Cpp | XML 在 **Generate** 期写入静态表，Player **不**读 XML（改完须重新 Generate） |
| 扩展类无法解析 | Generate **硬失败**；Mono **throw**（不静默丢） |

本文件 **只**允许 `Assembly` → `Type` → `Extension`；不要写入 `Method` / `MarshalAs` / `alias`。与 [TsAlias](/docs/guides/ts-alias/) XML **分文件、分 Settings 字段**。

## JS 用法

```javascript
const t = go.transform;
t.ResetLocal();   // 方法调用；底层是静态扩展方法
```

筛选规则：扩展类上带 `ExtensionAttribute` 的 `public static` 方法，且第一个参数能接住该被扩展类型（含 `this Base` 用于 `Derived`）。开放泛型扩展 **不支持**。

调用语义为 **static-as-instance**：进 **IEO method 表**；JS 方法调用的 receiver → CLR 第 0 参（`this`）。**不**挂到被扩展类型的静态表冒充「已支持 extension」。

## 与实例方法同名

扩展与真实例 **合并竞争**（同一 overload 组），**无**「实例优先」。消歧用全签名键或 `[TsAlias]`。见 [方法重载](/docs/guides/overloads/)。

## 常见错误

| 现象 | 原因 |
|------|------|
| `member not found`（`obj.Foo`） | 未在被扩展类型（或基类）配置扩展类；或 Il2Cpp 未重新 Generate |
| 只能 `Ext.Foo(obj)` | 未走 static-as-instance / 未进 IEO（实现须符合规范 §4） |
| 调到错误重载 | 合并竞争；用全签名键或 Alias 消歧 |
| 标在扩展类上的 Attribute 无效 | 发现只扫被扩展类型上的 `[TsExtension]` |

## 相关文档

- [规范 13](/docs/spec/13-EXTENSION-METHODS/)
- [TsAlias](/docs/guides/ts-alias/)（另一套 XML，勿混用）
- [方法重载](/docs/guides/overloads/)
- [成员绑定](/docs/spec/metatable/03-BINDING/)
