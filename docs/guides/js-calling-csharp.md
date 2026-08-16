---
sidebar_position: 3
title: "JS 调用 C#"
description: "CSharp 懒绑定与 csharp: import。"
---

# JS 调用 C#

## 路径 1：全局 `CSharp`

```js
const AC = CSharp["Assembly-CSharp"];
const go = new AC["UnityEngine.GameObject"]("hi"); // 视具体绑定暴露而定
const demo = new AC.Demo();
demo.x = 10;
console.log(AC.Demo.Add(1, 2));
```

类型按需懒绑定，**无需** per-type Wrap 白名单。

## 路径 2：`csharp:` 模块（TS/JS）

```ts
import { Demo } from "csharp:Assembly-CSharp";
const d = new Demo();
```

声明与 Generate Typings 见 [TypeScript 工作流](/docs/guides/typescript-workflow/) 与 [spec/14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)。

权威语义：[类型系统](/docs/spec/02-TYPE-SYSTEM/)、[元表/绑定](/docs/spec/metatable/)。
