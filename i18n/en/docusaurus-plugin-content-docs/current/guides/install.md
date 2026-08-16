---
sidebar_position: 1
title: 安装
description: 安装包与工程目录约定。
---

# 安装

见 [安装与集成](/docs/getting-started/installation/)。本页补充工程约定：

- **纯 JS**：工程旁 `JsScripts/`（或你在 Loader 中约定的路径）；Player 侧常拷贝到 `StreamingAssets/Js/`。
- **TypeScript**：工程根 `TsProject/`（`ZTS/Init TypeScript Project` 生成）；emit 产物供运行时加载。
- **包路径**：开发期 `file:`；发布改为 git URL，并相应调整 `tsconfig` 对包内 types 的引用。
