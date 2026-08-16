---
sidebar_position: 4
title: "C# 调用 JS"
description: TsAppDomain.GetFunction 与 named export。
---

# C# 调用 JS

```csharp
TsAppDomain.Initialize(LoadJsModule);

var main = TsAppDomain.GetFunction<Action>("app", "main");
var add = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
main();
Debug.Log(add(10, 20));
```

规则：

- 模块名为 **canonical**（不含 `.js`）
- 仅 **named export**；不要对 `csharp:` 模块调用 `GetFunction`
- Delegate 类型 `T` 决定参数/返回值 Marshal

规范：[Host API](/docs/spec/01-HOST-API/)。Demo：`js-demo` / `ts-demo` 中的 `AppAdd`。
