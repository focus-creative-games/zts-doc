---
sidebar_position: 2
title: TsAppDomain
description: "C# 宿主门面速查。"
---

# TsAppDomain

| API | 说明 |
|-----|------|
| `Initialize(loader)` | 注册模块加载器；`loader(canonical) → string\|null` |
| `GetFunction<T>(module, exportName)` | 取得 named export 对应 Delegate |

详见 [01-HOST-API](/docs/spec/01-HOST-API/)。
