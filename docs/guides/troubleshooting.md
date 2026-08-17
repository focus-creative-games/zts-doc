---
sidebar_position: 24
title: 排障
description: ZenTS 常见问题诊断与解决方案（附录）。
---

# 排障

附录。开发期可在 **Editor（Mono）** 快速迭代；Player 问题先确认 **`ZenTS/Generate/All`** 与 [兼容性](/docs/getting-started/compatibility/)。主线学习请从 [安装](/docs/guides/install/) 起。

Canonical 工程：[zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)（`js-demo` / `ts-demo`）。

---

## 安装与启动

### Play 后完全无 JS 输出

| 检查项 | 说明 |
|--------|------|
| `JsAppDomain.Initialize` | 须 `[RuntimeInitializeOnLoadMethod(BeforeSceneLoad)]` 或更早 |
| loader 返回值 | `LoadJsModule("app")` 是否非 null；路径是否指向 `JsScripts` / `out/` |
| Console 过滤器 | 确认未隐藏 `Log` |

### module not found / loader 失败

| 检查项 | Editor | Player |
|--------|--------|--------|
| 纯 JS 路径 | `{ProjectRoot}/JsScripts/xxx.js` | `StreamingAssets/Js/xxx.js`（或约定路径） |
| TS 路径 | `TsProject/out/xxx.js` | `StreamingAssets/ZenTS/xxx.js` |
| canonical | **不含** `.js`；`GetFunction("app", …)` 不是 `"app.js"` |
| Sync / emit | 可选 | **必须** Sync 或拷贝 emit |

---

## 类型与成员访问

### 程序集 / 类型找不到

- 错误形如 `zents: assembly not found` / `type not found`（或等价 `Error`）
- 检查程序集名 / 别名：`CSharp['AC'] = CSharp['Assembly-CSharp']`
- 含 namespace须 `CSharp.AC['Ns.Type']` 或 `import { T } from "csharp:Assembly-CSharp/Ns"`
- TS：是否已 **Generate Typings**；声明集是否与 Generate 同源

### `Error('zents: … member not found')`（strict miss）

- 拼写、是否 `public`、是否在实例上误访静态（或反之）
- **不要**期望未知成员返回 `undefined`
- 扩展方法是否已配置到该类型（见 [Extension](/docs/guides/extension-methods/)）

### Event `.get` / `.set` 无效

已废弃。改用 `add_OnX` / `remove_OnX`，且 remove 时须 **同一 function 引用**。见 [JS 调用 C#](/docs/guides/js-calling-csharp/)。

### 方法 this 丢失

```js
demo.SetX(1);        // ✅
const fn = demo.SetX;
fn(1);               // ❌ 提取函数不绑定 this
```

保持 `obj.Method(args)` 调用形式。

---

## C# 调用 JS

### `GetFunction` 无效

- 是否已 `JsAppDomain.Initialize`
- module / export 是否与 **named export** 一致（非 `export default`）
- `T` 委托签名是否匹配
- 是否刚 `Reset`：旧委托已作废，须重新 `GetFunction`
- **不要**对 `csharp:` 模块调用 `GetFunction`

### 再次 `Initialize` 抛异常

已有主 `JSContext` 时须 `JsAppDomain.Reset(loader)`，**不能**再次 `Initialize`「只换 loader」。见 [宿主 API](/docs/spec/01-HOST-API/)。

---

## TypeScript / Play 闸门

| 现象 | 处理 |
|------|------|
| Play 被拦截 | 修复 `tsc --noEmit` 错误；或 Settings 临时关闸门 |
| `csharp:` 补全缺失 | Generate Typings；提交 `generated/` |
| 运行时仍像旧代码 | 未 emit / `out/` 过期；Player 未拷贝 StreamingAssets |
| `import type` 后构造失败 | 改为值导入 |

见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

---

## JS 调试器

断点不生效、连不上、Play 假死：见 [JS 调试器](/docs/guides/js-debugger/)（Host 类型名、端口、`WaitForAttach`、source map）。

---

## Editor 正常、Player 失败

| 检查 | 说明 |
|------|------|
| Install | 本地 Il2Cpp / QuickJS / zents 树是否存在 |
| Generate | Il2Cpp 必须 Generate C++ stub |
| StreamingAssets | JS / TS emit 是否 Sync |
| 废弃 API | 勿用 Event `.get`；方法用点号而非冒号 |

更多对照见 [Editor 与 Player](/docs/guides/editor-vs-player/)、[构建](/docs/guides/build/)。

---

## 包路径

| 现象 | 处理 |
|------|------|
| Package 解析失败 | `manifest.json` 的 `file:` / git URL；开发期改路径后刷新 Package Manager |
| 换包后 TS types 失效 | 检查 `tsconfig` 对包内 `ZenTS~/types` 的引用 |

---

## 学习路径

| | |
|---|---|
| **上一篇** | [JS 调试器](/docs/guides/js-debugger/) |
| **下一篇** | [Editor 与 Player](/docs/guides/editor-vs-player/) |

## 相关文档

- [FAQ](/docs/community/faq/)
- [安装](/docs/guides/install/)
- [Hello 互操作](/docs/guides/hello-interop/)
- [宿主 API](/docs/spec/01-HOST-API/)
- [类型系统](/docs/spec/02-TYPE-SYSTEM/)
