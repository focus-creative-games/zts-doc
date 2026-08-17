---
sidebar_position: 5
title: TypeScript 工作流
description: TsProject、Generate Typings、Compile、Play 闸门与 emit。
---

# TypeScript 工作流

ZenTS 运行时只执行 **ES module（JS）**；TypeScript 是官方一等编辑与检查路径，**不改变** JavaScript 可见互操作语义。权威约定见 [spec/14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)。

## 一键初始化

菜单 **`ZenTS/Init TypeScript Project`** → 在工程根生成 `TsProject/`（`package.json`、`tsconfig.json`、`src/` 等）。也可直接使用 [ts-demo](https://github.com/focus-creative-games/zen-ts-demo) 的 `TsProject/`。

本机需要 **Node LTS**（调用 `npx tsc` / `npx esbuild`）。包 **不** 内嵌 tsc。

## 工程布局

```
<UnityProject>/
  TsProject/
    package.json          # 仅 devDependencies：typescript、esbuild
    tsconfig.json         # extends 包内 tsconfig.base.json
    src/                  # 业务 TS（入库）
      main.ts
      game/logic.ts
    generated/            # Generate Typings 产出（入库）
      csharp/
    out/                  # emit；默认 gitignore
      main.js
      main.js.map
  Assets/StreamingAssets/ZenTS/   # Player 构建拷贝；非 Editor 权威源
```

| 路径 | 版本库 |
|------|--------|
| `TsProject/src/**`、`generated/**`、`package.json`、`tsconfig.json` | **入库** |
| `TsProject/out/**`、`node_modules/` | **gitignore** |

`.ts` **不要** 放进 `Assets/`（避免未知 importer）。

## 分层

```
IDE / CI     tsc --noEmit  +  generated/*.d.ts + zents.d.ts
Emit         esbuild 1:1 或 tsc（.ts → .js + .js.map）
Runtime      moduleLoader / csharp: / CSharp / zents
```

| 层 | 工具 | 职责 |
|----|------|------|
| 类型 | 包内 `zents.d.ts` + 生成的 `declare module "csharp:…"` | 仅编辑期 |
| 检查 | `tsc --noEmit` | CI、提交前、进 Play 闸门 |
| 发布 | esbuild **不打包** 的 1:1 transpile（或 `tsc` emit） | 产出 JS；**不** minify export 名 |

**禁止** 用 esbuild 代替类型检查；**禁止** bundle / 打成单文件（会破坏 `GetFunction(module, export)`）。

## 日常循环

1. （可选）菜单 **`ZenTS/Generate Typings`**：刷新 `generated/csharp/**`，与 Il2Cpp **Generate** 类型集同源。
2. 编写 `src/**/*.ts`。
3. **Compile**（esbuild 1:1 或 `tsc` emit）→ `out/`。
4. 进 Play：若闸门开启，先 `tsc --noEmit`，失败则 **阻止 Play**。

```typescript
// TsProject/src/game/logic.ts
import { Demo } from "csharp:Assembly-CSharp";

export function OnTick(dt: number): void {
    const demo = new Demo();
    demo.SetX(10);
}

export function add(a: number, b: number): number {
    return a + b;
}
```

```csharp
// C#：canonical 不含 .js
var onTick = JsAppDomain.GetFunction<Action<float>>("game/logic", "OnTick");
var add = JsAppDomain.GetFunction<Func<int, int, int>>("game/logic", "add");
```

Editor loader 读 `TsProject/out/{canonical}.js`。相对导入在源里写 `.js` 后缀（文件仍是 `.ts`）：

```typescript
import { helper } from "./util.js"; // 源文件 util.ts
```

## Specifier 约定

| 用途 | 写法 |
|------|------|
| 业务模块 | `"main"`、`"game/logic"`（**无** `.js` / `.ts`） |
| C# 类型 | `"csharp:Assembly-CSharp"`、`"csharp:Assembly-CSharp/MyGame.UI"` |
| `GetFunction` | 与业务 canonical **同一字符串** |

## Play 闸门与 Player

| 项 | 默认 | 行为 |
|----|------|------|
| TypeScript Play 闸门 | **开** | 进 Play 前 `tsc --noEmit`；失败阻止 Play |
| 闸门关闭 | Settings 可关 | 仍建议 CI 跑检查 |

Player 构建：emit → 拷贝 `out/**/*.js`（及可选 `.map`）到 `StreamingAssets/ZenTS/`；Player loader **只**读 StreamingAssets，**不**跑 Node、**不**读 `.ts`。见 [构建](/docs/guides/build/)。

## 与纯 JS 的关系

`js-demo` 跳过 tsc；`ts-demo` 展示完整闸门。两边互操作语义相同：仍是 `GetFunction` + `csharp:` / `CSharp`。

## 常见错误

| 现象 | 处理 |
|------|------|
| Play 被拦截 | 看 Console 的 `tsc` 错误；或临时关闸门 |
| `csharp:` 找不到类型 | 跑 Generate Typings；检查程序集 / 命名空间路径 |
| `GetFunction` 找不到 export | emit 是否过期；是否被 bundle / 改名；canonical 是否带 `.js` |
| `import type` 后 `new T` 失败 | 改为值导入 `import { T } from "csharp:…"` |
| 缺 Node | 安装 Node LTS；闸门开启时禁止静默跳过检查 |

## 学习路径

| | |
|---|---|
| **上一篇** | [C# 调用 JS](/docs/guides/csharp-calling-js/) |
| **下一篇** | [构建](/docs/guides/build/) |

## 相关文档

- [规范 · TypeScript](/docs/spec/14-TYPESCRIPT/)
- [类型系统 · csharp:](/docs/spec/02-TYPE-SYSTEM/)
- [JS 调试器](/docs/guides/js-debugger/)（source map → `TsProject/src`）
- [快速开始](/docs/getting-started/quick-start/)
