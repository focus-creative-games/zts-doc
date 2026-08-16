---
sidebar_position: 21
title: Editor 与 Player
description: Mono 与 Il2Cpp 路径差异。
---

# Editor 与 Player

| | Editor | Player |
|--|--------|--------|
| 运行时 | Mono | Il2Cpp |
| 绑定实现 | Expression Emit | C++ `zts-runtime` |
| 脚本加载 | 常读工程旁 `JsScripts` / TS emit | StreamingAssets 等 |

语义应对齐；性能以 Player 为准。见 [Architecture](/docs/category/impl/)。
