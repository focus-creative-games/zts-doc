---
sidebar_position: 1
title: 特性对比
description: ZenTS 与 Puerts / 自管 QuickJS 的定性对比。
---

# 特性对比（ZenTS / Puerts / 自管 QuickJS）

:::note
本页为**选型辅助**，不是行为契约。契约以 [spec](/docs/category/spec/) 为准。
:::

> **ZenTS 状态：** Alpha；Editor Mono 与 Il2Cpp Player 主路径可用（见 [项目状态](/docs/getting-started/project-status/)）。  
> **与 ZLua：** 门面 / Marshal / 生命周期 **语义同构**（JS vs Lua 语法不同）；可同工程并存，**不是**性能对标对象。

---

## 1. 总览对照

| 维度 | ZenTS | Puerts（典型） | 自管 QuickJS |
|------|-----|----------------|--------------|
| **脚本引擎** | QuickJS（Editor 动态库 / Player 编入 Il2Cpp） | V8 / QuickJS 等视发行版 | 你选的 QuickJS 构建 |
| **类型入口** | `CSharp[asm][fullName]` 懒绑定；推荐 `import { T } from "csharp:…"` | 常 `CS.Ns.Type` / `puerts.loadType` | 手写 binding / 自研注册表 |
| **JS→C# 桥** | 懒 Bind + Mono Emit / Il2Cpp C++ MethodBridge | StaticWrap + 反射兜底等（视配置） | 手写 `JS_NewCFunction` 等 |
| **C#→脚本** | `JsAppDomain.GetFunction<T>(module, export)` | `JsEnv.Eval` / 回调表 / `[JSFunction]` 等 | 自研 eval / 函数句柄 |
| **白名单** | **无** per-type C# Wrap 白名单；public + 懒 Bind；Il2Cpp 靠 **Generate stub** | 常需 Binding / StaticWrapper 列表 | 你维护的导出表 |
| **与 ZLua 心智** | **同构**（`GetFunction` / Marshal / strict miss / Event 形态） | 不同 | 无 |
| **TypeScript** | 官方 `TsProject` + `csharp:` 声明 + Play 闸门 | 视方案 / 社区模板 | 自建 tsc / 声明 |
| **Editor vs Player** | **双轨**：Mono Emit vs Il2Cpp native；**JS 可见语义须一致** | 通常更接近「同一套插件」 | 取决于你的双端策略 |
| **Il2Cpp** | 官方 `zents-runtime` 嵌入 libil2cpp | 有成熟路径 | 自建 |
| **Event** | **无**专用对象 → `add_` / `remove_` | 常有更接近 C# 的订阅糖 | 自定 |
| **完备互操作** | 重载 / ref / struct ByVal… 按 spec | 视版本与配置 | 视实现 |

---

## 2. 类型访问

### 2.1 语法对照（同一类型 `MyGame.Demo`）

| 方案 | 典型写法 |
|------|----------|
| **ZenTS（原生）** | `CSharp['Assembly-CSharp']['MyGame.Demo']` |
| **ZenTS（`csharp:`）** | `import { Demo } from "csharp:Assembly-CSharp/MyGame"` |
| **Puerts** | `CS.MyGame.Demo` 或 `puerts.loadType('MyGame.Demo')` |
| **自管 QuickJS** | 你注册的全局 / 模块导出 |

**ZenTS 规则要点：**

- 含 **命名空间** 须括号键整段 `typeFullName`，禁止 `CSharp.AC.MyGame.Demo` 链式穿越 namespace。
- 嵌套类型用 `+`：`CSharp.AC['Outer+Inner']`。
- `csharp:` named export 与 `CSharp[asm][fullName]` **同一类型对象 identity**。
- 迁移期可用 adaptor 继续写 `CS.*`（见 [迁移](/docs/community/migration/)）；**新脚本优先 `csharp:`**。

详见 [JS 调用 C#](/docs/guides/js-calling-csharp/)、[spec/02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/)。

### 2.2 白名单 vs 懒绑定

| 方案 | 模型 | 工程影响 |
|------|------|----------|
| Puerts（典型） | 导出 / StaticWrap 白名单决定可访问类型 | 未导出则不可调；改 API 常要重生 Wrap |
| 自管 QuickJS | 手写或生成绑定列表 | 完全可控，完备度靠人力 |
| **ZenTS** | 首次访问类型时 **EnsureBinding**；**无** per-type 托管 Wrap 白名单 | Editor 开箱；Player 须 **`ZenTS/Generate/All`**（C++ stub，不是 C# Wrap 海） |

敏感 API：应用 **非 public** 收口，而不是依赖「没进导出列表」。

### 2.3 并行示例：取类型并调静态方法

```javascript
// ZenTS — csharp:（推荐）
import { Demo } from "csharp:Assembly-CSharp/MyGame";
console.log(Demo.Add(1, 2));

// ZenTS — CSharp 根表
const Demo2 = CSharp['Assembly-CSharp']['MyGame.Demo'];
console.log(Demo2.Add(1, 2));

// Puerts 风格（旧工程；ZenTS 上需 adaptor 或改写）
// const sum = CS.MyGame.Demo.Add(1, 2);
```

```typescript
// ZenTS — TypeScript（编辑期；运行时仍是 emit 后的 JS）
import { Demo } from "csharp:Assembly-CSharp/MyGame";

export function addDemo(a: number, b: number): number {
  return Demo.Add(a, b);
}
```

---

## 3. 成员调用（脚本 → C#）

### 3.1 静态 / 实例

| 方案 | 静态 | 实例 |
|------|------|------|
| ZenTS | `Demo.Add(1, 2)` | `obj.GetX()`（**点号**；无 Lua 冒号） |
| Puerts | `CS.Demo.Add(1, 2)` | `obj.GetX()` |
| 自管 | 视绑定 | 视绑定 |

ZenTS：静/实例元数据分离；继承成员在 **Bind 期扁平化**；未知成员 **strict miss** → `throw Error('zents: …')`，**不**静默 `undefined`。

### 3.2 方法重载

| 方案 | 策略 |
|------|------|
| Puerts | Wrap / 运行时分派（视版本） |
| 自管 | 自定 |
| **ZenTS** | Bind 期注册；默认最佳匹配；`[JsAlias]` / 显式绑定见 [重载](/docs/guides/overloads/) |

### 3.3 `__index` / 属性 miss

| 方案 | 不存在成员 |
|------|------------|
| Puerts | 常 `undefined` 或错误（视路径） |
| 自管 | 视实现 |
| **ZenTS** | 读 / 写未知键均 **throw**（与 ZLua 同构的严格策略） |

---

## 4. C# → 脚本

### 4.1 入口对照

| 方案 | C# 调脚本 | 脚本函数 → C# delegate |
|------|-----------|------------------------|
| **ZenTS** | `JsAppDomain.GetFunction<T>("app", "add")` | 形参隐式 marshal（`Action`/`Func` 等） |
| Puerts | `JsEnv.Eval` / 模块回调 / 特性 | `JsFunction` 等 |
| 自管 | 自研 | 自研 |

**ZenTS `GetFunction` 示例：**

```csharp
// 须在 Initialize 之后（例如 Awake）；勿放 static 字段初始化器
var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
int sum = add(10, 20);

var onTick = JsAppDomain.GetFunction<Action<float>>("game/logic", "OnTick");
onTick(0.016f);
```

```javascript
// JsScripts/app.js 或 TsProject emit 产物 — named export
export function add(a, b) {
  return a + b;
}
```

- Editor / Player：**同一 API**；热路径请缓存 delegate。
- `jsModule` 为 **canonical**（不含 `.js` / `.ts`）；**不要**对 `csharp:` 模块 `GetFunction`。
- 详见 [C# 调用 JS](/docs/guides/csharp-calling-js/)。

### 4.2 模块加载

| 方案 | 加载 |
|------|------|
| ZenTS | `JsAppDomain.Initialize(moduleLoader)` + ES module；`csharp:` 由运行时拦截 |
| Puerts | 自有 loader / require 习惯（视版本） |
| 自管 | 自定 |

Player 读 StreamingAssets（`Js/` 或 `ZenTS/`），不是工程旁源目录——见 [构建](/docs/guides/build/)。

---

## 5. Event、ref、struct

### 5.1 Event

| 方案 | 订阅方式 |
|------|----------|
| Puerts | 常有接近 C# 的 `+=` / 专用 API（视版本） |
| **ZenTS** | **无** Event 专用对象；`obj.add_OnX(fn)` / `obj.remove_OnX(fn)`；remove 须 **同一 function 引用** |
| ZLua（同构） | 同样 `add_` / `remove_` |

```javascript
function onChanged(v) {
  console.log("hp", v);
}
obj.add_OnHpChanged(onChanged);
obj.remove_OnHpChanged(onChanged); // 必须是同一引用
```

### 5.2 ref / out / in

| 主题 | ZenTS |
|------|-----|
| C#→JS（`GetFunction`） | byref 默认 **OpaqueValue**；用 `zents.get_opaquevalue` / `set_opaquevalue` |
| JS→C# | 不按关键字区分；**裸 number 不写回**；同型 ByVal exotic / Opaque 可写回 |
| Opaque 生命周期 | **不可**跨帧 / 跨异步当长期句柄 |

与 ZLua 的 Opaque / ByVal 故事同构；语法是 JS API。见 [ref/out/in](/docs/guides/ref-out-in/)。

### 5.3 struct

| 主题 | ZenTS 要点 |
|------|----------|
| 传参 / 返回 | ByVal exotic 拷贝 或 ByObj boxed（见 [值类型](/docs/guides/value-types/)） |
| 与 Puerts BlittableCopy | **不对等**；用 `[JsMarshalAs]` / 默认 Marshal，勿假设指针模型 |
| 自管 QuickJS | 常需自写 struct 装箱策略 |

---

## 6. TypeScript 工作流

| 维度 | ZenTS | Puerts（典型） | 自管 |
|------|-----|----------------|------|
| 运行时 | **只跑 emit 后的 JS（ESM）** | 视方案 | 自建 |
| 官方工程 | `ZenTS/Init TypeScript Project` → `TsProject/` | 社区 / 自建 | 自建 |
| C# 类型声明 | **`ZenTS/Generate Typings`** → `csharp:` modules | 视工具链 | 手写 `.d.ts` |
| 进 Play | 可选 **`tsc --noEmit` 闸门**，失败阻止 Play | 视项目 | 自定 |
| 发布 | emit（**禁止 bundle**）→ StreamingAssets | 视方案 | 自定 |

```typescript
// TsProject/src/game/logic.ts
import { Demo } from "csharp:Assembly-CSharp";

export function OnTick(dt: number): void {
  const demo = new Demo();
  demo.SetX(10);
}
```

权威：[TypeScript 工作流](/docs/guides/typescript-workflow/)、[spec/14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)。

---

## 7. Editor / Player 与生成

| 方案 | 双端 | 发布前「生成」 |
|------|------|----------------|
| Puerts | 通常插件路径较统一 | StaticWrap / 配置 Generate |
| 自管 | 自定 | 自定 |
| **ZenTS** | Mono（Editor）vs Il2Cpp（Player）实现不同、**语义须一致** | Il2Cpp：**`ZenTS/Generate/All`**（C++ stub）；**C#→JS 无 codegen** |

测试要求：关键路径在 Editor 与 Il2Cpp Player **各验一次**。见 [Editor 与 Player](/docs/guides/editor-vs-player/)、[社区测试](/docs/community/testing/)。

---

## 8. 侵入性与维护

```text
浅 ←────────────────────────────────────────→ 深（Il2Cpp 侵入）

自管 QuickJS（纯插件 + 手写桥）
  Puerts（插件 + native / Wrap）
    ★ ZenTS Player（嵌入 libil2cpp + zents-runtime）
```

| 层级 | ZenTS | Puerts | 自管 |
|------|-----|--------|------|
| 修改 libil2cpp | **是**（Player，经 Install） | 视发行版 | 通常否 |
| 独立 native | Editor：quickjs 动态库；Player：编入 | 常见 | 常见 |
| 维护焦点 | Unity 版本 + Install/Generate + QuickJS pin | 包版本与导出配置 | 绑定完备度与升级 |

---

## 9. 性能（诚实边界）

| 项 | 状态 |
|----|------|
| 公开四方实测表 | **暂无** → **本页不写 ns / 倍数** |
| 建议 | 热路径在 **Il2Cpp Player** 自测；Editor 数字勿当发版依据 |
| 参考方法论 | [ZLua PERFORMANCE](https://doc.zlua.cn/docs/compare/PERFORMANCE/)（Lua 方案，**不可**直接引用为 ZenTS 结果） |

完备互操作与懒绑定的取舍，见 [为什么选择 ZenTS](/docs/concepts/why-zents/)。

---

## 10. 迁移检查清单（选型用）

从 Puerts / 自管迁到 ZenTS 前，逐项确认：

| 项 | 说明 |
|----|------|
| □ 类型访问 | `CS.*` / `loadType` → `csharp:` 或 `CSharp[…]`；或装 **adaptor**（只解决类型路径） |
| □ C#→JS | Eval / JsFunction → **`GetFunction` + named export**（**不在** adaptor 范围） |
| □ Event | 糖语法 → `add_` / `remove_` |
| □ 实例调用 | 确认无冒号习惯；提取方法会丢 this |
| □ ref / struct | 按 ZenTS Opaque / ByVal 改写，勿假设 BlittableCopy |
| □ 泛型 | `loadGeneric` 等 → `zents.make_generic_type` |
| □ 模块 | CommonJS `require` → ES `import` + `moduleLoader` |
| □ TS | 启用 `TsProject`；禁止 bundle；Generate Typings 与 Generate **同源** |
| □ Player | Install → **Generate** → Sync/拷贝 StreamingAssets |
| □ 严格 miss | 依赖「读不到成员得 `undefined`」的代码会炸 → 显式存在性检查 / 改 API |

用户向步骤：[迁移](/docs/community/migration/)；契约：[12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/)。

---

## 11. 同一示例三列对照

**需求：** 调用 `MyGame.Demo.Add(1, 2)`，创建实例并读字段 `x`。

```javascript
// ——— ZenTS（推荐 csharp:）———
import { Demo } from "csharp:Assembly-CSharp/MyGame";
const sum = Demo.Add(1, 2);
const obj = new Demo();
const x = obj.x;

// ——— ZenTS（CSharp 根表）———
// const Demo = CSharp['Assembly-CSharp']['MyGame.Demo'];
// const sum = Demo.Add(1, 2);
// const obj = new Demo();
// const x = obj.x;

// ——— Puerts 风格（须 adaptor 或改写后才能在 ZenTS 跑）———
// const Demo = CS.MyGame.Demo;
// const sum = Demo.Add(1, 2);
// const obj = new Demo();
// const x = obj.x;
```

```typescript
// ——— ZenTS TypeScript（emit 后同上）———
import { Demo } from "csharp:Assembly-CSharp/MyGame";

export function sample(): number {
  const sum = Demo.Add(1, 2);
  const obj = new Demo();
  return sum + obj.x;
}
```

---

## 12. 选型摘要

| 更适合 | 方案 |
|--------|------|
| JS/TS + 完备互操作 + Il2Cpp，愿维护 Install/Generate，要与 ZLua 同构心智 | **ZenTS** |
| 已有大型 Puerts 资产、短期要少改类型路径 | **渐进迁移**（adaptor + 人工改 C#→JS / Event / Marshal） |
| 极薄嵌入、API 面极小、团队能自研桥 | **自管 QuickJS** |
| 产品语言是 Lua | **[ZLua](https://doc.zlua.cn)** |

一句话导航见 [选型摘要](/docs/compare/SUMMARY/)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [SUMMARY](/docs/compare/SUMMARY/) | 阅读顺序与诚实边界 |
| [为什么选择 ZenTS](/docs/concepts/why-zents/) | 产品叙事 |
| [迁移](/docs/community/migration/) | 用户向迁移 |
| [spec/00-OVERVIEW](/docs/spec/00-OVERVIEW/) | 行为契约入口 |
