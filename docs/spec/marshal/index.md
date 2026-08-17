---
sidebar_position: 17
title: "Marshal 规范（`spec/marshal/`）"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`marshal\index.md`）
:::


# Marshal 规范（`spec/marshal/`）

> **规范性：** C# ↔ JavaScript 值在 QuickJS 边界上的形态与转换规则。
> **实现：** → `impl/marshal/`（不改变 JS 可见语义）。

## 本目录

| 文件 | 内容 |
|------|------|
| [01-OVERVIEW.md](./01-OVERVIEW.md) | 默认 Marshal 矩阵、`undefined`/`null`、number、数组摘要、引用门面摘要 |
| [02-MARSHAL-AS.md](./02-MARSHAL-AS.md) | `[JsMarshalAs]`、`JsMarshalType`、合法集合、Object/Unpacked/Bytes/Opaque、**XML 外部配置** |
| [03-BYREF.md](./03-BYREF.md) | `ref` / `in` / `out`（C#→JS OpaqueValue；JS→C#：Opaque/ByVal 直传地址，其余临时槽） |
| [04-OPAQUE.md](./04-OPAQUE.md) | OpaqueValue、`get_opaquevalue` / `set_opaquevalue`、生命周期、回传分流 |
| [05-STRUCT.md](./05-STRUCT.md) | struct ByVal / ByObj / Handle、`box`/`unbox` |
| [06-CLASS.md](./06-CLASS.md) | class / interface / 声明类型门面 |
| [07-ARRAY.md](./07-ARRAY.md) | szarray / mdarray / `Bytes` |
| [08-ENUM.md](./08-ENUM.md) | 默认 number + `zents.box` |
| [09-FUNCTION.md](./09-FUNCTION.md) | Delegate ↔ JS function |
| [10-POINTER.md](./10-POINTER.md) | `T*`、函数指针、不支持类型 |

## 阅读顺序

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)** — 默认行为总表与 `undefined`/`null`
2. **[02-MARSHAL-AS.md](./02-MARSHAL-AS.md)** — 何时覆盖默认、如何配置 Object/Unpacked/Params
3. **按类型深入：** [05-STRUCT](./05-STRUCT.md) / [06-CLASS](./06-CLASS.md) / [07-ARRAY](./07-ARRAY.md) / [08-ENUM](./08-ENUM.md) / [09-FUNCTION](./09-FUNCTION.md)
4. **双向 byref 分叉：** JS→C# → [03-BYREF.md](./03-BYREF.md)；C#→JS → [04-OPAQUE.md](./04-OPAQUE.md)

## 交叉引用

| 主题 | 其它 spec |
|------|-----------|
| `CSharp` 类型对象、构造入口 | [../02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) |
| 重载与实参匹配 | [../04-METHOD-OVERLOAD.md](../04-METHOD-OVERLOAD.md) |
| `zents.box` / `unbox` / `cast` / `get_opaquevalue` / `set_opaquevalue` | [../05-LIB.md](../05-LIB.md) |
| 属性分派 / 三表（非 Marshal） | [../metatable/](/docs/spec/metatable/) |

## 平台原则

- **Mono（Editor）与 Il2Cpp（Player）的 JS 可见 Marshal 语义一致**；差异仅在 `impl/` 层。
- **无 Event 专用支持**；使用 `add_*` / `remove_*` 普通方法（见 [../00-OVERVIEW.md](../00-OVERVIEW.md) §1.3）。
- **v1 禁止 bigint 作为 CLR 整数通道**；整型基元与 enum 均经 **`number`**（见 [01-OVERVIEW.md](./01-OVERVIEW.md) §3）。
