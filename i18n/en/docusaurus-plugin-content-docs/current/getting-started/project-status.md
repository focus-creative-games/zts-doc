---
sidebar_position: 4
title: Project status
description: Alpha-stage capability boundaries and dual-runtime maturity.
---

# Project status

ZTS is currently **Alpha**: APIs and specs may still iterate, but core interop (bidirectional calls, main marshal paths, TS workflow) has passed internal matrix coverage on Editor Mono and Il2Cpp Player (including Win64 / Android / iOS). See [Compatibility](/docs/getting-started/compatibility/): Player targets **all Il2Cpp-supported platforms** (including WebGL, mini games, HarmonyOS / automotive, etc.).

| Dimension | Notes |
|-----------|-------|
| Editor Mono | Day-to-day dev & smoke (Windows / macOS); Expression Emit |
| Il2Cpp Player | Shipping path; `zts-runtime` C++ bridges; any Il2Cpp-buildable target |
| Docs | This site + upstream `Docs/spec` |
| Demo | [zts-demo](https://github.com/focus-creative-games/zts-demo) `js-demo` / `ts-demo` |
| Unreal (**zts-ue**) | Sister product: [zts-ue](https://github.com/focus-creative-games/zts-ue); UE / C++; **still in development**, not covered by this site |

Issues and requests: [GitHub Issues](https://github.com/focus-creative-games/zts/issues), or [Contact](/docs/community/contact/) (QQ / Discord). For UE, follow [zts-ue](https://github.com/focus-creative-games/zts-ue).
