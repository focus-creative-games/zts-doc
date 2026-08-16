---
sidebar_position: 21
title: Editor 与 Player
description: Mono Editor 与 Il2Cpp Player 双运行时的差异（附录）。
---

# Editor 与 Player

附录。发布清单亦可参阅 [构建](/docs/guides/build/)。ZTS 双后端：**JS 可见语义必须一致**；实现路径不同。

| | Editor (Mono) | Player (Il2Cpp) |
|---|---------------|-----------------|
| **状态** | 日常开发与冒烟（Windows / macOS） | 发布路径（Il2Cpp 全平台，见 [兼容性](/docs/getting-started/compatibility/)） |
| 实现 | Expression Emit + exotic 绑定 | C++ `zts-runtime` + native 桥 |
| 引擎 | `Plugins/quickjs` 动态库（`DllImport("quickjs")`） | QuickJS 源码静态编入 Il2Cpp（`ZTS~/quickjs-il2cpp`） |
| C#→JS | `TsAppDomain.GetFunction<T>` + Delegate 桥 | 同左 |
| JS→C# | 懒绑定 / `csharp:` | 同左（须 Generate） |
| 脚本加载 | 常读工程旁 `JsScripts` / `TsProject/out` | `StreamingAssets/Js` 或 `StreamingAssets/ZTS` |
| Generate | Editor 日常迭代 **不必** 每次 | **必须** `ZTS/Generate/All`（C++ stub，非 C# Wrap） |
| JS 调试器 | 可选 Host Hook（见 [JS 调试器](/docs/guides/js-debugger/)） | **本规范不覆盖**真机 attach |
| TS 闸门 | 进 Play 可跑 `tsc --noEmit` | 出包前可选再检；运行时 **不**读 `.ts` |

详见 [Mono 实现](/docs/impl/MONO/)、[Il2Cpp 实现](/docs/impl/IL2CPP/)、[双运行时](/docs/concepts/dual-runtime/)。

:::info 语义一致
Event、Marshal、类型访问、strict miss、方法 this 绑定等以 [规范](/docs/spec/00-OVERVIEW/) 为准。两端均 **无** Event 专用对象（只用 `add_` / `remove_`）；实例方法均为 **`obj.Method(args)`**（无冒号）；未知成员均为 **`throw Error('zts: …')`**。
:::

## 同一门面

业务代码只面对 **`TsAppDomain`**：

```csharp
TsAppDomain.Initialize(loader);
var add = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
```

首次 `Initialize` / `GetFunction` 时按环境反射创建后端（Editor → `ZTS.Mono`，Player → `ZTS.Il2Cpp`）。**不要**在业务里直接依赖 Mono/Il2Cpp 程序集。

## 性能与迭代

| 阶段 | 建议 |
|------|------|
| 日常改脚本 | Editor Play；纯 JS 或 TS emit |
| 测性能 / 发版 | 以 **Il2Cpp Player** 为准 |
| 换 Unity / QuickJS pin | 重跑 [Install](/docs/guides/install/) → Generate |

Editor 便于断点与快速迭代；热路径分配、桥接开销请在 Player 上测。

## Player 发布检查清单

- [ ] 已 [Install](/docs/guides/install/)（本地 `libil2cpp` / quickjs / zts 树存在）
- [ ] 执行 **`ZTS/Generate/All`**
- [ ] 纯 JS 已 Sync 到 StreamingAssets；或 TS 已 emit 并拷贝到 `StreamingAssets/ZTS/`
- [ ] Build Settings → **Il2Cpp** → 目标平台
- [ ] 冒烟：`Initialize`、`GetFunction`、JS→C#；勿用废弃 Event 糖语法
- [ ] 对照 [兼容性矩阵](/docs/getting-started/compatibility/)

## 常见踩坑

| 现象 | 处理 |
|------|------|
| Editor 正常、Player 无脚本 | 未 Sync / 未拷贝 emit；loader 路径不一致 |
| Player 类型/成员缺失 | 未 Generate，或 typings 集与 Generate 不同源 |
| Editor 有调试、Player 没有 | 预期行为；调试器仅 Editor Mono |
| 行为不一致 | 对照 [spec](/docs/category/spec/)；提 Issue 并附最小复现 |

## 学习路径

| | |
|---|---|
| **上一篇** | [排障](/docs/guides/troubleshooting/) |
| **下一篇** | — |

## 相关文档

- [构建](/docs/guides/build/)
- [双运行时](/docs/concepts/dual-runtime/)
- [项目状态](/docs/getting-started/project-status/)
- [排障](/docs/guides/troubleshooting/)
- [QuickJS 构建](/docs/spec/build/01-QUICKJS/)
