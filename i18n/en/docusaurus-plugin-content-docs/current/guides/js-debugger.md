---
sidebar_position: 23
title: JS 调试器
description: Editor Mono 下可插拔 JS Debugger Host（断点调试约定）。
---

# JS 调试器

在 **Unity Editor（`ZTS.Mono`）** 里通过可插拔的 **Debugger Host Hook**，对运行中的 QuickJS 业务脚本做断点调试。ZTS 核心包 **不** 绑定某一专有 IDE；具体 DAP / CDP 由 **可选扩展包** 实现。

:::info 范围
仅 **Editor Mono**。不覆盖 Il2Cpp Player / 真机 / WebGL。完整约定见 [规范 · JS 调试器](/docs/spec/build/04-JS-DEBUGGER/)。
:::

## 架构（概念）

```text
IDE / 调试前端（可选扩展包）
    ↕ 调试协议（扩展包实现）
IZtsJsDebuggerHost
    ↕ QuickJS 调试 API（断点 / 单步 / 栈）
JSContext（Editor 单主上下文）
    ↕ ZTS 绑定（须经 Mono callback gate）
业务 ESM + CSharp + zts
```

宿主在 `TsAppDomain.Initialize`（`TsMonoAppDomain`）完成 QuickJS、标准库、`moduleLoader` 之后，若 Settings 开启则 `JsDebuggerBootstrap` 反射创建 Host 并 `Install`。

## 快速启用

1. **Project Settings → ZTS**（`ProjectSettings/ZTS.asset`）

| 字段 | 默认 | 说明 |
|------|------|------|
| `enableJsDebugger` | **false** | 为 true 时在 Initialize 末尾启动 |
| `debuggerHostTypeName` | `""` | 实现 `IZtsJsDebuggerHost` 的类型全名（含程序集） |
| `debuggerPort` | **9230** | 建议端口；扩展包可忽略 |
| `debuggerWaitForAttach` | **false** | 为 true 会阻塞主线程直至 attach（**须**有超时/取消） |
| `debuggerSourcePaths` | `Assets/` 等 | 额外源码搜索路径 |

2. 安装并引用实现了 `IZtsJsDebuggerHost` 的扩展包；填好 `debuggerHostTypeName`
3. Unity **Play**（触发 `Initialize`）
4. 用扩展包文档中的 IDE 配置连接；在业务源码打断点

推荐：**先 Play 再 attach**；不要一上来就开 `WaitForAttach`。

## Host 契约（摘要）

```csharp
namespace ZTS.Editor.Diagnostics
{
    public interface IZtsJsDebuggerHost
    {
        void Install(JSRuntimeHandle rt, JSContextHandle ctx, JsDebuggerHostContext hostContext);
        void Uninstall();
        void Tick();
    }
}
```

| 规则 | 说明 |
|------|------|
| 安装时机 | 须在 JSContext、callback gate、`zts`/`CSharp`、`moduleLoader`、Registry **就绪之后** |
| Reset | `Uninstall` → teardown → 再 Initialize 时再次 `Install`（幂等） |
| 回调 | **不得** 把 gated JS→C# 回调换成裸 managed 函数指针 |
| 缺失实现 | `enableJsDebugger` 但类型无效 → `LogError` 并 **跳过**，不中断 Initialize |

## 与模块 / TypeScript 的协作

| 场景 | 约定 |
|------|------|
| 业务 ESM | 按 canonical specifier / virtual URL 映射断点 |
| TypeScript | emit **必须**带 `.js.map`；断点映射到 `TsProject/src/**` |
| `csharp:` | **无** JS 源码；断点打在 **使用** import 的业务模块 |
| `GetFunction` | 与 `jsModule` canonical 一致（不含 `.js`） |

详见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

## 推荐扩展包结构（信息性）

```
Packages/com.code-philosophy.zts.debugger.dap/   # 示例名，非本仓必需
├── Editor/
│   └── DapJsDebuggerHost.cs    # IZtsJsDebuggerHost
└── README.md                   # IDE launch 配置示例
```

扩展包若含 native transport：须 **Editor only**，且 **不得** 再静态嵌入第二份 QuickJS。

## 常见问题

| 现象 | 处理 |
|------|------|
| 调试器被跳过 | 检查 `enableJsDebugger`、`debuggerHostTypeName`、程序集引用 |
| IDE 连不上 | 是否已 Play；端口；扩展包传输方式 |
| 断点不生效 | source map；`debuggerSourcePaths`；canonical 与磁盘路径 |
| Play 后 Editor 假死 | 关掉 `debuggerWaitForAttach`，或先 attach 再 Play |
| Player / 真机 | 本功能不覆盖；见 [Editor 与 Player](/docs/guides/editor-vs-player/) |

## 学习路径

| | |
|---|---|
| **上一篇** | [构建](/docs/guides/build/) |
| **下一篇** | [排障](/docs/guides/troubleshooting/) |

## 相关文档

- [规范 · JS 调试器](/docs/spec/build/04-JS-DEBUGGER/)
- [Mono Callback Gate](/docs/spec/build/03-MONO-CALLBACK-GATE/)
- [安装](/docs/guides/install/)
- [Hello 互操作](/docs/guides/hello-interop/)
