---
sidebar_position: 9
title: "`ref` / `in` / `out` Marshal"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\03-BYREF.md`）
:::


# `ref` / `in` / `out` Marshal

> **规范性：** byref 形参（元素类型记为 **A**）在 C# ↔ JavaScript 双向调用中的 Marshal 语义。
> **C#→JS：** 默认 **OpaqueValue**，细节见 [04-OPAQUE.md](./04-OPAQUE.md)。
> **JS→C#：** 本节 §3 起。

---

## 1. 适用范围

| 路径 | `ref` / `out` / `in` |
|------|----------------------|
| **C# → JS**（`GetFunction` delegate、delegate bridge） | **支持**；默认 Push **OpaqueValue** |
| **JS → C#**（普通方法 / 构造、delegate `Invoke` / `[[Call]]`） | **支持**；规则见 §3 |

**统一规则（JS→C#）：** JS 侧 **不区分** `ref` / `out` / `in`，均按同一 Pop 规则；C# 侧保留 CLR 语义（如 `in` 只读）。

下文将 C# 形参写作 `ref A` / `in A` / `out A`，**A** 为去 byref 后的元素类型。

---

## 2. C# → JavaScript

形参为 `ref` / `in` / `out A` 时，**默认** Push **OpaqueValue**（opaque handle，指向 C# 调用栈上该参数槽）。

- 脚本经 `zts.get_opaquevalue` / `zts.set_opaquevalue` 读写。
- **不** Push ByVal / ByObj exotic。
- 完整规则：[04-OPAQUE.md](./04-OPAQUE.md)。

---

## 3. JavaScript → C#：总原则

对 `ref` / `in` / `out A`，绑定层向 C# 传入 **某个 `A*`（或等价托管 byref）地址**。

| JS 实参形态 | 行为概要 | C# 写回能否反映到原 JS 值 |
|-------------|----------|---------------------------|
| **OpaqueValue**（类型兼容） | 使用 handle 地址 | **能** |
| **ByVal exotic** 且类型 **== A** | 使用 payload 地址 | **能**（写回 exotic 载荷） |
| **其它可 Pop 形态** | Pop 到 **栈临时变量**，传临时地址 | **不能** |

因此：裸 `number` / `string` / 多数 ByObj exotic 传入 `ref int` 等 **不报错**，但脚本侧原变量 **看不到** C# 写回。

```javascript
let x = 5;
CS.Demo.Increment(x);   // 拷贝进临时 int；x 仍为 5

const p = new Point2D(1, 2);   // ByVal exotic
CS.Demo.Offset(p, 10, 20);     // payload 真写回
```

---

## 4. JavaScript → C#：分支细则

按实参形态与 **A** 类别判定。类型不兼容 → **`throw Error('zts: …')`**。

### 4.1 OpaqueValue

1. 校验 handle 有效（generation / scope，[04-OPAQUE.md](./04-OPAQUE.md)）。
2. handle 元素类型与 **A** **兼容**。
3. 将 handle 地址交给 C# byref（**不**再拷贝到临时槽）。

### 4.2 A 为值类型（struct / enum 等）

| JS 实参 | 行为 |
|---------|------|
| **ByVal exotic**，类型 **== A** | 传 **payload 地址** |
| **ByVal exotic**，**A 为 `Nullable<T>`** 且 exotic 类型 **== T** | 复制到栈上 **`Nullable<T>` 临时变量**，传临时地址 |
| **其它** | by-val Pop → 临时变量 → 临时地址 |

### 4.3 A 为基元类型

| JS 实参 | 行为 |
|---------|------|
| 对应 **number** / **boolean** 等 | 复制到栈临时变量 |
| **OpaqueValue**（兼容） | §4.1 |

基元 **没有**「改 JS `let` 绑定」路径。

### 4.4 A 为 `string`

| JS 实参 | 行为 |
|---------|------|
| **`string` 的 ByObj exotic** | 托管指针 → 临时槽 |
| **JS `string`** | `new String` → 临时槽 |
| **`null`** | 临时槽 `null` |
| **`undefined`** | **throw**（必选 byref 须显式 `null` 或 Opaque/ByVal 路径） |
| **OpaqueValue** | §4.1 |

C# 对 `ref string` **重新赋值** **不** 反映到原 JS string / exotic。

### 4.5 A 为其它引用类型

| JS 实参 | 行为 |
|---------|------|
| 可 Pop 为托管对象的形态（exotic、`null` 等） | → 临时槽 → 临时地址 |
| **`undefined`** | 必选 → **throw**；`out` 经 Opaque/ByVal 除外 |
| **OpaqueValue** | §4.1 |

**临时槽** ⇒ C# **`ref` 重新绑定** **不** 反映到 JS；**可变对象原地修改** 仍可见（共享引用）。

---

## 5. `out` 与缺省 / `null` / `undefined`

| 情况 | 行为 |
|------|------|
| **`undefined`** / 省略，走 **临时槽** | 临时槽 `default(A)`；Invoke 后丢弃 |
| **ByVal exotic**（类型 == A）或 **OpaqueValue** | 绑定已有地址；`out` 写回该地址 |
| 需观察写回 | 传 **ByVal exotic** 或有效 **OpaqueValue** |

---

## 6. 桥接流程（概念）

```text
PopRefArgument(jsArg, A):
  if IsOpaqueValue(jsArg):
      CheckCompatible(opaque.ElementType, A)
      return BindRef(opaque.Address)

  if A is valuetype:
      if IsByValExotic(jsArg) && exotic.Type == A:
          return BindRef(&payload)
      if A is Nullable<T> && exotic.Type == T:
          temp = CopyToNullable()
          return BindRef(&temp)
      // fallthrough → by-val into temp

  if A is primitive:
      value = PopPrimitive(jsArg, A)  // undefined → throw if required
      temp = value
      return BindRef(&temp)

  if A is string:
      obj = PopStringAsManaged(jsArg)
      temp = obj
      return BindRef(&temp)

  obj = PopReference(jsArg, A)
  temp = obj
  return BindRef(&temp)
```

Il2Cpp / Mono：**可观察语义**须与上表一致。

---

## 7. 双向对照

| 方向 | 默认形态 | 写回 |
|------|----------|------|
| **C# → JS** | OpaqueValue | `set_opaquevalue` 或把 handle 再传入兼容 `ref A` |
| **JS → C#** | Opaque / 匹配 ByVal → 直传；其它 → 临时槽 | 仅直传地址路径 |

---

## 8. 示例

```javascript
CS.Demo.Increment(5);                    // 临时槽

const p = new Point2D(1, 2);
CS.Demo.Offset(p, 10, 20);
console.assert(p.x === 11);

function OnRefInt(h) {
    const v = zts.get_opaquevalue(h);
    zts.set_opaquevalue(h, v + 1);
    CS.Demo.IncrementOpaque(h);
}
```

---

## 9. 相关文档

| 主题 | 文档 |
|------|------|
| OpaqueValue | [04-OPAQUE.md](./04-OPAQUE.md) |
| ByVal / struct | [05-STRUCT.md](./05-STRUCT.md) |
| 引用类型 rebind | [06-CLASS.md](./06-CLASS.md) |
| 默认矩阵 / undefined | [01-OVERVIEW.md](./01-OVERVIEW.md) |
| GetFunction / delegate | [09-FUNCTION.md](./09-FUNCTION.md)、[../01-HOST-API.md](../01-HOST-API.md) |
