---
sidebar_position: 15
title: "Delegate / 函数 Marshal"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\09-FUNCTION.md`）
:::


# Delegate / 函数 Marshal

> **规范性：** C# `Delegate` 与 JavaScript function 之间的双向 Marshal。
> **相关：** ByObj → [06-CLASS.md](./06-CLASS.md)；`GetFunction` → [../01-HOST-API.md](../01-HOST-API.md)；byref → [03-BYREF.md](./03-BYREF.md)、[04-OPAQUE.md](./04-OPAQUE.md)；`to_delegate` → [../05-LIB.md](../05-LIB.md)。

**平台原则：** Mono 与 Il2Cpp **JS 可见语义一致**；Il2Cpp 构建期 C++ bridge；Mono Expression Emit。

**无 Event 专用 Marshal**；用 `add_*` / `remove_*`（[../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §4.5）。

---

## 1. 问题与目标

| 方向 | 需求 |
|------|------|
| **C# delegate → JS** | 默认 **Delegate exotic**；若 `target` 为 **JsMethod**（JS 回调源）→ Push **原 JS function** |
| **JS function → C# delegate** | 带 delegate 形参的 C# 方法 **隐式** marshal |

| 目标 | 说明 |
|------|------|
| 无感 | JS 传 `function`，marshal 层转换 |
| 性能 | Il2Cpp 零反射；Mono 按 `Invoke` 签名缓存 Emit |
| 统一 | C#→JS 经 **GetFunction / delegate bridge** 共用 **JS_Call** + marshal 规则 |
| 安全 | `funcRef` 与 delegate 生命周期绑定 |
| 可控 | 未覆盖签名 → 明确 **throw**（Mono **禁止** 静默 `Method.Invoke` 热路径） |

---

## 2. 总体架构

```text
flowchart TB
    subgraph CSharpToJs["C# delegate → JS"]
        D1[C# MulticastDelegate]
        CHK{target 是否为 JsMethod?}
        UD1[Delegate exotic + [[Call]]]
        LF0[registry funcRef → JS function]
        D1 --> CHK
        CHK -->|否| UD1
        CHK -->|是| LF0
    end

    subgraph JsToCSharp["JS function → C# delegate"]
        LF1[JS function]
        REF1[JS 侧 ref / 内部持有]
        JM1[JsMethod target]
        BR[Delegate bridge]
        DEL[C# Delegate]
        LF1 --> REF1 --> JM1 --> DEL
        BR --> DEL
        DEL --> BR --> LF1
    end
```

| 组件 | 职责 |
|------|------|
| `JsMethod` | JS→C# delegate 的 **closed target**；持有 `funcRef` |
| `DelegateBridges`（Il2Cpp） | 构建期 C++ bridge，按 `Invoke` 签名 |
| `DynamicBridgeFactory`（Mono） | 运行时 Expression 编译，**按签名缓存** |
| `JsDelegateBinder` | `JsMethod` + bridge → delegate |
| `ReadDelegate` | JS callable → delegate |
| `JsCallInvoker` | `funcRef` + push + **`JS_Call`** + pop；与 `GetFunction` 共用 |

---

## 3. C# delegate → JavaScript

### 3.1 分流规则

| 判定 | C# → JS 形态 |
|------|--------------|
| **`target` 为 `JsMethod`** | **JS function**（`funcRef` 解引用） |
| **其它** | **Delegate exotic**（ByObj + `[[Call]]`） |

```text
PushDelegate(d):
  if d == null → push null; return
  if IsJsBoundDelegate(d):
      PushRef(d.JsMethod.funcRef)   // → JS function
      return
  PushByObjExotic(d)
```

| 项 | 规则 |
|----|------|
| **多播** | 仅当整条 invocation list 可还原为 **单一** JS 源时走 function；否则 exotic |
| **往返** | JS function → C# → 再 Push → **同一** function |
| **`[TsMarshalAs(Object)]`** | **不** 覆盖分流 |
| **`null`** | **`null`** |

### 3.2 Delegate exotic 调用

**推荐** `d(a, b)`（`[[Call]]` → `Invoke`）。

| 写法 | 适用 |
|------|------|
| `d(a, b)` | function 与 Delegate exotic |
| `d.Invoke(a, b)` | **仅** exotic；对 function **无效** |

```javascript
obj.RegisterCallback((v) => console.log(v));
const f = obj.Callback;
console.assert(typeof f === "function");
f(1);
```

### 3.3 `[[Call]]` 语义（Delegate exotic）

- 保持 C# **多播**语义
- 对 **`null`** 调用 → **throw**
- **开放 delegate**（`target == null`）：MVP **不支持**

---

## 4. JavaScript function → C# delegate

### 4.1 隐式 marshal（默认）

```javascript
obj.RegisterCallback((v) => console.log(v));
```

```text
1. 解析形参类型 delegateType
2. 栈上为 JS callable（或 null → null delegate）
3. ReadDelegate(ctx, arg, delegateType)
     → 持有 funcRef
     → JsDelegateBinder.Create(delegateType, funcRef)
4. Invoke C# 方法
5. delegate 未被长期持有 → GC 回收 JsMethod 并释放 ref（§6）
```

| JS 实参 | C# delegate |
|---------|-------------|
| `function` | `JsDelegateBinder.Create(...)` |
| **`null`** | **`null`** |
| **`undefined`** | 必选 → **throw**；可空 delegate → **`null`**（与 [01-OVERVIEW.md](./01-OVERVIEW.md) §2 一致） |
| Delegate exotic | 直接传递 |
| 其它 | **throw** |

### 4.2 `JsMethod` + closed delegate

| 字段 | 值 |
|------|-----|
| `target` | `JsMethod` |
| 入口 | 平台 bridge |

### 4.3 Il2Cpp：`DelegateBridges`

按每种 `Invoke` 签名生成 C++ 入口：`JS_Call` + marshal。

- **`ref`/`out`/`in`（bridge C#→JS）**：默认 **OpaqueValue**
- **`[TsMarshalAs]`** 非默认：与普通方法同一解析
- 未注册签名 → **throw** + Codegen 提示

### 4.4 Mono：Expression Emit

- 首次遇签名 emit；**缓存**
- 无法 marshal → **`NotSupportedException`**
- **`ref`/`out`/`in`**：**支持**
- **禁止** `DynamicMethod` + `Delegate.CreateDelegate`（Unity Mono SIGSEGV 风险）

### 4.5 显式 `zts.to_delegate`

```javascript
const d = zts.to_delegate((a) => a, FuncIntIntType);
obj.RegisterCallback(d);
```

同一 `JsDelegateBinder.Create`；返回 **Delegate exotic**。

---

## 5. GetFunction 与 delegate bridge

| | `GetFunction<T>` closed delegate | 其它 C#→JS closed delegate |
|--|-----------------------------------|------------------------------|
| 方向 | **C# → JS** | **C# → JS** |
| 绑定 | `import` 模块 + 命名导出 + marshal 为 `T` | 隐式 marshal / `to_delegate` |
| 调用 | `T.Invoke` → **`JS_Call` / `JS_Eval`** | 同左 |
| **`ref`/`out`/`in`（C#→JS）** | 默认 **OpaqueValue** | 同左 |
| **`params`** | **不支持** | **不支持** |
| 缓存 | **调用方负责** | 持有方决定 |

**Reset 后**旧 delegate **作废**（[../01-HOST-API.md](../01-HOST-API.md) §1.2）。

**不属于 C#→JS bridge：** JS 调 C# 时 delegate **形参**隐式 marshal → **MethodBridge → ReadDelegate**。

---

## 6. 生命周期与 GC

| 事件 | 行为 |
|------|------|
| 隐式 marshal / `to_delegate` | 登记 `funcRef`；delegate 持有 `JsMethod` |
| delegate 被 C# GC | `JsMethod` 终结 → 排队释放 ref |
| JS function 无其它引用 | ref 仍保活直至 delegate 释放 |
| 失效后调用 | **throw** |

**帧泵：** `TsAppDomain.ProcessPendingRefReleases()`（`TsFramePump`）在主线程批量 `unref`（[../10-LIFETIME.md](../10-LIFETIME.md)）。

**C# delegate → JS（JS 源）：** Push function；**不** 新建 ref。

**C# delegate → JS（原生）：** exotic `__gc` → `ObjectRegistry.Unregister`；**不** pin JS function。

---

## 7. Mono / Il2Cpp

| 项 | Il2Cpp | Mono |
|----|--------|------|
| C#→JS 分流 | §3.1 | **相同** |
| JS→C# bridge | C++ `DelegateBridges` | Expression Emit |
| 未支持签名 | 运行时查表失败 | **`NotSupportedException`** |
| JS 可见语义 | 权威 | **须一致** |

---

## 8. Codegen（Il2Cpp）

与 `MethodBridges` 同源扫描：带 **delegate 形参** 的 public 方法 → 推导 `Invoke` 签名。

签名键示例：

```text
void(System.Int32)              → Action<int>
System.Int32(System.Int32)      → Func<int,int>
```

---

## 9. 边界情况

| 场景 | MVP |
|------|-----|
| `Action` / `Func<>` / 自定义 delegate | 按 **`Invoke` 签名** |
| C#→JS | §3.1 分流 |
| byref | [03-BYREF.md](./03-BYREF.md)、[04-OPAQUE.md](./04-OPAQUE.md) |
| `params` on bridge | **不支持** |
| 开放 delegate | 可不支持 |
| Multicast + JS 回调 | **单播** |
| 协变 / 逆变 | **精确** delegate 类型 |
| Event | **无** 专用；`add_*`/`remove_*` |

---

## 10. 相关文档

| 文档 | 内容 |
|------|------|
| [06-CLASS.md](./06-CLASS.md) | Delegate exotic |
| [../01-HOST-API.md](../01-HOST-API.md) | GetFunction |
| [../05-LIB.md](../05-LIB.md) | to_delegate |
| [../10-LIFETIME.md](../10-LIFETIME.md) | ref 释放 |
