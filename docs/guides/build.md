---
sidebar_position: 22
title: 构建
description: Il2Cpp Generate、脚本 Sync / TS emit 与发布检查清单。
---

# 构建

Editor（Mono）Play 不需要 per-type C# Wrap；发布 **Il2Cpp Player** 前必须完成 Install、Generate 与脚本同步。语义以 [Editor 与 Player](/docs/guides/editor-vs-player/) 为准。

## 发布前清单

| 步骤 | 做什么 |
|------|--------|
| 1 | 已 [Install](/docs/guides/install/)（本地 `libil2cpp` / QuickJS / `zts-runtime` 存在） |
| 2 | 菜单 **`ZTS/Generate/All`**（生成 C++ stub，**不是** C# Wrap） |
| 3 | 纯 JS：将 `JsScripts` 同步到 StreamingAssets；TS：emit 后拷贝 `out/**` → `StreamingAssets/ZTS/` |
| 4 | Build Settings → **Il2Cpp** → 目标平台 |
| 5 | 导出工程后可用 **Debug\|x64**（开发）或 Release 构建原生产物 |
| 6 | 真机 / 包体冒烟：Initialize、互调、勿用废弃 Event API |

## Install 与 QuickJS

确认包内 `ZTS~/zts-runtime`、`ZTS~/quickjs-il2cpp` 已由 **`ZTS/Install...`** 装入 LocalIl2Cpp（输出根一般在 `Library/ZTS/LocalIl2CppData-…`）。Install 顺序摘要：

1. 同步 Settings `quickjsVersionId` 与 vendored `VERSION`
2. 复制 stock `libil2cpp` 并打 Unity 系列 patch
3. 覆盖拷贝 `zts-runtime` → `libil2cpp/zts`
4. 整目录拷贝 `quickjs-il2cpp` → `libil2cpp/quickjs`
5. 写入 Define / `ZTSConf.inc`；必要时提示重启 Editor

QuickJS / 原生相关见 [spec/build · QuickJS](/docs/spec/build/01-QUICKJS/)、[多版本管理](/docs/spec/11-MULTI-VERSION/)。

团队内部联调可参考 ZTSTest：改 `Build-Win64/.../libil2cpp/zts` → 同步回包内 `ZTS~/zts-runtime`（具体脚本以仓库为准）。

## Generate

- 菜单：**`ZTS/Generate/All`**
- 依赖：本地 Install 树已存在
- 作用：为 Il2Cpp 生成桥接 stub；改 public API / 换 Unity 后应重跑
- Editor 日常迭代 **不必** 每次 Generate
- TypeScript 声明：**`ZTS/Generate Typings`**（可挂在 Generate 之后）；类型集须与 Generate **同源**，禁止单独维护另一份 typings 白名单

## 脚本同步到 StreamingAssets

Player 侧 loader 读的是 StreamingAssets，不是工程根 `JsScripts` / `TsProject/out`。

### 纯 JS

1. 构建前将 `JsScripts/**/*.js` 拷到 `StreamingAssets/Js/`（或你在 loader 中约定的路径）
2. canonical 仍不含 `.js`：`GetFunction("app", …)` → 磁盘 `…/app.js`
3. 可用 `IPreprocessBuildWithReport` 自动化（参照 [zts-demo](https://github.com/focus-creative-games/zts-demo)）

### TypeScript

1. `tsc --noEmit`（可选但推荐，失败则中断出包）
2. esbuild / `tsc` emit 到 `TsProject/out/`（**禁止** bundle）
3. 拷贝 `out/**/*.js`（及可选 `.js.map`）→ `StreamingAssets/ZTS/`
4. Player `moduleLoader` **只**读该目录，**不**依赖 Node、**不**读 `.ts`

详解见 [TypeScript 工作流](/docs/guides/typescript-workflow/)、[C# 调用 JS · 模块加载](/docs/guides/csharp-calling-js/)。

## Editor vs Player（只记差异）

| | Editor (Mono) | Player (Il2Cpp) |
|--|---------------|-----------------|
| JS 可见语义 | 与 Player **一致** | 与 Editor **一致** |
| 实现 | Expression Emit 等 | C++ stub + `zts-runtime` |
| Generate | 不强制 | **必须** |
| 脚本路径 | `JsScripts` / `TsProject/out` | StreamingAssets |

性能对比请以 **Player** 为准。

## 常见失败

| 现象 | 处理 |
|------|------|
| 提示未 Install | 先 [Install](/docs/guides/install/) |
| Player 无 JS 输出 / module not found | 未 Sync / 未拷贝 emit；扩展名或子路径错误 |
| Editor 正常 Player 崩 | 未 Generate；或使用了废弃 Event 糖语法 |
| 换 Unity / 换 QuickJS pin 后异常 | 重跑 Install → Generate |
| TS 出包失败 | Node 缺失；`tsc` 错误；out 过期 |

## 学习路径

| | |
|---|---|
| **上一篇** | [TypeScript 工作流](/docs/guides/typescript-workflow/) |
| **下一篇** | [JS 调试器](/docs/guides/js-debugger/) |

## 相关文档

- [Editor 与 Player](/docs/guides/editor-vs-player/)
- [项目状态](/docs/getting-started/project-status/)
- [排障](/docs/guides/troubleshooting/)
- [兼容性](/docs/getting-started/compatibility/)
