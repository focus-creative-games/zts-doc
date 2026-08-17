:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`01-HOST-API.md`）
:::

﻿---
sidebar_position: 2
title: "宿主 API"
---

# 01 — 宿主 API

> `JsAppDomain`（含 **`GetFunction`**）、**`[JsMarshalAs]`**、**`[JsAlias]`**。
> C#→JS / JS→C# Marshal 细节见 [marshal/](/docs/spec/marshal/)。

---

## 1. `JsAppDomain`

### 1.1 职责

`ZenTS.JsAppDomain` 是宿主唯一推荐的初始化门面。Common **不** 引用 Mono/Il2Cpp；在 `Initialize` / `GetFunction` 时按环境 **反射创建** 后端嵌套类型 `Runtime : IJsRuntime`：

| 环境 | 后端宿主类型 | 程序集 | 创建方式 |
|------|--------------|--------|----------|
| Editor | `JsMonoAppDomain` | `ZenTS.Mono` | `Activator.CreateInstance(…+Runtime)` |
| Player | `JsIl2CppAppDomain` | `ZenTS.Il2Cpp` | 同上（`#if !UNITY_EDITOR` 分支） |

```csharp
public interface IJsRuntime
{
    void Initialize(Func<string, object> moduleLoader);
    void Reset(Func<string, object> moduleLoader);
    void ProcessPendingRefReleases();
    Delegate GetFunction(Type delegateType, string jsModule, string jsExportName);
}

public static class JsAppDomain
{
    public static void Initialize(Func<string, object> moduleLoader);
    public static void Reset(Func<string, object> moduleLoader);

    public static T GetFunction<T>(string jsModule, string jsExportName)
        where T : MulticastDelegate;

    internal static void ProcessPendingRefReleases(); // 由 JsFramePump 驱动
}
```

**不** 使用 `RuntimeInitializeOnLoadMethod` / `SetRuntime` 做隐式注册；首次 `Initialize`（或 `GetFunction`）时解析后端。
宿主面 **不** 暴露 `Shutdown`；整域拆掉再重建只走 `Reset`。

### 1.2 整域重置（`Reset`）

用于热更或清空脚本世界：拆掉当前域内主 `JSContext` / `JSRuntime`，再以给定 loader 重建。

| API | 行为 |
|-----|------|
| `Reset(loader)` | **仅预约**：保存 loader，在本帧 **EndOfFrame**（`JsFramePump` / `WaitForEndOfFrame`）才真正执行 teardown + 重建。多次预约以最后一次 loader 为准。真正执行时：排空 pending ref → 关闭 Registry / 模块缓存 → 释放 JS 运行时 → 新建 `JSRuntime`+`JSContext` 并安装 `loader`。Il2Cpp 进程级 Bridge / XML 表 / InternalCall **保留**。 |
| `Initialize(loader)` | 仅首次（或进程内尚无主上下文）创建 JS 运行时并安装 loader。**已初始化**时再次调用 → **抛异常**（须 `Reset`；**不**再支持「只换 loader」）。 |

**契约：**

1. `Reset` **调用当下**不拆上下文；**EndOfFrame 应用之后**，对**旧** `GetFunction` 委托的调用 → 抛 C# 异常。
2. 旧委托 **一律作废**；宿主须在 Reset 生效后重新 `GetFunction` 并丢弃字段里缓存的 `Action` / `Func`。
3. 因真正 teardown 在 EndOfFrame，允许在 C#↔JS 调用中途调用 `Reset`（只排队）；勿在同一帧 EndOfFrame 之后仍使用旧委托。

详见 `10-LIFETIME.md` §7。

### 1.3 模块加载器

`moduleLoader(moduleSpecifier)` 由宿主提供，返回 ES module 源码（通常为 `string`）。native 通过自定义 module resolver 与 QuickJS module 系统集成。

**约定：**

- 模块 specifier 与 `GetFunction` 的 `jsModule` 字符串一致。**canonical 不含** `.js` / `.ts`（如 `"main"`、`"game/logic"`）；完整规则见 [14-TYPESCRIPT.md](./14-TYPESCRIPT.md) §4
- loader 失败应抛出明确异常，避免 silent 空模块
- 模块须为 **ES module** 语法（`export` / `import`）；CommonJS `module.exports` **不在** v1 规范范围
- **保留前缀 `csharp:`**：ZenTS 在宿主 `moduleLoader` **之前** 拦截，合成 CLR 类型模块（[02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11）。**禁止** 把 `csharp:` specifier 传给业务 loader。`module_normalize` 对 `csharp:` 开头的名字 **原样返回**（不得按相对路径改写）
- 进入 `moduleLoader` / 模块缓存键前，将非 `csharp:` specifier **规范为 canonical**（去掉尾缀 `.js` / `.mjs` / `.ts`）。磁盘上的 emit 文件可以是 `out/game/logic.js`，逻辑名仍是 `game/logic`

**Loader 解析顺序（概念）：**

1. specifier 以 `csharp:` 开头 → ZenTS 合成类型模块；程序集 miss 按类型系统规则 throw
2. 已注册的第三方原生 C 模块（[build/05-NATIVE-MODULES.md](./build/05-NATIVE-MODULES.md)）
3. 宿主 `moduleLoader(specifier)` → ES 源码

**`GetFunction` 与模块 namespace：**

`GetFunction<T>("app", "onTick")` 解析为：加载 specifier `"app"` 的模块命名空间，读取 **命名导出** `onTick`（等价 `import { onTick } from "app"` 的绑定）。**不**支持默认导出自动映射；若仅 `export default`，宿主须用 wrapper 模块再导出命名符号，或扩展 loader（超出 v1 规范）。

`jsModule` **不应** 使用 `csharp:` 类型模块：其 named export 是类型对象，一般非业务 callable；误用按 §2.4「非 callable」抛 C# 异常。

### 1.4 帧泵

`JsAppDomain.Initialize` 注册 `JsFramePump`：`LateUpdate` 排空 pending ref；`WaitForEndOfFrame` 执行已预约的 `Reset`。详见 `10-LIFETIME.md`。

---

## 2. `GetFunction` — C# 调用 JavaScript

C#→JS 的 **唯一正式入口**：按 ES 模块 specifier 与导出名取得绑定好的 **Delegate**，再由调用方 `Invoke`（或直接调用）。

### 2.1 签名

```csharp
public static T GetFunction<T>(string jsModule, string jsExportName)
    where T : MulticastDelegate;
```

| 参数 | 说明 |
|------|------|
| `jsModule` | 非空 **canonical** specifier（**不含** `.js` / `.ts`；**不要**用 `csharp:` 类型模块） |
| `jsExportName` | 非空；模块 **命名导出** identifier |
| `T` | 具体委托类型（如 `Action`、`Action<float>`、`Func<int,int,int>`） |

### 2.2 行为

1. 按 `jsModule` 加载（或命中已加载）模块 namespace
2. 取 `module[jsExportName]`，须为 JS **callable**（`function` 或 exotic 可调对象）
3. 按 `T` 的签名将 callable **Marshal** 为 closed delegate（规则同 `spec/marshal/09-FUNCTION.md`）
4. 返回该 `T` 实例

**缓存：** API **不保证**跨调用复用同一 delegate 实例；热路径由调用方自行保存（字段 / 局部变量）。须在 `Initialize` **之后**再调用（例如 `Awake`）；**勿**放在与 `RuntimeInitializeOnLoadMethod` 同类型的 static 字段初始化器中。`Reset` 生效后旧委托一律作废，须重新 `GetFunction`。

### 2.3 示例

```csharp
// 一次性 / 启动期取得
var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = JsAppDomain.GetFunction<Action<float>>("game", "OnTick");
onTick(0.016f);
```

```javascript
// 模块 canonical 名：app（不含 .js）
export function add(a, b) {
    return a + b;
}
```

```javascript
// 模块 canonical 名：game
export function OnTick(dt) {
    // ...
}
```

### 2.4 错误

| 条件 | 行为 |
|------|------|
| 未 `Initialize` / loader 未配置 | 抛 C# 异常 |
| 模块加载失败 / 导出名不存在 / 非 callable | 抛 C# 异常（含可诊断信息） |
| `T` 无法从该 callable 绑定（签名不兼容等） | 抛 C# 异常 |

### 2.5 调用与 Marshal

对返回的 delegate 执行 `Invoke` 时：

- 参数 / 返回值 Marshal 与普通 **C#→JS（delegate bridge）** 相同，见 `spec/marshal/01-OVERVIEW.md`
- **`ref` / `in` / `out` 默认 Push OpaqueValue**（`spec/marshal/04-OPAQUE.md`）
- C# 传入 `null` 引用 → JS `null`；可选参数缺失在 JS 侧为 `undefined`（marshal 分册详述）

### 2.6 流程（概念）

```
GetFunction<T>(module, exportName)
  → import / 取模块 namespace
  → 取 JS callable
  → Marshal 为 T
  → 返回 T

此后：T.Invoke(...)
  → marshal 参数（含 ref → OpaqueValue）
  → JS_Call
  → marshal 返回值 / ref 写回
  → 异常边界转换（§6）
```

Il2Cpp C# 层初始化仍为薄壳（与 `GetFunction` 无关）：

```csharp
public static class JsIl2CppAppDomain
{
    [MethodImpl(MethodImplOptions.InternalCall)]
    private static extern void InitializeInternal(Func<string, object> moduleLoader);

    public static void Initialize(Func<string, object> moduleLoader)
        => InitializeInternal(moduleLoader);
}
```

---

## 3. `[JsMarshalAs]` — Marshal 标注

### 3.1 作用范围

| 可标注位置 | 说明 |
|------------|------|
| **参数** | 控制 JS↔C# 该形参的 Push/Pop |
| **返回值** | 控制 C#→JS 返回 Push |
| **字段 / 属性** | 控制成员读写时的 marshal（codegen 消费） |

**禁止**标注在 **方法** 上（绑定期 `JsMarshalAsConfigurationException`）。

完整选项见 `spec/marshal/02-MARSHAL-AS.md`。

### 3.2 常用选项（概要）

| `JsMarshalType` | 用途 |
|-----------------|------|
| `Default` | 按类型默认规则 |
| `OpaqueValue` | C#→JS 强制 opaque 句柄（by-val 引用类型 / struct） |
| `Table` / `UnpackedValues` | 仅 **struct / closed 泛型 struct**；`Table` 另允许 **`Nullable<struct>`**（须 `Members`） |

**默认规则摘要：**

- C#→JS **`ref`/`in`/`out`** → **OpaqueValue**（无需再标）
- by-val 基元 / enum → JS boolean / number / string（**整数**用 `number`；**禁止** bigint 通道，见 [00-OVERVIEW.md](./00-OVERVIEW.md) §1.3）
- class → ByObj exotic object；struct → ByVal 或 Handle（见 struct 分册）
- **`params T[]`** → 同 szarray **单参数槽**（Array / exotic / `null`）；**不**支持尾部多槽收集

### 3.3 校验时机

- **Mono Attribute：** 非法组合 → **错误日志 + 回退 `Default`**，不抛绑失败。
- **Il2Cpp Generate / MarshalAs XML：** 配置错误可 **硬失败**。

---

## 4. `[JsAlias]` — 方法 JS 别名

```csharp
[JsAlias("run_i32")]
public void Run(int value) { ... }

[JsAlias("Foo")]   // 允许与已有方法名 / 其它别名重复
public void Bar(string s) { ... }
```

- 定义于 `ZenTS.Common`
- **等价于**用该字符串作为该方法的 **唯一最终 JS 名**（**替换**默认名 `MethodInfo.Name`，不再双挂）
- 预编译 DLL 可用 **独立** XML（Settings **`jsAliasXmlPaths`**，根元素 `JsAlias`）；**不得**写进 MarshalAs XML
- **允许**与其它别名或已有方法名重复；重复时该最终名下多候选，调用走 **重载分派**（见 `04-METHOD-OVERLOAD.md` §5）
- 若某最终名下仅此一候选（例如独立的 `run_i32`），则为 **direct function**

完整规则见 `04-METHOD-OVERLOAD.md` §3、§5。

---

## 5. JS→C#：无需 Callback 标记

JS 调用 C# 成员时，native 在 **EnsureBinding** 阶段为每个 public 成员生成桥接函数并写入三表。**不需要**也 **不提供** 业务侧 `[MonoPInvokeCallback]` 等手动 Export 标记（codegen 自动处理）。

每种 **ReducedType（Il2Cpp）** 或 **完整签名（Mono Emit）** 对应唯一桥接入口。

---

## 6. 异常边界

### 6.1 C# 调 JS

| 方向 | 行为 |
|------|------|
| JS `throw` | 捕获为 C# 异常（`JsScriptException` 或包装类型）；**不**泄漏未处理 native 异常到托管栈外 |
| C# 异常传入 native | 在边界转换为 JS throw 或记录后 rethrow（实现统一） |

脚本 **不应** 依赖 try/catch 内捕获 C# 异常的具体类型字符串；仅保证「失败可检测」。

### 6.2 JS 调 C#

| 方向 | 行为 |
|------|------|
| C# 抛异常 | 转换为 **`throw new Error('zents: …')`** 等价消息；Mono / Il2Cpp 文案一致或等价 |
| JS 侧 | 使用 `try/catch` 捕获 |

### 6.3 Opaque 与边界

Opaque handle **仅在** 产生它的那次 C#→JS 调用返回前有效；跨 `try/catch` 保存后再用 → throw。见 `spec/marshal/04-OPAQUE.md`、`10-LIFETIME.md`。

---

## 7. Codegen 约束（摘要）

| 项 | 约束 |
|----|------|
| `[JsAlias]` | 允许与默认名 / 其它别名重复；按最终名分组（见 overload §5） |
| `[JsMarshalAs]` | 禁止 method 级；非法 `Members` → bind 失败 |
| Mono Emit | 无法 Emit 的签名 **必须显式失败**，禁止 silent `Method.Invoke` 热路径 |
| Il2Cpp stub | 未覆盖签名 → 构建期或首次绑定失败（MethodBridge 等，见 `impl/codegen/`） |

C#→JS **不**依赖 IL weave / 专用 stub：经 `GetFunction` → Delegate 桥完成。

---

## 8. 相关文档

| 文档 | 内容 |
|------|------|
| [00-OVERVIEW.md](./00-OVERVIEW.md) | 双运行时、初始化 |
| `02-TYPE-SYSTEM.md` | `CSharp` 与 **`csharp:` import** |
| `14-TYPESCRIPT.md` | TS 工程、canonical specifier、声明生成 |
| `04-METHOD-OVERLOAD.md` | dispatch、`register_method` |
| `spec/marshal/01-OVERVIEW.md` | Marshal 总览 |
| `spec/marshal/09-FUNCTION.md` | Delegate ↔ JS function |
| `10-LIFETIME.md` | GC、单 JSContext |
