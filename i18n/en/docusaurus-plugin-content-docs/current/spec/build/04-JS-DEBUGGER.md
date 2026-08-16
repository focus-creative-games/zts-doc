---
sidebar_position: 4
title: "JS 调试器"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`build\04-JS-DEBUGGER.md`）
:::


# 构建 — Editor Mono：JavaScript 调试器 Host Hook

> 约定 ZTS **Editor（`ZTS.Mono`）** 如何暴露 **可插拔的 JS 调试 host hook**，使外部 IDE / 调试前端可对运行中的 **QuickJS** 脚本断点调试。
> **不是** EmmyLua / Lua 调试协议；**不**随包绑定某一专有 IDE。
> **不**改变 JavaScript 可见互操作语义；**不**覆盖 Il2Cpp Player。
> 异常边界见 [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md)；宿主入口见 [01-HOST-API.md](../01-HOST-API.md)；多版本见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md)。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| 宿主 | Unity **Editor** + `ZTS.Mono`，域内 **单主 `JSContext`** |
| 模型 | **Host Hook 契约**：ZTS 在固定生命周期点调用 `IZtsJsDebuggerHost`；具体 DAP / CDP / 自研协议由 **可选扩展包** 实现 |
| 开关 | Project Settings（`ZTS.Settings`）显式开启；**默认关闭** |
| 覆盖范围 | 业务 ES module（含 TS emit + source map → `TsProject/src`）、`CSharp` 绑定脚本、`zts` 标准库（在 hook 安装之后加载的代码） |
| QuickJS 能力 | 基于 **`JS_SetDebuggerHandler`** / 引擎调试 API（或等价 patch）实现断点、单步、栈；**不** fork QuickJS |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| Il2Cpp Player / 真机调试 | **本规范不覆盖**（后续若做须另文） |
| WebGL Editor 模拟 | **不支持** attach 模型 |
| 随包内置完整 VS Code 扩展 | **不做**；仅规范 Unity 侧 hook |
| C#↔JS 混合调用栈美化 | **不做**（调试器呈现 JS 栈；C# 帧可选标注为 native/internal） |
| 业务脚本手写调试器 bootstrap | **非必需**；由宿主统一安装 |
| 破坏 callback gate | 调试 hook **不得** 将 JS→C# 回调注册为裸 managed 函数（见 [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md)） |

---

## 2. 架构

```text
IDE / 调试前端（可选扩展包：DAP Adapter 等）
    ↕ 调试协议（实现细节在扩展包，不在本 spec）
IZtsJsDebuggerHost（Editor 可选实现）
    ↕ JS_SetDebuggerHandler / 断点 / 单步
QuickJS JSContext（Editor Mono，单主上下文）
    ↕ ZTS 绑定层（须经 callback gate）
业务脚本 + CSharp + zts
```

| 层 | 职责 |
|----|------|
| **Settings** | `enableJsDebugger`、`debuggerHostType`、端口 / 路径等 |
| **`TsMonoAppDomain.Initialize`** | 完成 QuickJS + ZTS 核心初始化后，若开启则 `JsDebuggerBootstrap.Start` |
| **`JsDebuggerBootstrap`** | 反射创建 `IZtsJsDebuggerHost` 实现；调用 `Install(ctx, rt)` |
| **扩展包** | 实现 `IZtsJsDebuggerHost`；注册 TCP / Unix socket / stdio 等传输 |

---

## 3. Host Hook 契约（规范性）

### 3.1 接口

```csharp
namespace ZTS.Editor.Diagnostics
{
    /// <summary>
    /// Editor 可选 JS 调试宿主。实现位于扩展程序集，由 Settings 指定类型全名。
    /// </summary>
    public interface IZtsJsDebuggerHost
    {
        /// <summary>在任意 gated JS→C# 回调注册之前或之后均可，但不得早于 JSContext 创建。</summary>
        void Install(JSRuntimeHandle rt, JSContextHandle ctx, JsDebuggerHostContext hostContext);

        /// <summary>TsAppDomain.Reset 触发的 teardown 之前调用。</summary>
        void Uninstall();

        /// <summary>每 Editor 帧可选 tick（处理 pending 断点消息等）。</summary>
        void Tick();
    }

    public sealed class JsDebuggerHostContext
    {
        public string ProjectRoot { get; init; }
        public IReadOnlyList<string> SourceSearchPaths { get; init; }
        public int PreferredPort { get; init; }
        public bool WaitForDebugger { get; init; }
    }
}
```

`JSRuntimeHandle` / `JSContextHandle` 为 **opaque IntPtr** 包装，避免 Editor 程序集直接依赖 native 头文件。

### 3.2 生命周期（硬顺序）

在 `TsMonoAppDomain.Initialize` 中，于下列步骤 **全部完成之后** 再 `Install`：

1. 创建 `JSRuntime` + 主 `JSContext`
2. `JsCallbackGate.EnsureInitialized()`
3. 注册 `zts` 标准库与 `CSharp` 根对象
4. 安装 ES **`moduleLoader`**（`JS_SetModuleLoaderFunc`）
5. `ObjectRegistry` / `TypeRegistry` 就绪

**不得** 在 `Install` 中替换已注册的 gated 回调为裸函数指针。

**Reset 路径：** `Uninstall` → 域 teardown → 新域 `Initialize` → 若仍开启则再次 `Install`。须 **幂等**。

### 3.3 QuickJS 侧义务（实现层，行为约束）

| 项 | 约定 |
|----|------|
| 断点 | 经 QuickJS 调试 API 设置；命中时 **暂停 JS 执行**，不自动跨进 gated C# 回调内部 |
| 单步 | step into/over/out 在 **JS 帧** 生效；步入 C# 边界时行为由扩展定义，但 **不得** 在 C# 内触发 `JS_Throw` 未包装路径 |
| 源码映射 | `hostContext.SourceSearchPaths` 须包含 `moduleLoader` 可解析的 logical path；扩展包负责 URL ↔ 磁盘路径 |
| `eval` / `Function` | 动态代码须可映射到 `<eval>` / `<anonymous>` 等占位源（扩展包展示策略） |

### 3.4 Settings 字段

在 `ZTS.Settings`（`ProjectSettings/ZTS.asset`）：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `enableJsDebugger` | `bool` | **`false`** | 为 true 时在 `Initialize` 末尾启动 |
| `debuggerHostTypeName` | `string` | `""` | 实现 `IZtsJsDebuggerHost` 的类型全名（含程序集） |
| `debuggerPort` | `int` | **`9230`** | 建议端口；扩展包可忽略 |
| `debuggerWaitForAttach` | `bool` | **`false`** | 为 true 时 `Install` 后阻塞直到前端 attach（**须**有超时或 UI 取消，避免死锁 Unity 主线程） |
| `debuggerSourcePaths` | `string[]` | `Assets/` | 额外源码搜索路径 |

UI 须标明：**仅 Editor Mono**；`WaitForAttach` 会阻塞主线程。

### 3.5 缺失实现

`enableJsDebugger == true` 但 `debuggerHostTypeName` 无效或反射失败：

- **`Debug.LogError`** 说明期望类型与程序集引用
- **跳过调试器，不抛异常**（不中断 `Initialize`）

---

## 4. 与 moduleLoader / ES Module 的协作

| 场景 | 约定 |
|------|------|
| 静态 `import` | 扩展包通过 `moduleLoader` 提供的 **virtual URL** 或 **canonical specifier** 映射断点 |
| **TypeScript** | source map 映射到 `TsProject/src/**`；canonical specifier **不含** `.js`（[14-TYPESCRIPT.md](../14-TYPESCRIPT.md)） |
| **`csharp:` 类型模块** | **无** JS 源码；断点落在 **使用** 该 import 的业务模块，不在合成模块上 |
| `GetFunction` 模块 | 与 `jsModule` **canonical** specifier 一致（[01-HOST-API.md](../01-HOST-API.md) §1.3） |
| Source map | TS 工作流 **必须** emit `.js.map`；扩展包按 map 把断点落到 `.ts` |

宿主 **`moduleLoader` 失败** 时调试器仅看到 loader 抛错位置，不改变 loader 语义。

---

## 5. PluginImporter 与原生依赖

调试 **transport**（如 WebSocket 库）若含 native 插件：

| 规则 | 说明 |
|------|------|
| Editor only | Player 平台 **enabled: 0** |
| 不与 `quickjs.dll` 双载 | 扩展包 native 模块 **不得** 静态嵌入第二份 QuickJS |

ZTS 核心包 **不** 随包附带具体调试 frontend 二进制。

---

## 6. 推荐扩展包结构（信息性）

```
Packages/com.code-philosophy.zts.debugger.dap/   # 示例，非本仓库必需
├── Editor/
│   └── DapJsDebuggerHost.cs    # IZtsJsDebuggerHost
└── README.md                   # VS Code launch.json 示例
```

扩展包 **须** 引用 `ZTS.Mono` / `ZTS.Editor` 中的 hook 接口，**不得** 修改 `spec/**` 语义。

---

## 7. 启动流程（伪码）

```csharp
void TsMonoAppDomain.Initialize(...)
{
    // ... core init through moduleLoader ...
    if (ZtsSettings.Instance.enableJsDebugger)
        JsDebuggerBootstrap.TryStart(_rt, _ctx);
}

static class JsDebuggerBootstrap
{
    public static void TryStart(IntPtr rt, IntPtr ctx)
    {
        var typeName = ZtsSettings.Instance.debuggerHostTypeName;
        if (string.IsNullOrEmpty(typeName)) { LogError(...); return; }
        var host = (IZtsJsDebuggerHost)Activator.CreateInstance(Type.GetType(typeName));
        host.Install(rt, ctx, BuildContext());
        _active = host;
    }
}
```

`TsFramePump` 每帧调用 `_active?.Tick()`（若存在）。

---

## 8. 验收要点

- [ ] 默认关闭时不影响 Player / Editor 启动时间
- [ ] 开启 + 有效 host：可在 IDE 设断点命中 ES module
- [ ] 回调错误路径仍走 gate；调试器不引入新崩溃
- [ ] `Reset` 后调试器 reconnect 或干净 `Uninstall`
- [ ] `WaitForAttach` 有超时 / 取消，不永久冻结 Editor

---

## 9. 相关文档

| 文档 | 关系 |
|------|------|
| [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md) | 回调注册约束 |
| [01-HOST-API.md](../01-HOST-API.md) | `moduleLoader` / `GetFunction` / canonical specifier |
| [14-TYPESCRIPT.md](../14-TYPESCRIPT.md) | `TsProject`、source map、emit |
| [01-QUICKJS.md](./01-QUICKJS.md) | Editor `quickjs.dll` |
| [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) | Settings / Install |
