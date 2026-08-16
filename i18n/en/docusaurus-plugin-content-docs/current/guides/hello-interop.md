---
sidebar_position: 2
title: Hello 互操作
description: "Initialize、最简 C#→JS 与 JS→C#，跑通第一条互操作路径。"
---

# Hello 互操作

本篇假定已完成 [安装](/docs/guides/install/)。目标：在 Editor Play 时同时看到 **C# 调 JS** 与 **JS 调 C#**。更短的 Demo 对照见 [快速开始](/docs/getting-started/quick-start/)；本篇是使用指南主线的正式起点。

Canonical：[zts-demo](https://github.com/focus-creative-games/zts-demo) 的 `js-demo`（纯 JS）或 `ts-demo`（TypeScript）。

## 1. 注册 loader 并 Initialize

```csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZTS;

public class Bootstrap : MonoBehaviour
{
    private static object LoadJsModule(string module)
    {
#if UNITY_EDITOR
        string path = Path.Combine(Application.dataPath, "..", "JsScripts", module + ".js");
#else
        string path = Path.Combine(Application.streamingAssetsPath, "Js", module + ".js");
#endif
        return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZtsOnStartup()
    {
        TsAppDomain.Initialize(LoadJsModule);
    }
}
```

- `module` 为 **canonical specifier**（无路径、无 `.js` / `.ts`），如 `"app"`
- loader 返回 UTF-8 **ES module 源码**字符串；找不到返回 `null`（或抛明确异常）
- **`csharp:`** 由运行时在 loader **之前**拦截，**不要**把该前缀交给业务 loader
- **不需要**手动创建 `JSContext` / 注册 Wrap

TypeScript 工程则让 loader 读 `TsProject/out/{canonical}.js`，见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

## 2. 最简 C# → JS

模块须使用 **named export**（不要指望 `export default` 自动映射到 `GetFunction`）：

```js
// JsScripts/app.js
export function main() {
    console.log("js main start");
}

export function add(a, b) {
    return a + b;
}
```

```csharp
Action AppMain;
Func<int, int, int> AppAdd;

void Awake()
{
    // 须在 Initialize 之后；勿放在与 RuntimeInitializeOnLoadMethod 同类型的 static 字段初始化器里
    AppMain = TsAppDomain.GetFunction<Action>("app", "main");
    AppAdd = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
}

void Start()
{
    AppMain();
    Debug.Log(AppAdd(10, 20)); // 30
}
```

热路径请自行缓存 Delegate；`GetFunction` 不保证返回同一实例。详解见 [C# 调用 JS](/docs/guides/csharp-calling-js/)。

## 3. 最简 JS → C#

```csharp
// Assets/Demo.cs（示意）
public class Demo
{
    public static int Add(int a, int b) => a + b;
    public int x;
    public void SetX(int v) => x = v;
    public int GetX() => x;
}
```

全局 `CSharp`（低层权威路径）：

```js
CSharp['AC'] = CSharp['Assembly-CSharp'];

console.log(CSharp.AC.Demo.Add(3, 5)); // 8  静态方法

const demo = new CSharp.AC.Demo();      // 构造须 new
demo.SetX(10);                          // 实例方法：点号调用，无冒号
console.log(demo.x);                    // 10 字段 / 无参 Property
```

推荐脚本写法（与上式 identity 相同）：

```js
import { Demo } from "csharp:Assembly-CSharp";

console.log(Demo.Add(3, 5));
const demo = new Demo();
demo.SetX(10);
console.log(demo.x);
```

含 namespace 时：`import { Panel } from "csharp:Assembly-CSharp/MyGame.UI"`，或 `CSharp.AC['MyGame.UI.Panel']`。日常用法见 [JS 调用 C#](/docs/guides/js-calling-csharp/)。

:::tip 与 Lua / 旧习惯的差异
- 实例方法用 **`demo.SetX(10)`**，**没有** `demo:SetX(10)` 冒号语法
- 构造用 **`new Demo()`**
- 未知成员 **strict miss** → `throw Error('zts: …')`，不是 `undefined`
:::

## 预期输出（Editor Play）

```
js main start
...
30
```

若无输出：确认 `BeforeSceneLoad` 已执行、`LoadJsModule("app")` 非 null、Console 未过滤日志。更多排查见 [排障](/docs/guides/troubleshooting/)。

## 下一步

- 深挖两侧 API：[JS 调用 C#](/docs/guides/js-calling-csharp/)、[C# 调用 JS](/docs/guides/csharp-calling-js/)
- 发布前：[构建](/docs/guides/build/)（Generate、脚本同步）
- 用 TS 写业务：[TypeScript 工作流](/docs/guides/typescript-workflow/)

## 学习路径

| | |
|---|---|
| **上一篇** | [安装](/docs/guides/install/) |
| **下一篇** | [JS 调用 C#](/docs/guides/js-calling-csharp/) |

## 相关文档

- [快速开始](/docs/getting-started/quick-start/)
- [宿主 API](/docs/spec/01-HOST-API/)
- [类型系统](/docs/spec/02-TYPE-SYSTEM/)
