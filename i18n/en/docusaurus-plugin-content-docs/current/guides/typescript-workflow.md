---
sidebar_position: 5
title: TypeScript 工作流
description: TsProject、Generate Typings、Compile、Play 闸门。
---

# TypeScript 工作流

ZTS 运行时只执行 **ES module（JS）**；TypeScript 是官方一等编辑与检查路径。

## 一键初始化

菜单 **ZTS/Init TypeScript Project** → 生成工程根 `TsProject/`（`package.json`、`tsconfig`、`src/` 等）。

也可直接使用 [ts-demo](https://github.com/focus-creative-games/zts-demo) 的 `TsProject/`。

## 日常循环

1. **Generate Typings**（可选）：刷新 `generated/csharp/**`，供 `import from "csharp:…"`。
2. 编写 `src/**/*.ts`。
3. **Compile**（esbuild 等 1:1 emit）→ 运行时 Loader 读取产物。
4. 进 Play：若开启闸门，先 `tsc --noEmit`，失败则阻止 Play。

## Specifier

- 业务模块：canonical，如 `"game/logic"`（无 `.js`）
- C#：`csharp:AssemblyName`（细节见 [14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)）

## 与纯 JS 的关系

`js-demo` 跳过 tsc；`ts-demo` 展示完整闸门。两者互操作语义相同。
