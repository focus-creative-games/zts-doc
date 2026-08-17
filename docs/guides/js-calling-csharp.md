---
sidebar_position: 3
title: "JS 调用 C#"
description: "CSharp 懒绑定、csharp: import、构造与 Event（add_/remove_）。"
---

# JS 调用 C#

通过全局 **`CSharp`** 或 **`import { T } from "csharp:…"`** 访问 public 类型与成员。语义贴近 C#：`new Type()`、`Type.StaticMethod()`、`obj.InstanceMethod()`。含 namespace 须括号键或带路径的 `csharp:` specifier。

Canonical：[zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)、[Demo](https://github.com/focus-creative-games/zen-ts-demo) 中的业务脚本。

同名多签名见 [方法重载](/docs/guides/overloads/)（本章末有预告）。

## 1. 访问类型

```
CSharp
  └─ Assembly-CSharp
       └─ Demo
       └─ ['MyGame.UI.Panel']
```

```js
CSharp['AC'] = CSharp['Assembly-CSharp']; // 推荐短别名

const Demo = CSharp.AC.Demo;
const Panel = CSharp.AC['MyGame.UI.Panel'];
const Nested = CSharp.AC['Outer+Nested']; // 嵌套类型用 +
```

| 类型 | JS 访问 |
|------|----------|
| 无 namespace | `CSharp.AC.Demo` |
| 含 namespace | `CSharp.AC['MyGame.UI.Panel']` |
| 嵌套 | `CSharp.AC['Outer+Nested']` |
| BCL | `CSharp.mscorlib['System.Int32']` 等 |

:::warning
含点号的 namespace **不能** `CSharp.AC.MyGame.UI.Panel` 链式点开，必须字符串键。
:::

- 类型 **懒加载**；仅 **public** 可见
- 静态与实例元数据 **独立**，不可混用
- 未注册成员 **strict miss** → **`throw Error('zents: …')`**，**不**返回 `undefined`

## 2. 推荐：`csharp:` 模块

与 `CSharp[…]` **解析到同一类型对象**：

```js
import { Demo } from "csharp:Assembly-CSharp";
import { Panel } from "csharp:Assembly-CSharp/MyGame.UI";
import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine";

const demo = new Demo();
const panel = new Panel();
```

| `import` | 等价低层路径 |
|----------|----------------|
| `{ Demo } from "csharp:Assembly-CSharp"` | `CSharp['Assembly-CSharp'].Demo` |
| `{ Panel } from "csharp:Assembly-CSharp/MyGame.UI"` | `CSharp['Assembly-CSharp']['MyGame.UI.Panel']` |

TypeScript 声明由 **Generate Typings** 生成，见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。**禁止** `import type { Demo }` 再当值用（`new Demo` 会被擦除）。

## 3. 静态成员

```js
console.log(CSharp.AC.Demo.Add(3, 5));

CSharp.AC.Demo.s_x = 10;
console.log(CSharp.AC.Demo.GetSX());
```

| C# | JS 读 | JS 写 |
|----|--------|--------|
| 静态字段 `s_x` | `Type.s_x` | `Type.s_x = v` |
| 静态无参 Property | `Type.Prop` | `Type.Prop = v` |
| 静态方法 | `Type.Add(a, b)` | — |

## 4. 构造与实例成员

```js
const demo = new CSharp.AC.Demo(); // ≡ new Demo()

demo.SetX(10);       // 实例方法：点号；自动绑定 CLR this
console.log(demo.GetX());

demo.x = 20;         // public 字段与无参 Property 写法相同
console.log(demo.x);
```

| 语法 | 含义 |
|------|------|
| `demo.GetX()` | 实例方法（**无冒号**） |
| `demo.x` | 字段或无参 Property |
| `Demo.Add(3, 5)` | 静态方法 |

### 方法 this 绑定

```js
demo.SetX(1);           // ✅ 作为方法调用，自动传入 CLR this
const fn = demo.SetX;
fn(1);                  // ❌ 提取函数失去 this；行为未定义或抛错
```

### 其它要点

- 有参 indexer / 有参 property → `get_*` / `set_*` 方法形式，不要随意写 `obj[i]`（szarray 另有规则，见 [数组](/docs/guides/arrays/)）
- 继承成员在 Bind 期扁平写入；运行时 miss 即 throw
- JS `null` ↔ C# 引用类型 `null`；值类型 struct 不能为 null（除非 `Nullable<T>`，见 [值类型](/docs/guides/value-types/)）

## 5. Event（`add_` / `remove_`）

**没有** Event 专用对象（无 `.get` / `.set` / 赋值糖）。使用编译器生成的普通方法：

```js
function onChanged(v) {
    console.log("hp", v);
}

demo.add_OnHealthChanged(onChanged);
// ...
demo.remove_OnHealthChanged(onChanged); // 须同一 function 引用
```

静态 event：`Type.add_Foo(handler)`。handler 为 JS `function`，按 [委托与函数](/docs/guides/functions/) 隐式 marshal。

若仍在找 `OnX.get`，说明沿用了旧式糖语法，改为 `add_` / `remove_`。

## 完整示例

```js
import { Demo } from "csharp:Assembly-CSharp";

export function main() {
    console.log("Demo.Add:", Demo.Add(3, 5));

    const demo = new Demo();
    demo.SetX(10);
    console.assert(demo.x === 10);
    demo.x = 20;
    console.assert(demo.GetX() === 20);
}
```

## 方法重载预告

`demo.Run(10)` 与 `demo.Run("hi")` 在多重载时走运行时分派。精确点名可用全签名键；热路径短名用 `[JsAlias]`。见 [方法重载](/docs/guides/overloads/)。

## 常见错误

| 现象 | 处理 |
|------|------|
| `assembly/type not found` | 程序集名、namespace 括号、是否 public |
| `Error('zents: … member not found')` | 拼写 / 可见性；读未知成员是 error（非 undefined） |
| 静态/实例混用 | 静态走类型对象；实例走 `new` 出的对象 |
| `member not writable` | 只读 Property / 只读字段 |
| Event `.get` 为 undefined / throw | 改用 `add_` / `remove_` |
| `fn` 提取后调用失败 | 保持 `obj.Method(args)`，勿拆方法 |

## 学习路径

| | |
|---|---|
| **上一篇** | [Hello 互操作](/docs/guides/hello-interop/) |
| **下一篇** | [C# 调用 JS](/docs/guides/csharp-calling-js/) |

## 相关文档

- [类型系统规范](/docs/spec/02-TYPE-SYSTEM/)
- [元表 / 绑定](/docs/spec/metatable/)
- [方法重载](/docs/guides/overloads/)
- [TypeScript 工作流](/docs/guides/typescript-workflow/)
