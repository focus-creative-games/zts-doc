---
sidebar_position: 3
title: Compatibility
description: Unity versions, runtimes, and supported platforms.
---

# Compatibility

## Unity / Tuanjie

| Version | Status |
|---------|--------|
| Unity **2021.3.x** | ✅ Supported |
| Unity **2022.3.x** | ✅ Supported |
| Unity **6000.0.x** | ✅ Supported |
| Unity **6000.3.x** | ✅ Supported |
| Unity **6000.5.x** | ✅ Supported |
| **Tuanjie Engine 1.x.y** | ✅ Supported |

libil2cpp patch resolution: see [Multi-version](/docs/spec/11-MULTI-VERSION/).

## Script VM and runtimes

| Category | Status |
|----------|--------|
| **Script VM** | **QuickJS** (pin under package `ZTS~/`; **no** multi-engine matrix) |
| **Editor** | **Mono** (Expression Emit; **JS-visible semantics match** Il2Cpp) |
| **Player** | **Il2Cpp** (authoritative; `zts-runtime` C++ bridges) |

**Il2Cpp builds:** before shipping, run **`ZTS/Generate/All`** (C++ stubs, **not** C# Wrap). See [Build](/docs/guides/build/), [Editor vs Player](/docs/guides/editor-vs-player/).

## Target platforms

| Category | Scope |
|----------|-------|
| **Editor (dev)** | **Windows x64**, **macOS** (Apple Silicon / Intel) |
| **Player (Il2Cpp)** | Designed for **all targets Unity / Tuanjie Il2Cpp normally supports**, including but not limited to **Win64**, **Android**, **iOS**, **WebGL**, **WeChat Mini Games**, **HarmonyOS / automotive**, and other desktop / mobile / mini-game / vehicle Il2Cpp build targets |

After Install copies QuickJS into LocalIl2Cpp, export and link with the normal Unity toolchain for the chosen target. There is **no** “mobile-only + bring-your-own static libs” special case (unlike ZLua’s LuaJIT model). Details: [QuickJS build](/docs/spec/build/01-QUICKJS/) §5.

For other platform issues, please [file an Issue](https://github.com/focus-creative-games/zts/issues).

Semantic contracts live under [spec](/docs/category/spec/); project stage: [Project status](/docs/getting-started/project-status/).
