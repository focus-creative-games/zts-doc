---
sidebar_position: 2
title: TsAppDomain
description: "C# 宿主门面速查。"
---

# TsAppDomain

`TsAppDomain` 是 ZTS **唯一推荐的公开宿主入口**：初始化 / 整域重置 QuickJS，以及用 **`GetFunction`** 从 ES 模块按 **named export** 取得 JS callable 对应的 Delegate。宿主面 **不** 暴露 `Shutdown`；清空脚本世界只走 `Reset`。

权威细则：[01-HOST-API](/docs/spec/01-HOST-API/)、[10-LIFETIME](/docs/spec/10-LIFETIME/) §7。

## API

```csharp
namespace ZTS
{
    public static class TsAppDomain
    {
        public static void Initialize(Func<string, object> moduleLoader);
        public static void Reset(Func<string, object> moduleLoader);

        public static T GetFunction<T>(string jsModule, string jsExportName)
            where T : MulticastDelegate;
    }
}
```

`TsAppDomain` 在 `ZTS.Common`；Common **不** 引用 Mono/Il2Cpp。首次 `Initialize` / `GetFunction` 时按环境 **反射创建** 后端嵌套类型 `Runtime : ITsRuntime`：

| 环境 | 后端 | 程序集 |
|------|------|--------|
| Editor | `TsMonoAppDomain` | `ZTS.Mono` |
| Player | `TsIl2CppAppDomain` | `ZTS.Il2Cpp` |

**不** 使用 `RuntimeInitializeOnLoadMethod` / `SetRuntime` 做隐式注册。

---

### `Initialize(moduleLoader)`

| 参数 | 说明 |
|------|------|
| `moduleLoader` | `Func<string, object>`，按 **canonical** ES module specifier 返回源码（通常为 `string`） |

仅首次（或进程内尚无主 `JSContext`）创建运行时并安装 loader。**已初始化**时再次调用 → **抛异常**（须 `Reset`；**不**再支持「只换 loader」）。

初始化完成后注册 `TsFramePump`（见下）。

---

### `Reset(moduleLoader)`

热更或清空脚本世界：拆掉当前域内主 `JSContext` / `JSRuntime`，再以给定 loader 重建。

| 行为 | 说明 |
|------|------|
| 调用当下 | **仅预约**：保存 loader；多次预约以最后一次为准。**不**立刻 teardown |
| 真正执行 | 本帧 **EndOfFrame**（`TsFramePump` / `WaitForEndOfFrame`）：排空 pending ref → 关闭 Registry / 模块缓存 → 释放 JS 运行时 → 按 Initialize 路径重建并安装 loader |
| 旧委托 | EndOfFrame 应用之后，对旧 `GetFunction` 委托的调用 → 抛 C# 异常；宿主须重新 `GetFunction` 并丢弃字段缓存 |
| Il2Cpp | 进程级 Bridge / XML 表 / InternalCall **保留**，仅重建 state 级资源 |

允许在 C#↔JS 调用中途调用 `Reset`（只排队）；勿在同一帧 EndOfFrame 之后仍使用旧委托。

---

### `GetFunction<T>(jsModule, jsExportName)`

按模块 specifier 与 **命名导出** 解析 JS callable，绑定为委托类型 `T` 并返回。这是 C#→JS 的 **唯一正式入口**。

```csharp
var add = TsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = TsAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);
```

| 规则 | 说明 |
|------|------|
| `T` | 具体 `MulticastDelegate`（如 `Action<>` / `Func<>`） |
| `jsModule` | 非空 **canonical** specifier（**不含** `.js` / `.ts`；**不要**用 `csharp:` 类型模块） |
| `jsExportName` | 模块 **命名导出** identifier（**不**自动映射 `export default`） |
| 缓存 | API **不保证**跨调用复用同一实例；热路径由调用方存字段 / 局部变量。`Reset` 生效后旧委托一律作废，须重新绑定 |
| 时机 | 须在 `Initialize` **之后**；**勿**放在 static 字段初始化器中 |
| Marshal | `Invoke` 时遵循 [Marshal 概览](/docs/concepts/marshal-overview/)；可用 `[TsMarshalAs]` |

模块加载失败、导出名不存在、非 callable、或无法绑定为 `T` → 抛 C# 异常。

---

## 模块加载器

`moduleLoader(moduleSpecifier)` 由宿主提供。约定摘要：

| 项 | 约定 |
|----|------|
| Specifier | 与 `GetFunction` 的 `jsModule` **一致**；canonical **不含** `.js` / `.mjs` / `.ts` |
| 语法 | **ES module**（`export` / `import`）；CommonJS **不在** v1 范围 |
| `csharp:` | ZTS **在** 宿主 loader **之前** 拦截合成 CLR 类型模块；**禁止** 把 `csharp:` 传给业务 loader |
| 失败 | 应抛明确异常，避免 silent 空模块 |

**解析顺序（概念）：** `csharp:` → 已注册第三方原生 C 模块 → 宿主 `moduleLoader`。详见 [01-HOST-API](/docs/spec/01-HOST-API/) §1.3、[14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/) §4。

---

## `TsFramePump`

`Initialize` 注册 `TsFramePump`：

| 时机 | 职责 |
|------|------|
| `LateUpdate` | `ProcessPendingRefReleases`（排空 pending ref） |
| `WaitForEndOfFrame` | 执行已预约的 `Reset` |

一般 **无需** 手动驱动帧泵。详见 [10-LIFETIME](/docs/spec/10-LIFETIME/)。

---

## 初始化流程（概念）

```text
sequenceDiagram
    participant App as 游戏启动
    participant TAD as TsAppDomain
    participant BE as 后端 Mono / Il2Cpp
    participant Q as JSRuntime + JSContext

    App->>TAD: Initialize(moduleLoader)
    TAD->>BE: 解析 ZTS.Mono 或 ZTS.Il2Cpp
    BE->>Q: 创建运行时、注册 CSharp / zts
    BE->>BE: 安装 moduleLoader、TsFramePump
    TAD-->>App: 就绪，可 GetFunction / csharp: 访问
    Note over App,Q: 热更清空时 App 调 Reset；EndOfFrame 才 teardown + 重建
```

---

## 生命周期要点

1. **单主上下文**：域内一个主 `JSContext`；公开 API **无** `Shutdown`。
2. **缓存委托**：热路径自行保存 `Action` / `Func`；`Reset` 后 **全部作废**。
3. **异常边界**：JS `throw` → C# 异常；C# 异常 → JS `Error('zts: …')`（见 [01-HOST-API](/docs/spec/01-HOST-API/) §6）。

---

## 常见错误

| 现象 | 处理 |
|------|------|
| 未配置 loader / 未 Initialize | 先 `Initialize(loader)` |
| 再次 `Initialize` 抛异常 | 已有主上下文；改用 `Reset(loader)` |
| GetFunction 失败 | 检查 canonical 名、named export、是否误用 `csharp:` |
| Reset 后旧委托抛异常 | 丢弃缓存，重新 `GetFunction` |
| Marshal / 绑定失败 | 对照 [Marshal 概览](/docs/concepts/marshal-overview/) 与 `T` 签名 |

## 相关文档

- [C# 调用 JS](/docs/guides/csharp-calling-js/)
- [Function 与 Delegate](/docs/guides/functions/)
- [TypeScript / canonical specifier](/docs/spec/14-TYPESCRIPT/)
- [规范总览](/docs/spec/00-OVERVIEW/)
