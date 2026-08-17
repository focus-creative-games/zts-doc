---
sidebar_position: 1
title: 安装
description: UPM 引入 ZenTS，选定 QuickJS pin 并完成本地 Install。
---

# 安装

使用指南从本页开始：先装好包、确认 Settings，再进入 [Hello 互操作](/docs/guides/hello-interop/)。UPM 细节与 Demo 路径见 [入门 · 安装与集成](/docs/getting-started/installation/)。

## 你要完成的三件事

1. 在工程中引入 `com.code-philosophy.zen-ts`
2. 菜单 **`ZenTS/Settings...`**（或 Project Settings → **ZenTS**）确认 **QuickJS** 版本 id
3. 菜单 **`ZenTS/Install...`** 生成本地 `libil2cpp` + QuickJS + `zents-runtime` 树（出 Il2Cpp Player 前必需）

:::warning
包内 **不** 携带完整 `libil2cpp`。未 Install 时 Il2Cpp 构建会失败；**`ZenTS/Generate/All`** 也依赖本地树已存在。
:::

## 1. 引入 Package

编辑 `Packages/manifest.json`：

```json
{
  "dependencies": {
    "com.code-philosophy.zen-ts": "https://github.com/focus-creative-games/zen-ts.git"
  }
}
```

也可钉版本标签。首次体验推荐直接打开 [zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo) 的 `js-demo/` 或 `ts-demo/`。

## 2. Settings（`ZenTS/Settings...`）

打开 Project Settings → **ZenTS**（写入 `ProjectSettings/ZenTS.asset`）。

| 字段 | 说明 |
|------|------|
| **QuickJS Version Id** | 如 `quickjs-2026-06-04`；须与包内 `ZenTS~/quickjs-il2cpp/VERSION` 一致 |
| **TypeScript Play 闸门** | 默认开启；进 Play 前跑 `tsc --noEmit`（见 [TypeScript 工作流](/docs/guides/typescript-workflow/)） |
| **JS Debugger** | 默认关闭；仅 Editor Mono，见 [JS 调试器](/docs/guides/js-debugger/) |

ZenTS **仅** 支持 QuickJS，**没有** 多引擎切换矩阵。改 pin 后须重新 **Install**，并按 Console 提示 **重启 Editor**。平台矩阵见 [兼容性](/docs/getting-started/compatibility/)；细则见 [多版本管理](/docs/spec/11-MULTI-VERSION/)。

## 3. 本地 Install（`ZenTS/Install...`）

Install 主要工作：

1. 复制 Editor 的 stock `libil2cpp` 到 `Library/ZenTS/LocalIl2CppData-…` 并打 patch
2. 将包内 `ZenTS~/zents-runtime` 复制到本地 **`libil2cpp/zents`**
3. 将 **`ZenTS~/quickjs-il2cpp`** 整目录拷贝到 **`libil2cpp/quickjs`**
4. 写入 scripting define、`ZenTSConf.inc` 等并校验

缺 Editor `Plugins/quickjs/quickjs.dll` 时 Install **警告、不失败**；需自行放入后再重启 Editor。

## 4. 脚本目录（先搭好，下一篇会用到）

| 模式 | Editor 权威源 | Player |
|------|---------------|--------|
| **纯 JS** | 工程旁 `JsScripts/*.js`（或 Loader 约定路径） | 常拷贝到 `StreamingAssets/Js/` |
| **TypeScript** | 工程根 `TsProject/src/**` → emit 到 `TsProject/out/**` | 构建拷贝到 `StreamingAssets/ZenTS/` |

TypeScript 工程执行菜单 **`ZenTS/Init TypeScript Project`** 生成脚手架。目录与 Sync 见 [安装与集成](/docs/getting-started/installation/)、[构建](/docs/guides/build/)。

## 验证

1. 菜单出现 **ZenTS/**（Install、Generate、Init TypeScript 等）
2. Install 日志成功；工程能编译
3. 下一篇用 `JsAppDomain.Initialize` + 最小互调确认 Play 有输出

## 常见问题

| 现象 | 处理 |
|------|------|
| Package 拉取失败 | 检查 Git / 网络；或改用本地 `file:` |
| 提示未 Install | 执行 `ZenTS/Install...`；换 Unity / 换 QuickJS pin 后重跑 |
| 缺 `quickjs.dll` | 按 [QuickJS 构建](/docs/spec/build/01-QUICKJS/) 放入 Plugins；重启 Editor |
| 换 pin 后异常 | 重跑 Install，并 **重启 Editor** |

## 学习路径

| | |
|---|---|
| **上一篇** | [快速开始](/docs/getting-started/quick-start/) |
| **下一篇** | [Hello 互操作](/docs/guides/hello-interop/) |

## 相关文档

- [入门 · 安装与集成](/docs/getting-started/installation/)
- [兼容性](/docs/getting-started/compatibility/)
- [多版本管理](/docs/spec/11-MULTI-VERSION/)
- [QuickJS 构建](/docs/spec/build/01-QUICKJS/)
