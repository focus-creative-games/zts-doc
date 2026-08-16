---
sidebar_position: 2
title: Hello 互操作
description: "最小 C#↔JS 互调。"
---

# Hello 互操作

## C# → JS

```csharp
var add = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
Debug.Log(add(10, 20));
```

```js
// JsScripts/app.js
export function add(a, b) { return a + b; }
```

## JS → C#

```js
const AC = CSharp["Assembly-CSharp"];
const demo = new AC.Demo();
console.log(AC.Demo.Add(3, 5));
```

或 TypeScript：

```ts
import { Demo } from "csharp:Assembly-CSharp";
console.log(Demo.Add(3, 5));
```

可运行样例见 [zts-demo](https://github.com/focus-creative-games/zts-demo)。
