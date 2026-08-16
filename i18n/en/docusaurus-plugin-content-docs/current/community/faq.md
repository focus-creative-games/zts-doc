---
sidebar_position: 1
title: FAQ
description: 常见问题。
---

# FAQ

按主题分类；未覆盖见 [排障](/docs/guides/troubleshooting/) 或 [GitHub Issues](https://github.com/focus-creative-games/zts/issues)。

## 一般

### ZTS 和 ZLua 是什么关系？

同属 Code Philosophy 产品线：**语义同构**（`GetFunction`、Marshal、strict miss、Event 用 `add_`/`remove_`、双运行时等），脚本语言不同（JS/TS vs Lua）。可 **同工程并存**（不同 AppDomain 门面：`TsAppDomain` / `LuaAppDomain`），VM 与包彼此独立。选型叙事见 [为什么选择 ZTS](/docs/concepts/why-zts/)；Lua 侧见 [ZLua 文档](https://doc.zlua.cn)。

### 有 Unreal Engine 版本吗？

有，仓库名为 **[zts-ue](https://github.com/focus-creative-games/zts-ue)**：面向 UE、对 C++ 优化的现代 TypeScript 方案。**目前仍在开发中**；本站文档仅覆盖 **Unity / 团结** 上的 ZTS，UE 用法与进度请跟进该仓库，勿与 Unity Issue 混提。

### 运行时会执行 TypeScript 吗？

**不会。** 运行时只跑 emit 后的 **ES module（JS）**。TS 负责编辑期类型与闸门检查。见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

### 当前适合上生产吗？

处于 **Alpha**：Editor Mono 与 Il2Cpp Player（Win64 / Android / iOS 等）主路径已过内部矩阵；Player 设计覆盖 **Il2Cpp 支持的全部平台**（含 WebGL、小游戏、鸿蒙 / 车机等）。API/规范可能迭代，接受 Install、Generate、libil2cpp 维护成本后再上业务。见 [项目状态](/docs/getting-started/project-status/)、[兼容性](/docs/getting-started/compatibility/)。

### Demo 打不开 / 包路径报错？

检查：已支持的 Unity / 团结版本、UPM `file:` 或 git 路径、Node（仅 ts-demo / `TsProject`）、是否按 demo README 打开正确工程。见 [兼容性](/docs/getting-started/compatibility/)、[安装](/docs/guides/install/)。

---

## 安装、Generate 与脚本目录

### 发布前要不要 Generate？

**Il2Cpp Player：要。** 菜单 **`ZTS/Generate/All`** 生成 **C++ MethodBridge stub**，**不是** Puerts/xLua 式海量 C# Wrap。Editor Mono 日常迭代 **不必** 每次 Generate。**C#→JS（`GetFunction`）无 Generate 步骤。** TypeScript 声明用 **`ZTS/Generate Typings`**，类型集须与 Generate **同源**。

### 脚本放哪里？Editor 和 Player 一样吗？

| 形态 | Editor 权威源 | Player |
|------|---------------|--------|
| 纯 JS | 工程旁 `JsScripts/**/*.js`（或 loader 约定） | Sync 到 `StreamingAssets/Js/`（或约定路径） |
| TypeScript | `TsProject/src/**` → emit `TsProject/out/**` | 拷贝 `out/**/*.js` → `StreamingAssets/ZTS/` |

canonical 模块名 **不含** `.js` / `.ts`（如 `"app"`、`"game/logic"`）。见 [构建](/docs/guides/build/)、[C# 调用 JS](/docs/guides/csharp-calling-js/)。

---

## 类型与语法

### `csharp:` 和 `CSharp` 有什么区别？

**同一套类型对象**，两种入口：

- `import { Demo } from "csharp:Assembly-CSharp"` — ESM / TS 推荐
- `CSharp['Assembly-CSharp'].Demo` — 根表懒绑定

含 namespace须 `CSharp.AC['MyGame.UI.Panel']` 或 `import { Panel } from "csharp:Assembly-CSharp/MyGame.UI"`。迁移用的 `CS.*` 是 **adaptor**，不是核心 API。见 [JS 调用 C#](/docs/guides/js-calling-csharp/)。

### Event 怎么订阅？

**没有** Event 专用对象，也没有可靠的 `.get` / `.set` / 赋值糖。使用：

```javascript
obj.add_OnHpChanged(handler);
obj.remove_OnHpChanged(handler); // 必须是同一 function 引用
```

与 ZLua 同构。见 [JS 调用 C# · Event](/docs/guides/js-calling-csharp/)。

### ref / out 怎么用？

- **C#→JS**（`GetFunction`）：byref 默认 **OpaqueValue**，用 `zts.get_opaquevalue` / `set_opaquevalue`；**不可跨帧持久化**。
- **JS→C#**：裸 `number` **不写回**；同型 ByVal struct exotic 或 Opaque 可写回。

详见 [ref/out/in](/docs/guides/ref-out-in/)。

### 为什么访问不存在的成员会抛错（strict miss）？

ZTS 对未知成员 **throw `Error('zts: …')`**，**不**返回 `undefined`。依赖「读不到就 undefined」的旧习惯需要改写。见 [排障](/docs/guides/troubleshooting/)。

---

## 互操作

### 如何从 C# 调用 JS？

```csharp
TsAppDomain.Initialize(loader);
var add = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
```

要求目标模块有 **named export**；`jsModule` 用 canonical；**不要**对 `csharp:` 调 `GetFunction`。热路径缓存 delegate；`Reset` 后旧委托作废。见 [C# 调用 JS](/docs/guides/csharp-calling-js/)。

### TypeScript「进 Play 闸门」是什么？

可选：进 Play 前跑 `tsc --noEmit`，失败则 **阻止 Play**，避免带着类型错误迭代。运行时仍只加载 emit 的 JS。见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

### JS 调试器在 Player 上能用吗？

规范覆盖的调试器 Host Hook 面向 **Editor Mono**；真机 / Il2Cpp Player attach **本规范不覆盖**。断点、端口、source map 见 [JS 调试器](/docs/guides/js-debugger/)。

---

## Editor / Player

### Editor 正常、Player 失败？

按清单排查：

1. 是否 **`ZTS/Install`** 且 **`ZTS/Generate/All`**
2. 脚本是否 Sync / 拷贝到 StreamingAssets；canonical 是否带了多余 `.js`
3. 是否仍用废弃 Event 糖语法
4. Typings 与 Generate 是否同源
5. Build 是否 Il2Cpp、目标平台是否在支持矩阵内

见 [Editor 与 Player](/docs/guides/editor-vs-player/)、[排障](/docs/guides/troubleshooting/)。

### Editor 和 Player 语义会不会不一样？

**JS 可见语义必须一致**；实现路径不同（Mono Expression Emit vs Il2Cpp C++ stub）。发现不一致请按 [测试](/docs/community/testing/) 附最小复现提 Issue。

---

## 相关文档

- [排障指南](/docs/guides/troubleshooting/)
- [规范总览](/docs/spec/00-OVERVIEW/)
- [迁移](/docs/community/migration/)
- [联系方式](/docs/community/contact/)
