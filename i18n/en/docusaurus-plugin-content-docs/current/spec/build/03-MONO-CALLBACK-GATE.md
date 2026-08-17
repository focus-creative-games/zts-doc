---
sidebar_position: 3
title: "Mono 回调 Gate"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`build\03-MONO-CALLBACK-GATE.md`）
:::


# 构建 — Editor Mono：`JS_Throw` 与 Native Callback Gate

> 解决 **Unity Editor（`ZenTS.Mono`）** 下，JS→C# 回调帧上执行 **`JS_Throw`** / 不安全堆栈抓取导致的崩溃。
> **仅 Editor Mono** 启用；Il2Cpp Player **不**使用本 gate。
> 引擎构建见 [01-QUICKJS.md](./01-QUICKJS.md)；异常语义见 [10-LIFETIME.md](../10-LIFETIME.md) §8。
> **不**修改 QuickJS 上游；**不**改变 `try/catch` 可见语义。

---

## 1. 问题

### 1.1 已观察到的现象（与 ZLua gate 同族）

| 现象 | 说明 |
|------|------|
| QuickJS + `JS_Throw` 穿过 Mono reverse-P/Invoke | Win64 上 SEH / 栈展开异常 → SIGSEGV 或 Editor 硬崩 |
| 回调内 `Debug.Log`（带托管堆栈） | 活跃 QuickJS 调用帧时抓堆栈可能 SIGSEGV；故有 **`JsPrintBuffer`** 延迟刷出（实现层） |
| 团结等：回调内 **`throw`** | 外层 QuickJS 调用仍活跃时托管异常 first-pass 可能 SIGSEGV |

统一协议：**托管从不直接 `JS_Throw`（及等价 longjmp 路径），由 native gate 在托管 return 之后抛出**。

### 1.2 根因摘要

QuickJS 的 **`JS_Throw`** 依赖 **setjmp/longjmp**（或等价非本地控制流）。当执行点仍位于 **Mono reverse-P/Invoke** 托管栈帧上时，longjmp 与 CLR 栈展开 / SEH 交互 **未定义**，表现为崩溃。

约束：**`JS_Throw` 不得在仍位于 Mono 托管 reverse-P/Invoke 的栈帧上执行。**

### 1.3 非目标方案

| 方案 | 为何不用作默认 |
|------|----------------|
| 修改 QuickJS 源码换异常模型 | 分叉成本高，升级困难 |
| 每回调包一层 JS wrapper + `throw new Error()` | 正确但热路径多一帧 JS，开销大 |
| Il2Cpp 同步改协议 | Il2Cpp 已在 C++ 顶层调 `JS_Throw`，且无 Mono 帧；**保持现状** |

---

## 2. 解决方案：Native Callback Gate

### 2.1 思路

把「真正执行 **`JS_Throw`**」挪到 **薄 native C 帧**，且该帧在 **托管回调已经 return 之后**：

```text
JS_Call / QuickJS 引擎
  → zents_callback_gate              ← native；仅此处可 JS_Throw
       → managed JsCSFunction      ← 失败：push Error + return SENTINEL；禁止 JS_Throw
       ← return
  ← gate: 若 SENTINEL 则 JS_Throw(ctx, 栈顶)；否则原样 return JSValue
```

语义等价于「托管不调用 `JS_Throw`」；与 JS 侧 wrapper 里 `throw` 等价，但成功路径几乎只有一次 C 间接调用。

### 2.2 Sentinel 协议

| | 约定 |
|--|------|
| 成功 | managed 返回正常 **`JSValue`**（**不是** sentinel 包装的 tag） |
| 失败 | managed 已将 **`Error`**（或 QuickJS 异常对象）push 到当前栈顶，然后返回 **`ZENTS_CALLBACK_ERROR_SENTINEL`** |
| Sentinel 值 | **`0xFFFF5A12`**（实现常量；C 与 C# **必须**一致；与 ZLua `0xFFFF5A11` **刻意区分** 避免混链） |
| Gate | 若返回值 tag 为 sentinel → `JS_Throw(ctx, JS_GetStackTop(ctx) 对应值)`；否则 `return jsValue` |

**说明：** QuickJS 回调签名与 Lua `lua_CFunction` 不同；gate 的 C 入口形参为 `(JSContext *ctx, JSValueConst this_val, int argc, JSValue *argv, …)`（与 `JSCFunction` / `JSCFunctionMagic` 对齐，见 §2.5）。Sentinel **不** 作为合法 `JSValue` tag 出现在成功路径。

### 2.3 数据 / Magic 布局

Gate 以 **`JS_NewCFunctionMagic`**（或等价）注册；JS 侧看到的可调用对象是 gate，不是裸 managed 函数指针。

| Magic / 私有槽 | 含义 |
|----------------|------|
| **0** | managed **`JSCFunction`** 函数指针（lightuserdata 或 magic 编码） |
| **1..** | 原逻辑数据（类型句柄、程序集名、dispatch id 等） |

Managed 经 gate 进入时，读取逻辑数据须使用 **偏移后的 magic / 私有数据索引**（与 ZLua gate 的 upvalue+1 规则同构）。

`zents_gate_init` 注入：

```c
void zents_gate_init(
    void *(*js_touserdata)(JSContext *, JSValue, int),
    JSValue (*js_throw)(JSContext *, JSValue),
    int error_sentinel_tag  /* 固定 ZENTS_CALLBACK_ERROR_SENTINEL */
);
```

### 2.4 独立 DLL

Gate 编译为独立原生库，**不**链死 QuickJS：

1. 已加载当前 **`quickjs`** Editor DLL 之后
2. `zents_gate_init(...)` 注入 `JS_GetOpaque` / `JS_Throw` 等函数指针（或仅 throw + 私有约定）
3. `zents_get_callback_gate()` → 返回 gate 的 **`JSCFunction`** 指针供 `JS_NewCFunctionMagic` 包装

源码：`ZenTS~/mono-native/`。产物与 Editor QuickJS 库同放在 **`Plugins/quickjs/`**（或 `Plugins/zents/` 子目录，与包 README 一致），**仅 Editor** 启用。

| 平台 | 随附文件 | 说明 |
|------|----------|------|
| Windows Editor x64 | `Plugins/quickjs/zents_mono_gate.dll` | 本包随附 |
| macOS Editor | `Plugins/quickjs/libzents_mono_gate.dylib` | universal 优先 |
| Linux Editor | `Plugins/quickjs/libzents_mono_gate.so` | 可选自建 |

Gate **一份即可**覆盖 QuickJS 小版本升级（换 `quickjs.dll` **不必** 重编 gate，除非 QuickJS C API 破坏 ABI）。

### 2.5 Gate C 入口（规范伪码）

```c
static JSValue zents_callback_gate(JSContext *ctx, JSValueConst this_val,
                                 int argc, JSValue *argv, int magic)
{
    JSCFunction *fn = (JSCFunction *)get_managed_fn(ctx, magic);
    JSValue ret = fn(ctx, this_val, argc, argv);
    if (is_error_sentinel(ret)) {
        JSValue exc = JS_GetStackTopValue(ctx); /* 或约定槽位 */
        return JS_Throw(ctx, exc);
    }
    return ret;
}
```

实际实现须保证：**`JS_Throw` 调用点不在任何 managed 帧之上**（gate 本身为 native C）。

---

## 3. 托管侧义务（Editor）

### 3.1 注册入口

凡 JS→C# 的 **`JS_NewCFunction` / `JS_NewCFunctionMagic`（managed 回调）** **必须** 经 gate：

- `JsCallbackGate.NewCFunction` / `NewCFunctionMagic`
- 或等价封装（`ClosurePin`、`ZenTSLib.Register`、`TypeRegistry*`、exotic 分派 stub 等）

**禁止** 把裸 `Marshal.GetFunctionPointerForDelegate` 直接 **`JS_NewCFunction`** 暴露给 QuickJS（finalizer / `__gc` 等亦须走 gate）。

### 3.2 错误出口

| API | 行为 |
|-----|------|
| `QuickJsDllExtension.ThrowError` | 构造 `Error` / `JS_NewError` + push + return **`ErrorSentinel`**（**不**调 `JS_Throw`） |
| `JsCallbackBoundary.ToJsError` | 同上（经 `ThrowError`） |
| `JsCallbackBoundary.Throw` | **抛** `JsScriptException`（由入口 `try/catch` 转为 sentinel 路径） |

错误文案须带 **`zents:`** 前缀（[10-LIFETIME.md](../10-LIFETIME.md) §8.3）。

### 3.3 嵌套 C#→JS 失败

外层已在 JS→C# 回调中时，内层 `JS_Call` 失败若不能安全 `throw` 到 CLR，可经 **`NestedJsCallPendingError`** 暂存；入口在 return 前 `TryTake` → `ThrowError` → sentinel，由 gate 抛出。与 gate 协议兼容。

### 3.4 初始化时机

在加载 **`quickjs`** DLL 并创建主 **`JSContext`** 之后、注册任何 gated 回调之前调用 **`JsCallbackGate.EnsureInitialized()`**（例如 `JsMonoAppDomain` 构造早期）。

---

## 4. 作用范围

| 配置 | 是否启用 Gate |
|------|----------------|
| Editor + `ZenTS.Mono` | **是** |
| Il2Cpp Player | **否** |

### 4.1 与 Il2Cpp 的对比

Il2Cpp 的 `zents-runtime` 在调用 **`JS_Throw`** 时要求：**已处于可 longjmp 的 native 顶层，栈上无依赖 C++ 析构的临时对象**。该约束与 Mono×QuickJS 的 SEH 问题不同；**Il2Cpp 不引入本 gate**（[10-LIFETIME.md](../10-LIFETIME.md) §8.2）。

---

## 5. 如何构建 `zents_mono_gate` 原生插件

Gate **不链接** QuickJS；`JS_Throw` 等在运行时由 C# `zents_gate_init` 注入。

### 5.1 源码与脚本位置

包内相对路径：`Packages/com.code-philosophy.zen-ts/ZenTS~/mono-native/`

| 文件 | 作用 |
|------|------|
| `zents_mono_gate.c` | Gate 实现 |
| `build_zents_mono_gate.ps1` | Windows x64 → `Plugins/quickjs/zents_mono_gate.dll` |
| `build_zents_mono_gate_unix.sh` | macOS / Linux → `libzents_mono_gate.*` |

`DllImport("zents_mono_gate")` 由 Unity 映射到上述文件名。

### 5.2 Windows Editor（x64）

**依赖：** Visual Studio（含 MSVC x64 工具集）、`vswhere` 可发现的 `vcvars64.bat`。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File `
  Packages/com.code-philosophy.zen-ts/ZenTS~/mono-native/build_zents_mono_gate.ps1
```

脚本行为：

1. 调用 `vcvars64.bat`
2. `cl /O2 /LD /MD` 产出到 staging 目录
3. `Copy-Item -Force` 覆盖 `Plugins/quickjs/zents_mono_gate.dll`
4. 清理中间文件；打印时间戳 — **须核对已更新**

导出符号至少包含：`zents_gate_init`、`zents_get_callback_gate`、`zents_callback_error_sentinel`。

### 5.3 macOS / Linux Editor

```bash
bash Packages/com.code-philosophy.zen-ts/ZenTS~/mono-native/build_zents_mono_gate_unix.sh
```

产出：`libzents_mono_gate.dylib` / `libzents_mono_gate.so`；PluginImporter：**Editor 启用**、Player **禁用**。

### 5.4 Editor 布局（`Plugins/quickjs`）

```text
Plugins/quickjs/
  win32-x64/quickjs.dll
  darwin-universal/quickjs.dylib
  zents_mono_gate.dll              # Windows gate
  libzents_mono_gate.dylib           # macOS gate
  libzents_mono_gate.so              # Linux（可选）
```

**不要** 放到会被 Player 误加载的平台子目录而不写 `.meta` 禁用。

### 5.5 维护注意

| 项 | 说明 |
|----|------|
| ABI | 改 `zents_gate_init` 形参或 sentinel 后，须同步 C# `JsCallbackGate` 并重编 |
| 不链 QuickJS | 换 `quickjs.dll` 小版本 **不必** 重编 gate（除非注入 API 签名变化） |
| 验证 | 回调错误路径须 **`try/catch` 可捕获** 且 Editor 不崩 |
| 提交 | 二进制与 `.meta` 纳入版本库或 CI 产出 |

---

## 6. 实现索引（包内）

| 组件 | 路径（包内相对） |
|------|------------------|
| Gate C 源 | `ZenTS~/mono-native/zents_mono_gate.c` |
| 编译脚本 | `ZenTS~/mono-native/build_zents_mono_gate*.ps1|.sh` |
| 原生插件 | `Plugins/quickjs/zents_mono_gate*` / `libzents_mono_gate*` |
| C# 门面 | `Runtime/Mono/Utils/JsCallbackGate.cs` |
| 错误边界 | `Runtime/Mono/Utils/JsCallbackBoundary.cs` |
| 注册汇聚 | `ClosurePin`、`ZenTSLib`、`TypeRegistry*` 等 |

---

## 7. 验收要点

- [ ] 已按 §5 重编并覆盖 Plugins gate 产物
- [ ] 回调错误路径 JS `try/catch` 可捕获且 Editor 不崩
- [ ] 成功热路径（属性 get、方法调用）行为正常
- [ ] 带 magic / 私有数据的闭包在 gate 下读写正确
- [ ] 未 `gate_init` 时首次 Push 抛明确 C# 异常，而非静默崩溃
- [ ] 调试 hook（[04-JS-DEBUGGER.md](./04-JS-DEBUGGER.md)）不绕过 gate 注册 JS→C# 回调

---

## 8. 相关文档

| 文档 | 关系 |
|------|------|
| [01-QUICKJS.md](./01-QUICKJS.md) | Editor `quickjs.dll` 构建 |
| [10-LIFETIME.md](../10-LIFETIME.md) §8 | C#↔JS 异常对外语义 |
| [04-JS-DEBUGGER.md](./04-JS-DEBUGGER.md) | 调试 hook 须兼容 gate |
| 实现 `JsPrintBuffer` | 延迟 `Debug.Log`（与 gate 互补） |
