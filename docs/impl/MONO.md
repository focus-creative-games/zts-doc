---
sidebar_position: 1
title: Mono 实现
description: Editor Mono 路径笔记。
---

# Mono 实现

> **源码根（包内）：** `Packages/com.code-philosophy.zen-ts/Runtime/Mono/`
> **程序集：** `ZenTS.Mono`；入口类型名 **`JsMonoAppDomain`**（根命名空间 `ZenTS`，供 Common 反射解析）
> **JS 可见语义：** [spec](/docs/spec/00-OVERVIEW/) — 本文只写 Editor Mono 的职责划分、初始化与和 Il2Cpp 的实现差异。

---

## 1. 背景与目标

Editor 需要快速迭代：以 **反射 + Expression Emit** 完成 JS→C# 桥，避免为每个成员手写 Wrap。目标是与 Il2Cpp Player **交互表现一致**（miss、overload、Marshal、`GetFunction`、lifetime），实现路径可以更慢。

| 主题 | Mono 落点（概念） |
|------|-------------------|
| 成员索引 | Exotic 三表 + indexer（无 Il2Cpp 式 `Dispatch*` 热路径） |
| JS→C# 桥 | 绑定期 **Emit MethodBridge**（每 public 成员一条特化闭包） |
| 类型绑定 | 首次取得类型对象时 **EnsureBinding** |
| C#→JS | **`GetFunction` + Delegate 桥**（与 Il2Cpp 同模型） |
| 无法 Emit 的签名 | **绑定期显式失败**，禁止 silent `Method.Invoke` 热路径 |
| Event | **无**专用对象；`add_*` / `remove_*` 作普通方法进 method 表 |

QuickJS：Editor 经 `DllImport` 加载 Plugins 动态库；`ZenTS.Mono` P/Invoke 调用引擎 API。见 [build/01-QUICKJS](/docs/spec/build/01-QUICKJS/)、[build/03-MONO-CALLBACK-GATE](/docs/spec/build/03-MONO-CALLBACK-GATE/)。

---

## 2. 目录与模块职责（高阶）

Mono 树与 Il2Cpp `zents-runtime` **按职责对照阅读**（PascalCase 目录名以包内为准；下列为角色，非保证每个文件名）：

```
Runtime/Mono/                 ←→  libil2cpp/zents（zents-runtime）
├── Lvm/                      ←→  lvm/     宿主生命周期、JS 状态、标准库注册、loader
├── Mt/                       ←→  mt/      类型注册、三表 / MetaBinding、EnsureBinding
├── Marshaling/               ←→  marshal/ Push/Pop、Registry、overload（避让 System.Marshal）
├── Bridge/                   ←→  bridge/  方法 / 字段 / 属性 / Delegate 调用体
├── Emit/                     ←→  generated/  运行时 Expression 生成（非构建期 stub）
├── Utils/                    ←→  utils/   横切辅助
└── DelegateImpl/             ←→  （命名避开 System.Delegate）
```

**命名空间习惯：** `ZenTS.Lvm` / `ZenTS.Mt` / `ZenTS.Marshaling` / `ZenTS.Bridge` / `ZenTS.Emit` 等（以包内 `asmdef` 为准）。

公共特性与门面在 **`ZenTS.Common`**，Mono **不**被 Common 直接引用；由 `JsAppDomain` 反射创建后端。

---

## 3. EnsureBinding 与 Emit MethodBridge

```text
CSharp[asm][type] 或 csharp: named export
  → 解析 CLR Type
  → EnsureBinding(T)
       · 扫描 public 成员（含继承扁平化、[JsAlias]、[JsExtension]）
       · 写入 STO / IEO 三表
       · 对每个桥接槽 Emit MethodBridge（Expression.Compile → 可调入口）
  → 缓存类型对象
```

| 项 | 约定 |
|----|------|
| 急切度 | 与取得类型对象的路径一致；**禁止**因打开 `csharp:` 命名空间模块而对未 import 类型做 EnsureBinding |
| 桥接粒度 | **每成员 / 完整签名** 一条 Emit 入口（**不**共享 Il2Cpp ReducedType stub） |
| 手动 Export | **不需要**业务侧 `[MonoPInvokeCallback]`；codegen / Emit 自动处理 |
| Callback gate | Editor 侧 `JS_Throw` 等须经 Mono gate，见 [03-MONO-CALLBACK-GATE](/docs/spec/build/03-MONO-CALLBACK-GATE/) |

语义细则：[metatable/03-BINDING](/docs/spec/metatable/03-BINDING/) · [01-HOST-API](/docs/spec/01-HOST-API/) §5–§7。

---

## 4. 初始化顺序（概念）

首次 `JsAppDomain.Initialize(moduleLoader)` → `JsMonoAppDomain`：

| 步骤 | 动作（概念） | 对照 Il2Cpp |
|------|--------------|-------------|
| 1 | 创建 `JSRuntime` + 主 `JSContext` | `JS` 状态创建 |
| 2 | Object / Struct / Meta 等 Registry 初始化 | 同左 |
| 3 | 安装 exotic indexer / 绑定工厂 | Mono 独有：Emit 路径准备 |
| 4 | 安装 ES module loader（先拦截 `csharp:`） | Loader hooks |
| 5 | `ZenTSLib` / `zentslib.js`（`zents` 全局） | `RegisterGlobals` + 嵌入脚本 |
| 6 | `EnsureCSharpRoot` | `CSharp` 根 |
| 7 | Delegate 桥预热（若有） | `DelegateBridge` |
| 8 | 注册 `JsFramePump` | 同左 |

**重复 Initialize：** 已有主上下文 → **抛异常**（须 `Reset`）。

**Reset：** 宿主面预约 → `JsFramePump` 在 **EndOfFrame** 执行 teardown + 按上表重建。公开 API **无** `Shutdown`。

Il2Cpp 在 AppDomain 级额外提前加载 stub 表；Mono 对应桥在 **EnsureBinding / Emit** 时写入三表。

权威顺序：[10-LIFETIME](/docs/spec/10-LIFETIME/) §7 · [00-OVERVIEW](/docs/spec/00-OVERVIEW/) §4。

---

## 5. 与 Il2Cpp 的关键差异

| 主题 | Il2Cpp | Mono |
|------|--------|------|
| 成员索引 | Native `Dispatch*` + `MetaBinding` / `TypeRegistry` | Exotic 三表 + indexer |
| JS→C# 桥 | 构建期 C++ stub；按 **ReducedType** 签名复用 | 绑定期 **Emit**；每成员特化 |
| MetaBinding 上下文 | `MethodMarshalCtx` 等 registry 路径 | 特化闭包直接绑 `MethodInfo` / `FieldInfo` |
| C#→JS | `GetFunction` + Delegate 桥 | 同左 |
| Event | 无专用元数据；`add_*`/`remove_*` 普通方法 | 同左 |
| GC | Il2Cpp GC root 槽位 | 槽位强引用 / weak cache 等托管机制 |

差异 **允许**；miss / overload / cast / struct / delegate 等 **JS 可见行为**须一致。对照 [IL2CPP](/docs/impl/IL2CPP/)。

---

## 6. 验收关注点

- Editor：与 Il2Cpp 一致的类型门面、`zents.cast`、虚方法、overload、struct、delegate、数组
- 无 Event 专用 API；`add_` / `remove_` 仅普通方法
- 热路径无 `Method.Invoke` 兜底；无法 Emit → 显式失败
- 无 ReducedType 共享桥（那是 Il2Cpp 优化）

## 7. 关联文档

- [实现索引](/docs/impl/overview/)
- [Il2Cpp 实现](/docs/impl/IL2CPP/)
- [双运行时](/docs/concepts/dual-runtime/)
- 包路径与 Install：[11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)
