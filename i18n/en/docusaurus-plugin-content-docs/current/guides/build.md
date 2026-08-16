---
sidebar_position: 22
title: 构建
description: Il2Cpp 导出与 zts-runtime。
---

# 构建

1. 确认包内 `ZTS~/zts-runtime` / Install 流程已将运行时装入 LocalIl2Cpp。
2. 导出 Il2Cpp 工程后用 **Debug|x64**（开发）或 Release 构建。
3. QuickJS / 原生模块相关见 [spec/build](/docs/spec/build/01-QUICKJS/)。

团队内部联调可参考 ZTSTest 的 `sync-runtime-zts.bat` 工作流（改 `Build-Win64/.../zts` → 同步回包）。
