---
sidebar_position: 3
title: 双运行时
description: 双运行时
---

# 双运行时

语义契约一份；实现两套：

- **Mono**：开发期 Expression Tree / Emit
- **Il2Cpp**：`libil2cpp/zts` C++（包内 `ZTS~/zts-runtime`）

见 [editor-vs-player](/docs/guides/editor-vs-player/) 与 [impl](/docs/category/impl/)。
