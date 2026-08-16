---
sidebar_position: 3
title: 兼容性
description: Unity 版本、运行时与平台支持范围。
---

# 兼容性

## Unity / 团结

| 版本 | 状态 |
|------|------|
| Unity **2021.3.x** | ✅ 支持 |
| Unity **2022.3.x** | ✅ 支持 |
| Unity **6000.0.x** | ✅ 支持 |
| Unity **6000.3.x** | ✅ 支持 |
| Unity **6000.5.x** | ✅ 支持 |
| **团结引擎 1.x.y** | ✅ 支持 |

libil2cpp patch 解析见 [多版本管理](/docs/spec/11-MULTI-VERSION/)。

## 脚本 VM 与运行时

| 类别 | 状态 |
|------|------|
| **脚本 VM** | **QuickJS**（pin 见包内 `ZTS~/`；**无**多引擎切换矩阵） |
| **Editor** | **Mono**（Expression Emit；与 Il2Cpp **JS 可见语义一致**） |
| **Player** | **Il2Cpp**（权威实现；`zts-runtime` C++ 桥） |

**Il2Cpp 构建：** 发布前执行 **`ZTS/Generate/All`**（C++ stub，**不是** C# Wrap）。见 [构建](/docs/guides/build/)、[Editor 与 Player](/docs/guides/editor-vs-player/)。

## 目标平台

| 类别 | 范围 |
|------|------|
| **Editor（开发）** | **Windows x64**、**macOS**（Apple Silicon / Intel） |
| **Player（Il2Cpp）** | 设计覆盖 **Unity / 团结 Il2Cpp 常规支持的全部目标**，包括但不限于：**Win64**、**Android**、**iOS**、**WebGL**、**微信小游戏**、**鸿蒙 / 车机**，以及其它桌面 / 移动 / 小游戏 / 车载等 Il2Cpp 可构建平台 |

QuickJS 源码随 Install 进入 LocalIl2Cpp 后，按 Unity 目标平台正常导出与链接即可；**无**「仅移动平台 + 外置静态库」的特例（区别于 ZLua 的 LuaJIT 模型）。细则见 [QuickJS 构建](/docs/spec/build/01-QUICKJS/) §5。

其它平台问题请提交 [Issue](https://github.com/focus-creative-games/zts/issues)。

语义契约以 [规范文档](/docs/category/spec/) 为准，与实现细节分离。项目阶段见 [项目状态](/docs/getting-started/project-status/)。
