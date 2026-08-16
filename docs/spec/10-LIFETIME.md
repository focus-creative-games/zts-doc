---
sidebar_position: 6
title: "生命周期与 GC"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`10-LIFETIME.md`）
:::


# 10 — 生命周期、GC 与异常边界

> `ObjectRegistry`、Struct 相关 Registry、Opaque 有效期、**单 `JSContext`** 与 C#↔JS 异常转换。
> Opaque 细节 → [marshal/04-OPAQUE.md](./marshal/04-OPAQUE.md)；Registry 实现 → `impl/marshal/`。

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **JS 语义优先** | 托管对象存活须与 JS exotic / ref 生命周期一致 |
| **Il2Cpp GC 集成** | ByObj 槽位数组注册 **GC root**；non-blittable struct 须扫描 struct 内存 |
| **Opaque 临时性** | 仅同步 C#→JS 调用帧内有效；**禁止**持久化 |
| **单主上下文** | 默认 **`JSRuntime` + 域内一个主 `JSContext`**；ref 释放经 **`TsFramePump`** 批量处理 |
| **异常可预测** | C# 异常 ↔ JS `Error` 在边界统一转换（`zts:` 前缀） |

Mono 与 Il2Cpp **对外行为一致**；内部机制可不同（GCHandle vs `Il2CppObject*`）。

---

## 2. `ObjectRegistry`（ByObj exotic）

### 2.1 职责

管理 **class / string / array / delegate / boxed enum** 等 **ByObj** exotic：

| 机制 | 说明 |
|------|------|
| **槽位表** | 每个 Push 的托管对象分配 `slotIndex`，写入 `_registeredObjects[]` |
| **GC root** | 槽位数组通过 `GarbageCollector::RegisterRoot` 注册，防止 JS 仍持有 exotic 时对象被 Il2Cpp GC 回收 |
| **弱值缓存** | `(Il2CppObject*, viewKlass)` → 内部 ref；避免同一 identity+门面重复 Push |
| **释放** | JS 侧 exotic 句柄释放 → `UnregisterObject(slot)` + 移除缓存项 |

### 2.2 Push / Pop

```cpp
ObjectRegistry::Push(ctx, obj, viewKlass, dispatchProtoRef);
Il2CppObject* o = ObjectRegistry::Pop(ctx, idx);
```

- **viewKlass**：声明类型门面（[marshal/06-CLASS.md](./marshal/06-CLASS.md)）
- **Pop**：校验 ByObj kind；**`null`** → `nullptr`

### 2.3 生命周期

```
C# 返回对象 → Push → exotic (slot 注册 + root 保活)
  → JS 持有期间：slot 非空，对象不被 Il2Cpp 单独回收
  → 句柄释放 → UnregisterObject → slot 清空
  → 若无其它 C# 引用：对象可被 Il2Cpp GC
```

**注意：** exotic 释放 **不** 保证立即运行 C# 终结器；仅解除 ZTS 的 root 保活。

### 2.4 Shutdown

`ObjectRegistry::Shutdown(ctx)`：

1. 清空 C++ `(obj, view)` 映射
2. 释放弱值缓存表

须在释放主 `JSContext` 前、且无未完成的跨边界调用时调用。

---

## 3. Struct 与值类型 Registry

### 3.1 ByVal exotic

struct 实例 exotic 载荷为 **值拷贝**（或 pinned box）。释放回调释放 native 拷贝 / GCHandle；**不** 走 `ObjectRegistry` 槽位（除非 boxed 为 ByObj）。

### 3.2 `NotBlittableStructRegistry`（Il2Cpp）

non-blittable struct 的 ByVal exotic：

| 项 | 说明 |
|----|------|
| 存储 | exotic 内 struct 拷贝 |
| GC | `RegisterPushRootCallback` 扫描 struct **内存内** 引用字段 |
| 释放 | `Release(index)` 与 Registry 对称 |

Blittable struct 默认 **Opaque handle** 路径无 exotic 长期 `__gc`；见 [marshal/05-STRUCT.md](./marshal/05-STRUCT.md)。

### 3.3 Mono 等价

Mono 使用 `GCHandle` / boxed 等等价机制，**同一 JS 可见语义**。

---

## 4. OpaqueValue 生命周期

### 4.1 有效域

| 项 | 规则 |
|----|------|
| 产生 | C#→JS：`GetFunction` delegate、`JsMethod` bridge、标注 `[TsMarshalAs(OpaqueValue)]` |
| 形态 | opaque internal handle / exotic（**无** 三表成员分派） |
| 有效 | **仅** 产生它的那次 C#→JS 调用 **尚未返回** |
| 失效 | C# 返回后；或 `OpaqueParameterScope` generation 推进 |

### 4.2 禁止行为

- 写入全局、闭包、表字段后在后续 **`JS_Call`** / 异步中使用
- 对 opaque 使用 `.` 成员访问
- 假定 handle 跨帧仍有效

失效后 → **`throw Error('zts: invalid opaque parameter handle')`**。

### 4.3 与 Registry 的区别

| | OpaqueValue | ByObj / ByVal exotic |
|---|-------------|----------------------|
| 注册 | 不进入 ObjectRegistry | Registry + 释放回调 |
| 存活 | 调用帧 | exotic 句柄存活期 |
| 成员分派 | **无** | IEO 三表 |

---

## 5. Delegate 与 JS function ref

### 5.1 JS → C# delegate

隐式或 `zts.to_delegate` 创建 delegate exotic 时：

- native 持有 **JS function ref**（内部 registry / 等价机制）
- C# 持有 delegate → 脚本 function 保活
- delegate exotic 被释放 → 排队 **延迟 unref**（避免在 C# 栈上直接 unref）

### 5.2 C# → JS（JsMethod）

C# delegate 传入 JS 后可直接 `d(...)`（`[[Call]]`）。若 C# 侧不再持有 delegate，关联的 JS ref 在终结 / Dispose 路径释放。

### 5.3 帧泵

`TsAppDomain.ProcessPendingRefReleases()`（**`TsFramePump`** 驱动）处理延迟 unref 队列。**须在 Unity 主线程、与 JS 调用同线程** 执行（[01-HOST-API.md](./01-HOST-API.md) §1.4）。

---

## 6. 单 `JSContext` 与线程

### 6.1 默认模型

ZTS 宿主默认使用 **`JSRuntime` + 域内一个主 `JSContext`**：

- 全局 **`CSharp`**、**`zts`**、Registry 缓存、ES module loader 均绑定该上下文
- **不支持** 多线程并发无锁访问同一 context

### 6.2 调用线程

| 场景 | 要求 |
|------|------|
| Unity 主线程调 JS | 默认支持 |
| 后台线程调 JS | **须** 宿主显式同步；否则未定义行为 |
| `GetFunction` / delegate bridge / JS→C# | 应在初始化 context 的同一线程或受控队列 |

### 6.3 协程 / async

JS **`async`/`await`** 或 Promise 回调中 **不得** 使用已失效的 OpaqueValue（仍受 §4 约束）。跨 `await` 保存 opaque → **throw**。

---

## 7. 初始化与整域 Reset 顺序

宿主公开 API：**`TsAppDomain.Initialize` / `Reset`**（**无** 公开 `Shutdown`）。

### 7.1 Initialize（概念）

```
1. 创建 JSRuntime + 主 JSContext
2. ZTSLib::RegisterGlobals（zts 内部 hook）
3. 加载 ztslib.js
4. ObjectRegistry::Initialize
5. TypeRegistry / MetaBinding / Opaque scope 初始化
6. 创建全局 CSharp 根对象
7. 安装 ES module loader（`csharp:` 类型模块 → 原生 C 模块 → 宿主 `moduleLoader` / `GetFunction`）
8. （Il2Cpp）RegisterPushRootCallback for struct roots
9. 注册 TsFramePump
```

已存在主 context 时再次 `Initialize` → **抛 C# 异常**（须 `Reset`）。

### 7.2 Reset（概念）

`Reset(loader)` **先预约**，在本帧 **EndOfFrame** 由 **`TsFramePump`** 真正执行：

```
调用当下：
1. 记录 pending loader
2. 不立刻释放 context

EndOfFrame：
1. ProcessPendingRefReleases 排空队列
2. ObjectRegistry::Shutdown / Struct / MetaTable 等
3. 释放 JSContext / JSRuntime（旧 GetFunction 委托一律作废）
4. 按 §7.1 重建并安装 loader
```

Il2Cpp：**进程级** Bridge / XML 表 / InternalCall **保留**；仅重建 state 级资源。

因 teardown 推迟到帧末，允许在 C#↔JS 调用中途 **预约** `Reset`；**EndOfFrame 之后** 旧 delegate **必须** 丢弃并重新 `GetFunction`（[01-HOST-API.md](./01-HOST-API.md) §1.2）。

---

## 8. 异常边界

### 8.1 C# 调用 JavaScript

| 事件 | 行为 |
|------|------|
| JS `throw` | 捕获为 C# 异常（`TsException` 或包装类型） |
| JS 栈不平衡 | native 断言 / 异常 |
| C# 异常穿过 native | **禁止** 泄漏；边界 translate 或 rethrow |

**GetFunction** invoke 前后维护 **OpaqueParameterScope**，异常路径亦失效 opaque。

### 8.2 JavaScript 调用 C#

| 事件 | 行为 |
|------|------|
| C# 抛异常 | 转换为 **`throw new Error('zts: …')`**；Mono / Il2Cpp 文案一致或等价 |
| 脚本 | `try/catch` 捕获 |

**Editor Mono：** 不得在托管 reverse-P/Invoke 帧内直接 **`JS_Throw`** 未包装路径；须经 **native callback gate**（实现见 `impl/MONO.md`）。Il2Cpp 遵守 QuickJS 与 C++ 析构约束。

### 8.3 错误消息

Bind 失败、marshal 失败、重载无匹配、opaque 无效、成员 miss 等，Mono 与 Il2Cpp **须** 对同一条件给出等价文案（**`zts:`** 前缀）。

---

## 9. GC 交互摘要

```text
flowchart TB
    subgraph JsGC["JS 引擎 GC / 句柄释放"]
        UD[exotic 释放]
    end
    subgraph ZTS["ZTS Registry"]
        OR[ObjectRegistry Unregister]
        SR[StructRegistry Release]
    end
    subgraph Il2CppGC["Il2Cpp GC"]
        ROOT[GC roots 槽位数组]
        SCAN[PushRootCallback struct 扫描]
    end
    UD --> OR
    UD --> SR
    OR --> ROOT
    SR --> SCAN
```

| 对象类型 | JS 回收触发 | 托管回收 |
|----------|-------------|----------|
| ByObj class | exotic 释放 | 解除 root 后可 GC |
| ByVal blittable | exotic 释放或 scope 结束 | 拷贝释放 |
| ByVal non-blittable | exotic 释放 | 扫描 + 释放拷贝 |
| Opaque | scope 结束（非 exotic GC） | 不涉及 root |

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [01-HOST-API.md](./01-HOST-API.md) | `GetFunction`、`Reset`、`TsFramePump` |
| [marshal/04-OPAQUE.md](./marshal/04-OPAQUE.md) | Opaque API |
| [marshal/06-CLASS.md](./marshal/06-CLASS.md) | ByObj、view |
| [marshal/05-STRUCT.md](./marshal/05-STRUCT.md) | struct GC |
| [marshal/09-FUNCTION.md](./marshal/09-FUNCTION.md) | delegate ref |
| [00-OVERVIEW.md](./00-OVERVIEW.md) | 初始化流程 |
