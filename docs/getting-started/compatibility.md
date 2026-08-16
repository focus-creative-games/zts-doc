---
sidebar_position: 3
title: 兼容性
description: Unity 版本、运行时与平台验证范围。
---

# 兼容性

| 类别 | 状态 |
|------|------|
| **引擎** | Unity **2021.3.x** / **2022.3.x** / **6000.0.x** / **6000.3.x** / **6000.5.x**；**团结引擎 1.x.y** |
| **脚本 VM** | QuickJS（pin 见包内 `ZTS~/`） |
| **运行时** | Editor **Mono** + Player **Il2Cpp** |
| **平台（开发）** | Windows x64 Editor |
| **平台（Player）** | 以 Win64 Il2Cpp 为主验证；其它 Il2Cpp 目标陆续跟进 |

语义契约以 [规范文档](/docs/category/spec/) 为准，与实现细节分离。
