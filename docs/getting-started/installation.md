---
sidebar_position: 1
title: 安装与集成
description: "通过 UPM / Git URL 安装 ZenTS 包。"
---

# 安装与集成

## 包标识

- UPM 包名：`com.code-philosophy.zen-ts`
- 源码仓库：[focus-creative-games/zen-ts](https://github.com/focus-creative-games/zen-ts)

## 通过 Git URL 安装

在 `Packages/manifest.json` 中加入：

```json
{
  "dependencies": {
    "com.code-philosophy.zen-ts": "https://github.com/focus-creative-games/zen-ts.git"
  }
}
```

也可在 Unity：**Window → Package Manager → + → Add package from git URL**。

## 安装后

1. 确认菜单出现 **ZenTS/**（Init TypeScript Project、Generate Typings、Compile 等）。
2. 纯 JS 工程：准备 Loader + `JsScripts/`（见 [快速开始](/docs/getting-started/quick-start/)）。
3. TypeScript 工程：执行 **ZenTS/Init TypeScript Project**，或直接打开 [ts-demo](https://github.com/focus-creative-games/zen-ts-demo)。

## Il2Cpp 说明

Player 使用包内 `ZenTS~/zents-runtime` 进入 LocalIl2Cpp / 导出工程。细节见 [构建](/docs/guides/build/) 与 [QuickJS 构建说明](/docs/spec/build/01-QUICKJS/)。
