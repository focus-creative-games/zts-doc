---
sidebar_position: 4
title: 项目状态
description: Alpha 阶段能力边界与双运行时完成度。
---

# 项目状态

ZenTS 目前为 **Alpha**：API 与规范可能随版本迭代，但核心互操作路径（双向调用、Marshal 主路径、TS 工作流）已在 Editor Mono 与 Il2Cpp Player（含 Win64 / Android / iOS 等）上通过内部矩阵验证。平台范围见 [兼容性](/docs/getting-started/compatibility/)：Player 覆盖 **Il2Cpp 支持的全部目标**（含 WebGL、小游戏、鸿蒙 / 车机等）。

| 维度 | 说明 |
|------|------|
| Editor Mono | 日常开发与冒烟（Windows / macOS）；Expression Emit |
| Il2Cpp Player | 发布路径；`zents-runtime` C++ 桥；凡 Il2Cpp 可构建目标均可发布 |
| 文档 | 本站 + 上游 `Docs/spec` |
| Demo | [zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo) `js-demo` / `ts-demo` |
| Unreal（**zts-ue**） | 同族产品：[zts-ue](https://github.com/focus-creative-games/zts-ue)；面向 UE / C++；**目前仍在开发中**，不在本站文档范围内 |

问题与需求请到 [GitHub Issues](https://github.com/focus-creative-games/zen-ts/issues)，或见 [联系方式](/docs/community/contact/)（QQ / Discord）。UE 相关请跟进 [zts-ue](https://github.com/focus-creative-games/zts-ue)。
