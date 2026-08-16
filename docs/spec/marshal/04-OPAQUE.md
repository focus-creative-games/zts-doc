---
sidebar_position: 10
title: "OpaqueValue（临时不透明参数）"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\04-OPAQUE.md`）
:::


# OpaqueValue（临时不透明参数）

> **规范性：** C# 调用 JavaScript 时，将形参/局部在 C# 调用栈上的存储地址暴露给脚本的临时令牌；以及 `[TsMarshalAs(OpaqueValue)]` 强制路径。
> **byref 默认（C#→JS）：** `ref`/`in`/`out` **默认** OpaqueValue，见 [03-BYREF.md §2](./03-BYREF.md)。
> **API：** `zts.get_opaquevalue` / `zts.set_opaquevalue`（native 内部 hook），签名见 [../05-LIB.md](../05-LIB.md)。

---

## 1. 定义

OpaqueValue 是 **C# 调用 JavaScript** 时，将 **形参/局部在 C# 调用栈上的存储地址** 暴露给脚本的临时令牌。脚本可在 **本次调用有效期内** 读取、写回；在目标形参类型允许时亦可将 handle **原样** 作为 **JS→C#** 实参传回（§6）；**不可** 持久化后跨调用使用。

---

## 2. JavaScript 可见形态

| 项 | 规则 |
|----|------|
| 形态 | **opaque exotic object** 或 **internal opaque handle**（实现二选一；脚本 **无** 三表成员分派） |
| 载荷 | **handle**（编码 `generation + index`） |
| 成员访问 | **不可** `.` / `[` 访问 CLR 成员 |
| 与 ByObj/ByVal exotic | **不同**：不注册 `ObjectRegistry` 长期槽位（仅调用帧 scope） |

脚本读写须经 `zts.get_opaquevalue` / `zts.set_opaquevalue`（§5）。

---

## 3. 产生方向与可表达类型

| 规则 | 说明 |
|------|------|
| **仅 C# → JS 创建** | 由 native 在 C# 调 JS 的 marshal 路径 Push；**无** JS API 伪造合法 handle |
| **可产生** | ① **`ref`/`in`/`out T`**（任意 T）默认；② by-val 且 [02-MARSHAL-AS.md §3](./02-MARSHAL-AS.md) 允许 — 标注 `[OpaqueValue]`。**基元 / `IntPtr` 族 by-val 禁止** |
| **方向** | `OpaqueValue` 标注 **仅 C#→JS** |
| 槽义 | 指向当前 C# 栈帧上的参数存储（by-val 为值槽；byref 为指针槽） |

### 3.1 `ref` / `out` / `in` 默认

| 方向 | 规则 |
|------|------|
| **C# → JS** | **`ref`/`in`/`out T`** 默认 Push OpaqueValue |
| **非 byref** | 默认 [01-OVERVIEW.md](./01-OVERVIEW.md)；允许时标注强制 Opaque |

Lua 回调中的 `ref int` **不是** `number`，而是 opaque handle；再传给 `ref int` C# 形参可 **原样** 传回（§6 byref 规则）。

---

## 4. 生命周期与禁止持久化

| 规则 | 说明 |
|------|------|
| 有效域 | **仅** 产生它的那次 **C# 调用 JS** 尚未返回（`OpaqueParameterScope` / generation） |
| 回调内 | 可 `get`/`set`；可按 §6 传回 C# |
| **禁止** | 写入全局、闭包捕获后在 **异步** / **后续 JS_Call** / **C# 已返回** 后使用 |
| 失效后 | `get`/`set`/Pop → **`throw Error('zts: invalid opaque parameter handle')`** |

```javascript
function OnTick(h) {
    const v = zts.get_opaquevalue(h);
    zts.set_opaquevalue(h, v + 1);
    CS.Demo.UseInt(v);              // 简单类型须先解值
}

function OnPoint(h) {
    CS.Demo.UsePoint(h);            // struct：Pop 自动解 Opaque
}
// C# 返回后仍持有 h → 下次使用 throw
```

**长生命周期：** `zts.to_user_data(opaque)`（**拷贝** 到 ByVal exotic）或默认 StructUserData 路径，见 [05-STRUCT.md](./05-STRUCT.md)。

异常路径：`GetFunction` invoke 须维护 **OpaqueParameterScope**，确保异常时 handle 同样失效（[../10-LIFETIME.md](../10-LIFETIME.md)）。

---

## 5. 读写 API

### 5.1 `zts.get_opaquevalue(opaque_handle) → value`

| handle 指向 | 行为 |
|-------------|------|
| 非 byref | 对槽值走 [01-OVERVIEW.md](./01-OVERVIEW.md) **默认 Push 规则** 转为 JS 值 |
| **`ref`/`in`/`out T`** | **先解引用**，再对 **T** 默认 Push（例：`ref int` → **number**） |

### 5.2 `zts.set_opaquevalue(opaque_handle, new_value)`

| handle 指向 | 行为 |
|-------------|------|
| 非 byref | 按 [01-OVERVIEW.md](./01-OVERVIEW.md) **默认 Pop** 写入槽 |
| **`ref`/`in`/`out T`** | 解引用后对 **T** 默认 Pop 写入 |

```javascript
function OnRefInt(h) {
    zts.set_opaquevalue(h, zts.get_opaquevalue(h) + 10);
}
```

过期 / 非 opaque / 损坏 → **`throw Error`**。

---

## 6. 作为 JS→C# 实参传回（按目标类型分流）

handle **仍有效** 的同步链内：

| 目标形参（去 byref 后） | 是否自动解 OpaqueValue | 脚本做法 |
|--------------------------|------------------------|----------|
| **托管引用类型**（class、string、delegate、数组、boxed 等） | **是** | 可 **原样** 传入 handle |
| **`struct`（普通值类型）** | **是** | 同上 |
| **简单类型**（bool、整型、float、enum、`IntPtr` 等） | **否** | 须 `zts.get_opaquevalue(h)` 后再传 |
| **`ref`/`in`/`out A`** | **一律** 先识别 Opaque；兼容则 **直传地址**（含 `ref int`） | 见 [03-BYREF.md](./03-BYREF.md) |

```javascript
function OnOpaquePoint(h) {
    CS.Demo.AcceptPoint(h);                         // OK
}

function OnOpaqueInt(h) {
    CS.Demo.AcceptInt(zts.get_opaquevalue(h));      // OK
    // CS.Demo.AcceptInt(h);                        // 失败
}
```

**性能动机：** 基元 Pop 为热路径；不在每次 Pop 探测 Opaque。

---

## 7. 与 struct Handle 路径

struct 默认 C#→JS by-val 在同步链内亦可能为 OpaqueValue。须 `get`/`set`、`to_user_data` 拷贝，或在 §6 允许类型上原样传回。详见 [05-STRUCT.md](./05-STRUCT.md)。

---

## 8. 设计要点摘要

| 维度 | 结论 |
|------|------|
| 仅 C#→JS 创建 | 地址来自 C# 栈；JS 无法伪造 |
| 谁可 Opaque | `ref`/`in`/`out` 默认；by-val 见 §3 |
| 无三表分派 | 强制经 get/set |
| 禁止跨调用 | `generation` 拦截 use-after-return |
| get 解 byref | `ref int` 对脚本为 `number` |
| Pop 自动解 | 仅 struct / 托管引用 by-val；byref 一律 Opaque 路径 |

---

## 9. 相关文档

| 主题 | 文档 |
|------|------|
| JS→C# byref | [03-BYREF.md](./03-BYREF.md) |
| `[TsMarshalAs(OpaqueValue)]` | [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) |
| struct | [05-STRUCT.md](./05-STRUCT.md) |
| `zts.*` | [../05-LIB.md](../05-LIB.md) |
| 帧泵 / scope | [../10-LIFETIME.md](../10-LIFETIME.md) |
