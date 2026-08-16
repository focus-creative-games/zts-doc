---
sidebar_position: 1
title: 安装与集成
description: "通过 UPM / Git URL 或本地 file: 路径安装 ZTS 包。"
---

# 安装与集成

## 包标识

- UPM 包名：`com.code-philosophy.zts`
- 源码仓库：[focus-creative-games/zts](https://github.com/focus-creative-games/zts)

## 方式一：Git URL（推荐发布工程）

在 `Packages/manifest.json` 中加入：

```json
{
  "dependencies": {
    "com.code-philosophy.zts": "https://github.com/focus-creative-games/zts.git"
  }
}
```

也可在 Unity：**Window → Package Manager → + → Add package from git URL**。

## 方式二：本地 file:（开发联调）

Demo 与 ZTSTest 同级时常用：

```json
"com.code-philosophy.zts": "file:../../../ZTSTest/Packages/com.code-philosophy.zts"
```

或指向已同步的包仓（按实际路径调整）。

## 安装后

1. 确认菜单出现 **ZTS/**（Init TypeScript Project、Generate Typings、Compile 等）。
2. 纯 JS 工程：准备 Loader + `JsScripts/`（见 [快速开始](/docs/getting-started/quick-start/)）。
3. TypeScript 工程：执行 **ZTS/Init TypeScript Project**，或直接打开 [ts-demo](https://github.com/focus-creative-games/zts-demo)。

## Il2Cpp 说明

Player 使用包内 `ZTS~/zts-runtime` 进入 LocalIl2Cpp / 导出工程。细节见 [构建](/docs/guides/build/) 与 [QuickJS 构建说明](/docs/spec/build/01-QUICKJS/)。
