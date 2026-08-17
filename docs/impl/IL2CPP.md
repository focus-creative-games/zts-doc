---
sidebar_position: 2
title: Il2Cpp 实现
description: zents-runtime C++ 路径笔记。
---

# Il2Cpp 实现

> **包内镜像：** `Packages/com.code-philosophy.zen-ts/ZenTS~/zents-runtime`（Install → `Local…/libil2cpp/zents`）
> **开发编辑参考：** 导出工程 `Build-Win64/.../libil2cpp/zents`（改完再 sync 回包；路径以团队仓库为准）
> **托管壳：** `ZenTS.Il2Cpp` / `JsIl2CppAppDomain`（薄 InternalCall）
> **JS 可见语义：** [spec](/docs/spec/00-OVERVIEW/) — 本文只描述 C++ 模块划分、Generate / ReducedType、初始化顺序。

---

## 1. 模块图（高阶）

Player 热路径在 **`zents-runtime`**（运行时目录名 **`zents`**）。与 Mono `Runtime/Mono/` 按职责对照：

```
zents/   （← ZenTS~/zents-runtime）
├── lvm/         宿主生命周期、JS 状态、ZenTSLib、InternalCall、Loader
├── mt/          类型注册、成员索引（Dispatch* + MetaBinding / TypeRegistry）
├── marshal/     Push/Pop、Registry、MarshalMeta、Overload 解析
├── bridge/      Method / Property / Field / Delegate 调用体
├── generated/   构建期 Codegen 产物（stub 表、BuiltinScripts.inc、ZenTSConf.inc）
├── utils/       横切：元数据、异常、栈守卫、分配器
└── ZenTSCommon.*  公共头、Compatible shim、与 QuickJS / Il2Cpp ABI
```

**依赖方向（硬约束，与 ZLua 同构）：**

- `marshal/` **不得**依赖 `mt/`（Mt 经 hooks / 上层装配）
- `bridge/` 可依赖 `marshal/` 与 `generated/`
- `generated/` 仅被 `lvm/`、`bridge/` 等引用；不参与随意运行时分支

QuickJS 源码在 `libil2cpp/quickjs`（Install 自 `ZenTS~/quickjs-il2cpp`）；与 `zents` **静态编进**同一 native 产物。见 [11-MULTI-VERSION](/docs/spec/11-MULTI-VERSION/)、[build/01-QUICKJS](/docs/spec/build/01-QUICKJS/)。

具体 `.cpp` 文件名以包内树为准；上表只保证 **角色** 稳定。`ZenTSLib` 注册点见 [05-LIB](/docs/spec/05-LIB/)（`lvm/ZenTSLib.cpp`）。

---

## 2. Generate stubs 与 ReducedType

Il2Cpp **不能**在 Player 上 Expression Emit。构建期扫描绑定集合，生成 C++ 桥：

| 产物（概念） | 职责 |
|--------------|------|
| MethodBridge stub 表 | JS→C# 方法 invoker；相同 **ReducedType** 签名 **复用** 一条桥 |
| Property / Field bridge | getter/setter、字段 offset + `methodPointer` 快路径 |
| DelegateBridge stub | Delegate ↔ JS function；**C#→JS `GetFunction`** 亦经 Delegate 桥 |
| MarshalAs / Alias / Extension 表 | 预编译 XML 与 Attribute 一并 Generate；**Player 不读 XML** |
| `BuiltinScripts.inc` | 嵌入 `zentslib.js` 等 |

| 概念 | 说明 |
|------|------|
| **ReducedType** | 将 CLR 签名归约为可复用的 native 调用形（参数槽 / 返回 / byref 等）；同形共享 stub，避免「每成员一个独立 C 函数」膨胀 |
| **未覆盖签名** | 构建期或首次绑定失败（MethodBridge 等），见 [01-HOST-API](/docs/spec/01-HOST-API/) §7 |
| **与 Mono** | Mono 为 **每成员完整签名 Emit**；语义一致，复用策略不同 |

流水线概念：[设计概览](/docs/concepts/design-overview/) · 构建步骤：[guides/build](/docs/guides/build/)。

---

## 3. 初始化顺序

### 3.1 AppDomain 级（进程 / 域）

托管 `JsIl2CppAppDomain.Initialize` → native（概念顺序）：

| 步骤 | 职责 |
|------|------|
| 1 | 绑定期元数据堆 / Metadata 缓存初始化 |
| 2 | **Property / Method / Delegate Bridge::Initialize** — 加载 `generated/` stub 表 |
| 3 | 核心 **InternalCall** 注册 |
| 4 | Loader 根 / 搜索路径（若有） |
| 5 | **JS 状态级 Initialize**（下节） |
| 6 | 安装托管 `moduleLoader` delegate |
| 7 | 注册 **`JsFramePump`** |

进程级 Bridge / XML 生成表 / InternalCall 在 **`Reset` 时保留**。

### 3.2 JS 状态级（主 `JSContext`）

| 步骤 | 职责 |
|------|------|
| 1 | 创建 `JSRuntime` + 主 `JSContext`（**单上下文**） |
| 2 | 注册 globals / 嵌入脚本；`ZenTSLib::RegisterGlobals` + `zentslib.js` |
| 3 | `ObjectRegistry` / Struct registry / MetaTable 缓存 |
| 4 | 安装 ES module hooks（**先** `csharp:`，再原生 C 模块，再宿主 loader） |
| 5 | `AssemblyRegistry` / `CSharp` 根 |
| 6 | （可选）struct GC root 回调等 |

**Reset：** 预约 → EndOfFrame：排空 pending ref → Registry shutdown → 释放 context → 按 §3.2 重建。权威：[10-LIFETIME](/docs/spec/10-LIFETIME/) §7。

已初始化时再次托管 `Initialize` → 抛异常（须 `Reset`）。

---

## 4. 文件职责（按目录摘要）

### `lvm/`

宿主入口、`JS` 生命周期、pending ref 队列、`ZenTSLib`（`zents.*` native）、InternalCall、模块 loader 与托管 delegate 对接。

### `mt/`

`CSharp` / 程序集懒加载、`EnsureBinding` 语义的 native 侧、`MetaBinding` 扫描、三表填充、`Dispatch*` 挂载、类型门面（reference / valuetype / array / enum）。

### `marshal/`

按 `Il2CppType*` 的 Push/Pop、`ObjectRegistry`（ByObj GC root）、Struct registry、Delegate / Opaque / Array / Primitive、overload resolver。语义见 [spec/marshal](/docs/spec/marshal/)。

### `bridge/`

`MethodBridge`（stub 查表 → invoker）、Property / Field bridge、`DelegateBridge`（含 **GetFunction** 调用路径）。

### `generated/`

**构建产出，勿手改。** stub 头、`BuiltinScripts.inc`、`ZenTSConf.inc`（Install/Generate 宏）等。

### `utils/`

类型/方法元数据查询、异常边界、栈守卫、绑定期分配器。

---

## 5. 与 Mono 的对照要点

| 维度 | Il2Cpp | Mono |
|------|--------|------|
| 成员索引 | `Dispatch*` + MetaBinding | Exotic 三表 indexer |
| JS→C# | Codegen stub + **ReducedType 复用** | Emit 每成员 |
| C#→JS | `GetFunction` + Delegate 桥 | 同左 |
| Event | `add_*` / `remove_*` 普通方法 | 同左 |
| 源码权威 | `zents-runtime` / 导出工程 `libil2cpp/zents` | `Runtime/Mono/` |

对照 [MONO](/docs/impl/MONO/)。

---

## 6. 关联文档

- [实现索引](/docs/impl/overview/)
- [Mono 实现](/docs/impl/MONO/)
- [双运行时](/docs/concepts/dual-runtime/)
- [多版本 / Install](/docs/spec/11-MULTI-VERSION/)
- [宿主 API](/docs/spec/01-HOST-API/) · [生命周期](/docs/spec/10-LIFETIME/)
