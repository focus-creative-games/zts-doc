---
sidebar_position: 13
title: 委托与函数
description: "JS function ↔ C# Delegate 的路径、Event 与生命周期。"
---

# 委托与函数

| 路径 | 写法 | 说明 |
|------|------|------|
| **JS → C# 形参** | `obj.Foo((...) => { ... })` | 隐式 `ReadDelegate` |
| **C# → JS**（回调槽） | `handler(...)` | 可能是 **function** 或 Delegate exotic；统一用调用语法 |
| **C# 按名取 JS** | `JsAppDomain.GetFunction<T>(mod, name)` | 见 [C# 调用 JS](/docs/guides/csharp-calling-js/) |

权威：[函数 Marshal](/docs/spec/marshal/09-FUNCTION/)、[`to_delegate`](/docs/spec/05-LIB/)、[`GetFunction`](/docs/spec/01-HOST-API/)。

## 1. JS function 作为 C# 参数

```csharp
public void RegisterCallback(System.Action<int> onValue)
{
    onValue?.Invoke(42);
}
```

```javascript
host.RegisterCallback((v) => {
  console.log("callback:", v);
});
```

日常 **不必** 手写 `to_delegate`：按形参 delegate 类型自动创建 closed delegate。

| JS 实参 | 结果 |
|----------|------|
| `function` | 按形参类型创建 |
| `null` | `null` |
| `undefined` | 必选 → **throw**；可空 delegate → `null` |
| 已有 Delegate exotic | 直接传递 |
| 其它 | **throw** |

属性上挂回调同样可以：

```javascript
logic.Combine = (a, b) => a + b;
console.log(logic.Run(3, 5));
```

## 2. C# 侧回调传到 JS

从 C# 取回的回调槽 **统一** 用调用语法：

```javascript
const handler = host.GetHandler();
handler(42);
```

| 槽位来源 | `typeof handler` | 说明 |
|----------|------------------|------|
| 原生 C# delegate | Delegate exotic（可 `[[Call]]`） | `handler(...)` 即可 |
| JS function 经 C# 再传回 | **`function`** | 仍是原 JS function，**不是** exotic |

因此 **不要** 依赖 `handler.Invoke(...)`：对 function 无效，且与「往返后仍是 function」的设计不一致。

:::warning
原生 **Open delegate**（`target == null`）当前不支持。多播：仅当整条 list 可还原为 **单一** JS 源时走 function，否则 exotic。
:::

## 3. GetFunction / to_delegate

| 场景 | 做法 |
|------|------|
| 已知模块 + **命名导出** + 具体 `T` | **`JsAppDomain.GetFunction<T>`** |
| JS 侧已有 function，要指定委托类型 | `zents.to_delegate(fn, closedDelegateType)` |
| C# 形参已是具体 `Action`/`Func` | 直接传 `function` |

```csharp
var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
Debug.Log(add(10, 20));
```

- `GetFunction` 绑定 **命名导出**（非 `export default`）
- API **不保证**跨调用复用同一 delegate；**热路径由调用方缓存**
- `JsAppDomain.Reset` 生效后旧委托 **一律作废**，须重新 `GetFunction`
- `to_delegate` 第二参须为 **已闭合** 类型（如 `Action<int>`）

## 4. Event 与生命周期

无 Event 专用 Marshal；用 `add_*` / `remove_*`（见 [类型系统](/docs/spec/02-TYPE-SYSTEM/)）：

```javascript
const handler = (v) => console.log(v);
demo.add_ValueChanged(handler);
demo.remove_ValueChanged(handler);   // 须同一 function 引用
```

| 项 | 说明 |
|----|------|
| 取消订阅 | 必须是 **同一** function / 同一 delegate 身份 |
| 隐式 marshal / `to_delegate` | 登记 `funcRef`；delegate 持有 `JsMethod` |
| C# 释放 delegate | 排队释放 ref（`ProcessPendingRefReleases`） |
| JS 环境销毁后仍 Invoke | **throw** |

避免 C# 长期持有 delegate 却销毁 JS 域。详见 [生命周期](/docs/spec/10-LIFETIME/)。

## 常见错误

| 现象 | 原因 |
|------|------|
| expects delegate / throw | 非 function 且非 Delegate exotic |
| 回调未执行 | C# 未 Invoke；或 GetFunction 结果未缓存就丢弃 |
| Reset 后调用崩溃 | 未重新 `GetFunction` |
| `to_delegate` 类型不对 | 第二参不是闭合委托类型 |
| remove 无效 | 不是同一 function 引用 |

## 相关文档

- [C# 调用 JS](/docs/guides/csharp-calling-js/)
- [函数 Marshal](/docs/spec/marshal/09-FUNCTION/)
- [Host API · GetFunction](/docs/spec/01-HOST-API/)
- [生命周期](/docs/spec/10-LIFETIME/)
