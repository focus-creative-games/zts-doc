---
sidebar_position: 1
slug: /intro
title: 介绍
description: ZenTS 是什么、核心特性与适用场景。
---

# 介绍

**ZenTS**（formerly ZTS）是一个针对 Unity Il2Cpp 优化的现代 **TypeScript / JavaScript** 脚本方案，由 **QuickJS** 驱动，设计与 [ZLua](https://doc.zlua.cn) 对齐。

它用清晰的规则统一 C# 与 JS 的双向调用：`JsAppDomain.GetFunction`、`CSharp[…]` / `import from "csharp:…"`、`[JsMarshalAs]` 等，屏蔽底层易错的原生绑定细节。

## Naming

| Use | Name |
|------|------|
| Product | **ZenTS** |
| Code identifier | `zents` (`zents.*`, `Error('zents: …')`) |
| C# namespace / assemblies | `ZenTS`, `ZenTS.Common` / `ZenTS.Mono` / `ZenTS.Il2Cpp` |
| Unity package / repo | `com.code-philosophy.zen-ts` · [zen-ts](https://github.com/focus-creative-games/zen-ts) |
| Website | [https://zen-ts.com](https://zen-ts.com) |

## 为什么选择 ZenTS

相对 Puerts / 自管 QuickJS，以及「手写绑定」：

| | |
|--|--|
| **更易用** | 设计贴近 C#；**零 per-type Wrap 白名单**；类型懒绑定 |
| **更完备** | 重载、ref/out、struct ByVal/ByObj、Nullable、委托、数组、指针、`[JsMarshalAs]` 等 |
| **更统一** | 与 ZLua **同一套语义契约**；会用 ZLua 即可很快上手 ZenTS |
| **更高效** | Player **Il2Cpp** 热路径为 C++ 桥接；签名复用 stub |
| **更少 GC** | 引用类型与 struct 默认 Registry / ByVal；另有 Opaque 等策略 |
| **双运行时** | Editor **Mono** + 发布 **Il2Cpp Player** |
| **TS 一等公民** | `TsProject`、`csharp:` 声明、进 Play 闸门；运行时仍只跑 emit 后的 JS |

完整论述见 **[为什么选择 ZenTS](/docs/concepts/why-zents/)**；对照见 **[选型对比](/docs/compare/FEATURES/)**。

## 核心特性

| 能力 | 说明 |
|------|------|
| JS/TS → C# | `CSharp` 懒绑定或 `import { T } from "csharp:…"`；实例 `obj.Method(args)` |
| C# → JS | `JsAppDomain.GetFunction<T>(module, export)`（specifier **无** `.js`/`.ts`） |
| 双运行时 | **Mono（Editor）与 Il2Cpp（Player）**；语义一致、实现路径不同 |
| TypeScript | 官方工作流；见 [TypeScript 工作流](/docs/guides/typescript-workflow/) |
| Marshal | ByVal / ByObj / Opaque 等，见 [Marshal 规范](/docs/spec/marshal/) |
| miss | 未注册成员 **`throw Error('zents: member not found')`**，不返回 `undefined` |

:::info 当前状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 已完成</span><span class="runtimeBadgeIl2cpp">Il2Cpp · 已完成</span></span>

日常在 **Editor（Mono）** 开发；发版与性能以 **Il2Cpp Player** 为准。详见 [项目状态](/docs/getting-started/project-status/)。
:::

## 诚实边界

| 情况 | 建议 |
|------|------|
| 不愿维护 libil2cpp 集成 | 评估 Puerts / 更轻量自管方案 |
| 已有大量 Puerts 资产 | 先读 [迁移](/docs/community/migration/) |
| 只需极少手写绑定 | 自管 QuickJS 可能更直接 |
| 团队只写 Lua | 优先 [ZLua](https://doc.zlua.cn) |

公开性能数字：方法论对齐 ZLua；**ZenTS 公开基准待补齐**（见 [特性对比](/docs/compare/FEATURES/)）。

## 相关产品

| 产品 | 说明 |
|------|------|
| **本站（ZenTS）** | Unity / 团结引擎上的 TypeScript·JavaScript（QuickJS）方案 |
| **[ZLua](https://doc.zlua.cn)** | 同构语义的 Lua 产品线 |
| **[zts-ue](https://github.com/focus-creative-games/zts-ue)** | Unreal Engine 上的现代 TypeScript 方案（面向 C++ 优化）；**目前仍在开发中**，本站文档不覆盖 UE 用法 |

## 下一步

1. [5 分钟快速开始](/docs/getting-started/quick-start/) — 跑通 js-demo / ts-demo
2. [安装与集成](/docs/getting-started/installation/) · [使用指南](/docs/guides/install/)
3. [设计概览](/docs/concepts/design-overview/) · [双运行时](/docs/concepts/dual-runtime/)
4. [规范总览](/docs/spec/00-OVERVIEW/) — 需要完备语义时再深入
