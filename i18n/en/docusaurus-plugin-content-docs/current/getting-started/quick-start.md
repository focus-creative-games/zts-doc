---
sidebar_position: 2
title: 快速开始
description: 用 zts-demo 的 js-demo / ts-demo 跑通最小闭环。
---

# 快速开始

推荐直接使用官方 Demo：[zts-demo](https://github.com/focus-creative-games/zts-demo)。

仓库含两个独立 Unity 工程：

| 工程 | 说明 |
|------|------|
| `js-demo/` | 纯 JavaScript（ESM），脚本在 `JsScripts/` |
| `ts-demo/` | TypeScript 工作流（`TsProject/`） |

环境：推荐 Unity **2022.3 LTS**（亦支持 **2021.3.x** / **6000.0.x** / **6000.3.x** / **6000.5.x** / **团结引擎 1.x.y**，见 [兼容性](/docs/getting-started/compatibility/)）；`ts-demo` 需要本机 **Node LTS**。

## 路径 A：js-demo（Editor）

1. 用 Unity 打开 `js-demo/`。
2. 确认 `Packages/manifest.json` 中 ZTS 包路径可用（开发期多为 `file:…`，发布改为 git URL）。
3. 打开 `Assets/Scenes/SampleScene`，点 **Play**。
4. Console 应出现类似：`js main start`、C# 访问路径日志、`[identity] … OK`，以及 `AppAdd(10,20)=30`。

要点：

- C# → JS：`TsAppDomain.GetFunction`（named export）
- JS → C#：`CSharp[…]` 与/或 `import from "csharp:…"`

详见 [JS 调用 C#](/docs/guides/js-calling-csharp/) 与 [C# 调用 JS](/docs/guides/csharp-calling-js/)。

## 路径 B：ts-demo（Editor）

1. 用 Unity 打开 `ts-demo/`。
2. 在工程根 `TsProject/` 执行 `npm install`（或菜单 **ZTS Demo → Compile TypeScript**）。
3. （可选）**ZTS Demo → Generate Typings** 刷新 `generated/csharp/**`。
4. Play；期望日志与 js-demo 类似（前缀 `ts main`）。

进 Play 时若开启 TypeScript 闸门，会自动 `tsc --noEmit`；失败则阻止 Play。

完整工作流见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

## 最小自建（纯 JS）

```csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZTS;

public static class ZtsBootstrap
{
    static object LoadJsModule(string module)
    {
#if UNITY_EDITOR
        var path = Path.Combine(Application.dataPath, "..", "JsScripts", module + ".js");
#else
        var path = Path.Combine(Application.streamingAssetsPath, "Js", module + ".js");
#endif
        return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Init() => TsAppDomain.Initialize(LoadJsModule);
}
```

模块名为 **canonical specifier**（相对逻辑路径，**不含** `.js`），例如 `"app"`。
