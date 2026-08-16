---
sidebar_position: 24
title: 排障
description: 常见问题速查。
---

# 排障

| 现象 | 排查 |
|------|------|
| `GetFunction` 失败 | canonical 名是否含 `.js`；是否 named export |
| `csharp:` 类型找不到 | 是否 Generate Typings；程序集名是否正确 |
| Play 被拦截 | `tsc --noEmit` 错误；看 Console |
| Il2Cpp 与 Editor 行为不一致 | 对照 [spec](/docs/category/spec/)；提 Issue 并附最小复现 |
| 包路径失效 | `manifest.json` `file:` / git URL |

更多：[FAQ](/docs/community/faq/)。
