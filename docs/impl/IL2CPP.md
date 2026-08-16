---
sidebar_position: 2
title: Il2Cpp 实现
description: zts-runtime C++ 路径笔记。
---

# Il2Cpp 实现

Player 热路径在 `zts-runtime`（`jvm/`、`mt/`、`marshal/` 等）。开发迭代常在导出工程 `Build-Win64/.../libil2cpp/zts`，再 sync 回包。细节索引随版本补充；语义仍以 spec 为准。
