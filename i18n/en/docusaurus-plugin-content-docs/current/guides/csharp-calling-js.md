---
sidebar_position: 4
title: "C# 调用 JS"
description: JsAppDomain.GetFunction、ES named export 与 Editor/Player 加载路径。
---

# C# 调用 JS

用 **`JsAppDomain.GetFunction<T>`** 按模块 specifier 与 **named export** 取得绑定好的 Delegate，再调用。Editor 与 Player **API 相同**。

Canonical：[zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo) 中的 Bootstrap / `AppAdd` 样例。

## 基本用法

```csharp
JsAppDomain.Initialize(LoadJsModule);

var main = JsAppDomain.GetFunction<Action>("app", "main");
main();

var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20); // 30
```

```js
// JsScripts/app.js — canonical 名：app（不含 .js）
export function main() {
    console.log("js main start");
}

export function add(a, b) {
    return a + b;
}
```

| 规则 | 说明 |
|------|------|
| 先 `Initialize` | 否则抛异常 |
| `T : MulticastDelegate` | 具体 `Action` / `Func` / 自定义委托 |
| `jsModule` / `jsExportName` | `"app","add"` ↔ `export function add` |
| 仅 named export | **不**自动映射 `export default` |
| 缓存 | 热路径自行保存；不保证同实例 |
| 时机 | 须在 `Initialize` **之后**；勿放在与 `RuntimeInitializeOnLoadMethod` 同类型的 static 字段初始化器 |

Delegate 类型 `T` 决定参数与返回值的 Marshal（见 [委托与函数](/docs/guides/functions/)）。

## 模块加载

`GetFunction("app", …)` 要求 loader 对 `"app"` 能返回源码。

| 环境 | 典型路径 |
|------|----------|
| Editor（纯 JS） | `{ProjectRoot}/JsScripts/app.js` |
| Editor（TS） | `TsProject/out/app.js`（canonical 仍是 `"app"`） |
| Player | `StreamingAssets/Js/app.js` 或 `StreamingAssets/ZenTS/app.js` |

```csharp
private static object LoadJsModule(string module)
{
#if UNITY_EDITOR
    string path = Path.Combine(Application.dataPath, "..", "JsScripts", module + ".js");
#else
    string path = Path.Combine(Application.streamingAssetsPath, "Js", module + ".js");
#endif
    return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
}
```

要点：

- **canonical 不含** `.js` / `.ts`：`GetFunction("game/logic", "OnTick")`，不是 `"game/logic.js"`
- 进入 loader 前，相对导入带来的 `.js` 尾缀会被规范掉；磁盘文件可以是 `out/game/logic.js`
- 子路径用 POSIX 风格：`"game/logic"` → `…/game/logic.js`
- **`csharp:` 不是**业务入口：其 named export 是类型对象；误用 `GetFunction` 会因「非 callable」抛 C# 异常
- Player 构建前须 Sync / 拷贝 emit 产物，见 [构建](/docs/guides/build/)
- 热更用 `JsAppDomain.Reset(loader)`（EndOfFrame 生效；旧 `GetFunction` 委托作废，须重新绑定）。**已初始化**时再次 `Initialize` 会抛异常，**不能**「只换 loader」

### 多模块

```csharp
var appMain = JsAppDomain.GetFunction<Action>("app", "main");
var onTick = JsAppDomain.GetFunction<Action<float>>("game/logic", "OnTick");
```

```js
// game/logic.js
export function OnTick(dt) {
    // ...
}
```

## 与「形参里的 function」对照

| 场景 | 做法 |
|------|------|
| C# **主动**调某个 JS 导出函数 | `GetFunction<T>(module, exportName)` |
| C# 形参是 `Action`/`Func`，JS 传入 function | **隐式** marshal，见 [委托与函数](/docs/guides/functions/) |
| Event 订阅 | JS 侧 `add_` / `remove_`，见 [JS 调用 C#](/docs/guides/js-calling-csharp/) |

## 常见错误

| 现象 | 处理 |
|------|------|
| module not found / loader 失败 | Editor/Player 路径；是否 Sync；canonical 是否带了 `.js` |
| export 不是 callable | 导出名拼写；是否只有 `export default` |
| GetFunction 结果无效 / 调用无效果 | 未 Initialize；`T` 签名与 JS 不一致 |
| 旧脚本仍在跑 | Player 未重新 Sync / 未重新 emit |
| Reset 后委托异常 | 重新 `GetFunction`，丢弃缓存字段 |
| 再次 Initialize 抛异常 | 改用 `Reset(loader)` |

## 学习路径

| | |
|---|---|
| **上一篇** | [JS 调用 C#](/docs/guides/js-calling-csharp/) |
| **下一篇** | [TypeScript 工作流](/docs/guides/typescript-workflow/) |

## 相关文档

- [宿主 API](/docs/spec/01-HOST-API/)
- [JsAppDomain 参考](/docs/reference/js-app-domain/)
- [委托与函数](/docs/guides/functions/)
- [构建](/docs/guides/build/)
