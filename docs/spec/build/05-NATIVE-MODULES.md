---
sidebar_position: 5
title: "第三方原生模块"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`build\05-NATIVE-MODULES.md`）
:::


# 构建 — QuickJS 原生 C 模块

> 约定游戏工程如何把 **非 ZenTS 随附** 的 QuickJS **C 扩展模块**（如自定义 `js_init_module_*`、第三方 `.c` 库）接到 ZenTS。
> **不**把具体第三方库 vendoring 进 `com.code-philosophy.zen-ts`。
> 引擎构建见 [01-QUICKJS.md](./01-QUICKJS.md)；多版本见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md)；宿主见 [01-HOST-API.md](../01-HOST-API.md)。
> ES 业务模块仍走 **`moduleLoader`**；**`csharp:`** 类型模块由 ZenTS 运行时拦截（[02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §2.11），**不是** 本文的第三方 C 扩展。
> 本文只讨论 **非 ZenTS 随附** 的原生 C / 内置 module 路径。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| 业务 API | 统一 **`import`** / 动态 `import()`（ES module）；C 模块以 **`JSModuleDef *`** 或 **`js_init_module_*`** 注册 |
| Editor | 动态库 + **`JS_SetModuleLoaderFunc`** 扩展 **或** 静态链入 Editor `quickjs.dll` 构建 |
| Player (Il2Cpp) | 静态链接进 `libil2cpp` + 启动期 `js_init_module_*` / loader 回调 |
| 纯 JS | 仅经 **`moduleLoader`**，无原生 |
| ABI | 与 Settings **`quickjsVersionId`** **同一 pin** 编译 |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| 随包分发 socket / crypto 等二进制或源码 | **不做**（许可、体积、安全） |
| Player 上依赖 `dlopen` 加载 `.so` 作为 **主路径** | **不推荐**（iOS / WebGL；Android 成本高） |
| 改变 C#↔JavaScript 互操作语义 | **不做** |
| CommonJS `require` + `module.exports` | **不在** v1 规范范围 |
| 替代 `moduleLoader` 加载 `.js` / `.ts` 业务模块 | **不做**；原生与 ES 源码路径正交 |

### 1.3 现状（实现边界）

| 能力 | 行为 |
|------|------|
| QuickJS 标准 | `quickjs-libc` 提供 **`js_init_module_std`** / **`js_init_module_os`** 参考 |
| ZenTS 宿主 loader | C# **`moduleLoader`** 返回 **ES module 源码**（string / byte[]） |
| 公共 `RegisterNativeModule` API | **当前无**；产品化钩子见 §6 |
| Editor 调试 hook | 见 [04-JS-DEBUGGER.md](./04-JS-DEBUGGER.md)；**不是** C 模块 |

---

## 2. QuickJS 模块机制（规范引用）

### 2.1 ES Module Loader（运行时级）

QuickJS 在 **`JSRuntime`** 上设置：

```c
void JS_SetModuleLoaderFunc(JSRuntime *rt,
    JSModuleInitFunc *module_init, JSModuleLoaderFunc *module_loader, void *opaque);

void JS_SetModuleLoaderFunc2(JSRuntime *rt,
    JSModuleInitFunc *module_init, JSModuleLoaderFunc *module_loader,
    JSModuleCheckAttributesFunc *module_check_attributes, void *opaque);
```

| 回调 | 职责 |
|------|------|
| **`module_loader`** | 按 module specifier 解析并编译模块；返回 **`JSModuleDef *`** |
| **`module_init`** | 模块命名空间初始化（可选） |
| **`module_check_attributes`** | import attributes 校验（QuickJS 新版本；可选） |

ZenTS **`JsAppDomain.Initialize`** 安装的 loader 链（概念顺序）：

1. **`csharp:`** — ZenTS 保留；合成 CLR 类型模块（[02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §2.11）
2. **原生 C 模块** — 本文；`js_init_module_*` 或并列 loader
3. 宿主 **`moduleLoader`** — 业务 JS/TS 源码

**禁止** 第三方以 `csharp:` 前缀注册原生模块。`module_normalize` 对 `csharp:` specifier **原样返回**。

### 2.2 C 模块初始化函数（惯例）

QuickJS 生态常见模式：

```c
JSModuleDef *js_init_module_foo(JSContext *ctx, const char *module_name);
```

模块内用 **`JSExport`** / **`JS_SetModuleExport`** 导出符号；脚本侧：

```javascript
import { bar } from "foo";
```

**specifier 字符串** `"foo"` 须在 loader 或 **`JS_AddModuleExport`** 路径上与 C 侧 **`module_name`** 一致。

### 2.3 与 `quickjs-libc` 的关系

上游 **`quickjs-libc.c`** 提供：

- **`js_module_loader`** — 磁盘 JSON / ES module 加载参考
- **`js_init_module_std`** / **`js_init_module_os`**

ZenTS **默认不** 暴露完整 `qjs` CLI 磁盘搜索路径；若工程需要 **`std`** / **`os`** 模块，须在 Install / 启动期 **显式** `js_init_module_*`（Player）或扩展 Editor loader（§3）。

---

## 3. 形态对照

| 形态 | 宿主 | 加载 |
|------|------|------|
| A 纯 ES module | Editor + Player | `moduleLoader(specifier)` → 编译 ES module |
| **`csharp:` 类型模块** | Editor + Player | ZenTS 拦截；**不** 经 `moduleLoader`；见类型系统 §2.11 |
| B 原生动态 | **仅 Editor Mono** | 独立 `.dll/.so` 导出 `js_init_module_*` → 自定义 loader 或 `dlsym` 桥 |
| C 原生静态 | **Il2Cpp Player**（Editor 亦可链入 `quickjs.dll`） | `.c/.cpp` 编入 libil2cpp → 启动期 `js_init_module_*` |
| D 内置到 `quickjs.dll` | Editor | 与 Editor `quickjs` 同库编译 `js_init_module_*` |

换 **`quickjsVersionId`** 后：所有原生模块必须 **按新 pin 重编**。

---

## 4. Editor（形态 B / D）

### 4.1 布局

```text
<project>/zents-native-modules/
  quickjs-2026-06-04/
    win32-x64/myaddon.dll
    darwin-universal/myaddon.dylib
```

模块 **须** 动态链接到 **同版本** Editor **`quickjs.dll`**（符号与调用约定一致）。

### 4.2 PluginImporter

与 ZLua 第三方模块相同：**Player 平台 `enabled: 0`**。
模块由 QuickJS loader / 显式 `LoadLibrary` + 获取 `js_init_module_*` 加载；**避免** Unity 自动 `LoadLibrary` 后再由引擎二次加载导致未定义行为。

### 4.3 注册时机

在 **`JsMonoAppDomain.Initialize`** 完成且 **标准 ZenTS _globals 已注册** 之后：

1. 解析当前 **`quickjsVersionId`** 与 OS，定位 native 模块目录；
2. 对每个模块：`GetProcAddress("js_init_module_<name>")` 或静态已知符号；
3. 将 **`module_loader`** 链入：`csharp:` 已由 ZenTS 处理；若 specifier 匹配原生模块则调用对应 `js_init_module_*`；否则 **fallback** 到托管 `moduleLoader`；
4. **禁止** fallback 静默吞掉 loader 错误。

### 4.4 链接约束

- 插件 **禁止** 静态嵌入第二份 QuickJS VM。
- 导出符号命名须与 QuickJS 模块惯例一致，或经 ZenTS 注册表映射 specifier → init 函数。

---

## 5. Il2Cpp Player（形态 C）

### 5.1 纳入链接

任选其一（工程自管构建）：

- 将插件 `.c/.cpp` 编入与 **`libil2cpp/quickjs`** 相同的编译单元列表（经 Install 后的 Local 树）；或
- 提供平台静态库（`.a` / `.lib`），在链接阶段并入 `GameAssembly` / `libil2cpp`。

须与 Install 选定的 **`quickjsVersionId`** 及 **`ZENTS_QUICKJS`** Define 一致。

### 5.2 注册时机

在创建主 **`JSContext`** 之后、执行业务脚本 **之前**（概念上紧接 `ZenTSLib::RegisterGlobals` 之后）：

```cpp
JSModuleDef *m = js_init_module_myaddon(ctx, "myaddon");
// 若需立即可 import：确保 module 已 link 到 import graph
```

或通过 **`JS_SetModuleLoaderFunc`** 的 **`module_loader`** 在首次 `import` 时 lazy init。

### 5.3 禁止

- 以 Player 运行时 **`dlopen` + `.so`** 作为 **主路径**（尤其 iOS、WebGL）。
- 假设未重新 **Install / 出包** 即可拾取新的 `js_init_module_*` 符号。

---

## 6. 项目侧 Bootstrap（推荐）

```text
NativeModuleBootstrap.Install(versionId, moduleTable)
  Editor  → 解析目录、注册 loader 链、可选预 init
  Player  → 空操作（注册已在 native 完成）或断言 module namespace
```

生命周期：`JsAppDomain.Initialize(moduleLoader)` → **`NativeModuleBootstrap`** → 业务 `import`。

纯 JS 模块 **一律** 走同一 **`moduleLoader`**，保证 Editor/Player 路径一致。

---

## 7. 产品化钩子（预留，非当前实现）

| 侧 | 建议 |
|----|------|
| Mono | Settings 列表：`nativeModuleSearchPaths`；Initialize 后合并 loader |
| Il2Cpp | `RegisterGlobals` 之后弱符号或生成表（如 `ZenTSNativeModules.inc`）调用各 `js_init_module_*` |
| Settings | 与 `jsAliasXmlPaths` 类似的路径约定字段（可选） |

**仍不** 默认 vendoring 任何第三方库源码或二进制。

---

## 8. 库对照（信息性）

| 类型 | import specifier | init 符号 | 备注 |
|------|------------------|-----------|------|
| 自定义 addon | `"myaddon"` | `js_init_module_myaddon` | 须与模块名一致 |
| quickjs-libc std | `"std"` | `js_init_module_std` | 可选启用 |
| quickjs-libc os | `"os"` | `js_init_module_os` | 可选；沙箱须评估 |
| 纯 JS 库 | 任意 | — | 形态 A，`moduleLoader` |

---

## 9. 验收

- [ ] 当前 **`quickjsVersionId`** 下 Editor `import` 目标 native 模块成功
- [ ] 至少一款 Player 目标同脚本成功
- [ ] PluginImporter Player 均为 disabled（形态 B）
- [ ] 切换 `quickjsVersionId` 后旧二进制不可用且有 **明确** 失败，而非静默 ABI 错乱
- [ ] 插件未静态嵌入第二份 QuickJS
- [ ] 原生模块 **不** 绕过 [callback gate](./03-MONO-CALLBACK-GATE.md) 暴露新 JS→C# 入口（若模块内再调 C#，仍须 ZenTS 绑定层）

---

## 10. 相关文档

- [01-QUICKJS.md](./01-QUICKJS.md) — 源文件白名单与 Editor DLL
- [01-HOST-API.md](../01-HOST-API.md) — ES **`moduleLoader`** 与 **`csharp:`** 保留前缀
- [02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §2.11 — `csharp:` 类型模块
- [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) — 版本 pin 与 Install
- [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md) — JS→C# 回调边界
