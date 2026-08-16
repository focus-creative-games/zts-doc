---
sidebar_position: 1
title: 参考总览
description: API 参考入口。
---

# 参考总览

程序员查表入口：C# 宿主 API、特性、脚本侧 `CSharp` / `csharp:` / `zts`，以及 Marshal 规则摘要。**完整契约以 [规范文档](/docs/spec/00-OVERVIEW/) 为准**；本区为查表摘要。

## C# 宿主与特性

| 项 | 说明 | 文档 |
|----|------|------|
| `TsAppDomain` | 初始化 / `Reset` / `GetFunction` | [TsAppDomain](/docs/reference/ts-app-domain/) |
| `[TsMarshalAs]` | 覆盖默认 Marshal | [Attributes](/docs/reference/attributes/) · [指南](/docs/guides/ts-marshal-as/) |
| `[TsAlias]` | 方法 JS 最终名（替换默认名） | [Attributes](/docs/reference/attributes/) · [指南](/docs/guides/ts-alias/) |
| `[TsExtension]` | 被扩展类型上声明扩展类列表 | [Attributes](/docs/reference/attributes/) · [指南](/docs/guides/extension-methods/) |

## 脚本侧表面

| 表面 | 说明 | 文档 |
|------|------|------|
| `CSharp` | 程序集 / 类型懒加载根（权威低层） | [zts 与 csharp:](/docs/reference/js-surface/) |
| `csharp:` | 推荐的 ES `import` 类型模块 | 同上 · [类型系统 §2.11](/docs/spec/02-TYPE-SYSTEM/) |
| `zts.*` | 类型构造、opaque、数组、delegate、短名注册 | [js-surface](/docs/reference/js-surface/) · [指南](/docs/guides/zts-lib/) |

## Marshal

| 资源 | 说明 |
|------|------|
| [Marshal 概览](/docs/concepts/marshal-overview/) | 默认 Push/Pop 与覆盖入口 |
| [Marshal 规范](/docs/spec/marshal/) | 权威完整规则（含 `[TsMarshalAs]`） |
| [TsMarshalAs 指南](/docs/guides/ts-marshal-as/) | 常用标注与合法组合实操 |

## 使用指南索引

| 主题 | 文档 |
|------|------|
| 安装 / 互调 / 构建 / 调试 | [install](/docs/guides/install/) · [hello-interop](/docs/guides/hello-interop/) · [build](/docs/guides/build/) · [js-debugger](/docs/guides/js-debugger/) |
| JS → C# / C# → JS | [js-calling-csharp](/docs/guides/js-calling-csharp/) · [csharp-calling-js](/docs/guides/csharp-calling-js/) |
| 值类型 / Function / 数组 / 泛型 | [value-types](/docs/guides/value-types/) · [functions](/docs/guides/functions/) · [arrays](/docs/guides/arrays/) · [generics](/docs/guides/generics/) |
| ref / MarshalAs / 少 GC | [ref-out-in](/docs/guides/ref-out-in/) · [ts-marshal-as](/docs/guides/ts-marshal-as/) · [zero-gc-marshal](/docs/guides/zero-gc-marshal/) |
| 重载 / Alias / Extension | [overloads](/docs/guides/overloads/) · [ts-alias](/docs/guides/ts-alias/) · [extension-methods](/docs/guides/extension-methods/) |
| TypeScript 工作流 | [typescript-workflow](/docs/guides/typescript-workflow/) |

## 权威规范

| 规范 | 内容 |
|------|------|
| [00-OVERVIEW](/docs/spec/00-OVERVIEW/) | 双运行时、初始化地图 |
| [01-HOST-API](/docs/spec/01-HOST-API/) | `TsAppDomain`、`GetFunction`、特性摘要 |
| [02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/) | `CSharp`、`csharp:`、构造与成员 |
| [05-LIB](/docs/spec/05-LIB/) | `zts.*` 全文 |
| [10-LIFETIME](/docs/spec/10-LIFETIME/) | Registry、`TsFramePump`、`Reset` |
