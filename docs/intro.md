---
sidebar_position: 1
slug: /intro
title: 介绍
description: ZTS 是什么、核心特性与适用场景。
---

# 介绍

**ZTS** 是一个针对 Unity Il2Cpp 优化的现代 **TypeScript / JavaScript** 脚本方案，由 **QuickJS** 驱动，设计与 [ZLua](https://doc.zlua.cn) 对齐。

它用清晰的规则统一 C# 与 JS 的双向调用：`TsAppDomain.GetFunction`、`CSharp[…]` / `import from "csharp:…"`、`[TsMarshalAs]` 等，屏蔽底层易错的原生绑定细节。

## 为什么选择 ZTS

相对 Puerts / 自管 QuickJS，以及「手写绑定」：

| | |
|--|--|
| **更易用** | 设计贴近 C#；**零 per-type Wrap 白名单**；类型懒绑定 |
| **更完备** | 重载、ref/out、struct ByVal/ByObj、Nullable、委托、数组、指针、`[TsMarshalAs]` 等 |
| **更统一** | 与 ZLua **同一套语义契约**；会用 ZLua 即可很快上手 ZTS |
| **更高效** | Player **Il2Cpp** 热路径为 C++ 桥接；签名复用 stub |
| **更少 GC** | 引用类型与 struct 默认 Registry / ByVal；另有 Opaque 等策略 |
| **双运行时** | Editor **Mono** + 发布 **Il2Cpp Player** |
| **TS 一等公民** | `TsProject`、`csharp:` 声明、进 Play 闸门；运行时仍只跑 emit 后的 JS |

完整论述见 **[为什么选择 ZTS](/docs/concepts/why-zts/)**；对照见 **[选型对比](/docs/compare/FEATURES/)**。

## 核心特性

| 能力 | 说明 |
|------|------|
| JS/TS → C# | `CSharp` 懒绑定或 `import { T } from "csharp:…"` |
| C# → JS | `TsAppDomain.GetFunction<T>` 取得 Delegate 后调用 |
| 双运行时 | **Mono（Editor）与 Il2Cpp（Player）**；语义一致、实现路径不同 |
| TypeScript | 官方工作流；见 [TypeScript 工作流](/docs/guides/typescript-workflow/) |
| Marshal | ByVal / ByObj / Opaque 等，见 [Marshal 规范](/docs/spec/marshal/) |

:::info 当前状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 已完成</span><span class="runtimeBadgeIl2cpp">Il2Cpp · 已完成</span></span>

日常在 **Editor（Mono）** 开发；发版与性能以 **Il2Cpp Player** 为准。详见 [项目状态](/docs/getting-started/project-status/)。
:::

## 下一步

- [5 分钟快速开始](/docs/getting-started/quick-start/) — 跑通 js-demo / ts-demo
- [安装与集成](/docs/getting-started/installation/)
- [使用指南](/docs/guides/install/)
- [规范总览](/docs/spec/00-OVERVIEW/)
