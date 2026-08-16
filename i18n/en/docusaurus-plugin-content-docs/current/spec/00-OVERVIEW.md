---
sidebar_position: 1
title: "总览"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`00-OVERVIEW.md`）
:::


# 00 — 总览

> ZTS 产品目标、双运行时架构、文档地图与初始化流程。
> 术语见 [GLOSSARY.md](/docs/concepts/glossary/)。

---

## 1. 产品目标

### 1.1 使用方式

ZTS 在概念上对齐 P/Invoke、`MonoPInvokeCallback`、`MarshalAs`：

| 概念 | ZTS 对应 |
|------|----------|
| P/Invoke | C# ↔ JavaScript 互调；C#→JS 经 **`GetFunction<T>`** |
| `MarshalAs` | **`[TsMarshalAs]`** — 参数 / 返回值 Marshal |
| C# 调 JS | **`TsAppDomain.GetFunction<T>`** — 取得 Delegate 后 `Invoke` |

**统一交互模型：**

- **C#→JS**：`TsAppDomain.GetFunction<T>(module, exportName)` 按 ES 模块 specifier 与导出名绑定 Delegate；调用方 `Invoke`，热路径自行缓存。
- **JS→C#**：类型 **懒注册**；首次取得类型对象时绑定成员（`CSharp[assembly][typeFullName]`，或等价的 `import { T } from "csharp:…"`，见 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11）。静态成员经类型对象，实例成员经实例 exotic object；方法调用 **`obj.Method(args)`**（无 Lua 冒号语法）。
- **代码生成**：JS→C# 桥接在 Editor 生成（Mono：Expression Emit；Il2Cpp：C++ stub + 元数据），对业务开发者透明；**C#→JS 经 `GetFunction` + Delegate 桥**，不改写用户程序集。

**深度集成：** 宿主启动时初始化 CLR 与 QuickJS（`JSRuntime` + 每域一个主 `JSContext`），加载 `zts` 标准库与 `CSharp` 根对象。

**TypeScript：** 可选编辑期工作流（[14-TYPESCRIPT.md](./14-TYPESCRIPT.md)）。运行时 **只** 加载 emit 后的 ES module；canonical specifier **不含** `.js`。

### 1.2 Player 发布优化（Il2Cpp）

| 优化 | 说明 |
|------|------|
| Native 桥接 | 热路径为 C++，不经托管 P/Invoke 逐层跳转 |
| Stub 复用 | 相同 ReducedType 签名复用桥接函数，非「每成员一个独立 C 函数」 |
| 字段 / 属性 | Il2Cpp 可走偏移 + `methodPointer` 直接访问 |
| 托管对象 | exotic object 内部槽记录对象指针；`ObjectRegistry` 槽位注册为 **GC root**，JS 侧释放句柄后解除 |

Mono（Editor）允许反射 / Emit 慢路径，但 **JS 可见语义必须与 Il2Cpp 一致**。

### 1.3 明确不支持

| 项 | 规范行为 |
|----|----------|
| **Event 专用对象** | **无** `{ get, set, fire }`；脚本使用 `add_EventName` / `remove_EventName`（与普通方法相同） |
| **属性 miss** | **`throw Error`**（`zts: member not found: {key}` 等） |
| **只写属性读** | **`throw Error`**（`zts: property has no getter: …`） |
| **实例继承运行时查找** | **无**；继承成员在 **Bind 期扁平化** 到当前类型三表（见 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §5） |
| **bigint 作为 CLR 整数** | v1 **不支持**；bigint 不得隐式映射为 `long` / `IntPtr` / enum 等 |
| **ECMAScript Proxy 分派** | 规范 **不** 要求使用 `Proxy`；属性分派经 exotic object 内部槽实现 |

### 1.4 `undefined` 与 `null`（概要）

QuickJS 同时存在 `undefined` 与 `null`，与 Lua 仅 `nil` 不同。ZTS 在边界上区分二者：

| JS 值 | 典型语义（v1 概要） |
|-------|---------------------|
| **`undefined`** | 形参缺失、对象属性不存在（**CLR 绑定 miss 除外**，miss 须 throw）、可选参数未传 |
| **`null`** | CLR **引用类型 null**、`Nullable<T>` 无值、显式空引用 |
| **两者均非** | 值类型零值（如 `0`、`false`）须用对应 JS 基元或 struct 构造 |

完整 Push/Pop、可选参数、`out` 默认、数组空洞等规则见 **[marshal/index.md](/docs/spec/marshal/)**。**禁止**在规范层将 `undefined` 与 `null` 无差别等同为「空」。

---

## 2. 双运行时架构

```
                    TsAppDomain.Initialize(moduleLoader)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            ZTS.Mono (Editor)               ZTS.Il2Cpp (Player)
            TsMonoAppDomain                 TsIl2CppAppDomain
                    │                               │
        三表 exotic 分派 / Emit 桥          libil2cpp/zts (C++)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                         同一 JS 可见语义 (spec/**)
```

| 层 | Mono | Il2Cpp |
|----|------|--------|
| 程序集 | `ZTS.Mono` | `ZTS.Il2Cpp`（薄 InternalCall 壳） |
| 互操作实现 | C# + exotic 分派 | `libil2cpp/zts/**` |
| 桥接 | 每 public 成员 Expression Emit | ReducedType stub + 生成元数据 |
| 属性分派 | 三表 + exotic internal slots | native `Dispatch*` + `MetaBinding` / `TypeRegistry` |
| 共享定义 | `ZTS.Common`：`TsMarshalAsAttribute`、`TsAliasAttribute`、`TsAppDomain` | 同左 |
| JS 引擎 | QuickJS：`JSRuntime` + 主 `JSContext` | 同左 |

**Il2Cpp 源码布局（Unity 构建）：**

- `libil2cpp/quickjs` — QuickJS 引擎源码（由包 Install 叠加）
- `libil2cpp/zts` — ZTS native 实现（来自包内 `ZTS~/zts-runtime`）

开发期可编辑参考：`build-win64/Il2CppOutputProject/IL2CPP/libil2cpp/zts`。

---

## 3. 文档地图

```
Docs/
├── GLOSSARY.md                 术语表
├── spec/
│   ├── 00-OVERVIEW.md          ← 本文件
│   ├── 01-HOST-API.md          TsAppDomain、GetFunction
│   ├── 02-TYPE-SYSTEM.md       CSharp、`csharp:` import、类型对象、构造、数组
│   ├── 04-METHOD-OVERLOAD.md   dispatch、别名、签名
│   ├── 05-LIB.md               zts.* API
│   ├── 10-LIFETIME.md          Registry、GC、异常边界
│   ├── 11-MULTI-VERSION.md     Unity / QuickJS Install、Define
│   ├── 12-MIGRATION-ADAPTORS.md  Puerts 等类型路径适配
│   ├── 13-EXTENSION-METHODS.md C# Extension 方法
│   ├── 14-TYPESCRIPT.md        TypeScript 工程、声明生成、emit
│   ├── build/                  QuickJS 构建、Mono gate、调试、原生模块
│   │   ├── 01-QUICKJS.md
│   │   ├── 03-MONO-CALLBACK-GATE.md
│   │   ├── 04-JS-DEBUGGER.md
│   │   └── 05-NATIVE-MODULES.md
│   ├── metatable/              属性分派、三表、exotic 布局
│   └── marshal/                Push/Pop、[TsMarshalAs]
├── impl/                       实现说明（不改变 JS 语义）
└── guides/                     测试、迁移
```

**阅读顺序建议：**

1. 本文件 → [01-HOST-API.md](./01-HOST-API.md)（宿主集成）
2. [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) + [metatable/index.md](/docs/spec/metatable/)（JS 如何访问 C#；推荐 `csharp:` import）
3. [marshal/index.md](/docs/spec/marshal/)（参数如何传递）
4. [04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md) + [05-LIB.md](./05-LIB.md)（重载与标准库）
5. [10-LIFETIME.md](./10-LIFETIME.md)（内存与 GC）
6. [11-MULTI-VERSION.md](./11-MULTI-VERSION.md) + [build/01-QUICKJS.md](./build/01-QUICKJS.md)（Install 与引擎构建）
7. 自 Puerts 等迁移 → [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md)；Extension → [13-EXTENSION-METHODS.md](./13-EXTENSION-METHODS.md)
8. 用 TypeScript 写业务 → [14-TYPESCRIPT.md](./14-TYPESCRIPT.md)（**不**改变 JS 语义）

**冲突裁决：** `spec/**` > Il2Cpp 源码 > `impl/**`。[14-TYPESCRIPT.md](./14-TYPESCRIPT.md) 约束编辑期工作流，**不**覆盖 JS 互操作语义。

---

## 4. 初始化流程

### 4.1 C# 入口

```csharp
TsAppDomain.Initialize(moduleName => {
    // 返回 ES module 源码 string，或 byte[] 等 loader 约定类型
    return LoadJsModule(moduleName);
});
```

`TsAppDomain` 按 `Application.isEditor` 解析后端：

- Editor → `ZTS.TsMonoAppDomain.Initialize`
- Player → `ZTS.TsIl2CppAppDomain.Initialize` → native `InitializeInternal`

初始化完成后注册 `TsFramePump`，在 Unity 帧回调中处理 pending ref 释放等 housekeeping。

### 4.2 Native / Mono 侧（概念顺序）

| 步骤 | 动作 |
|------|------|
| 1 | 创建 `JSRuntime` 与域内主 `JSContext`（**单上下文**模型，见 [10-LIFETIME.md](./10-LIFETIME.md)） |
| 2 | 注册 `zts` 标准库与内部 hook（`ZTSLib::RegisterGlobals`） |
| 3 | 初始化 Registry：`ObjectRegistry`、`TypeRegistry`、Opaque scope 等 |
| 4 | 创建全局 `CSharp` 根对象（程序集 / 类型懒加载属性分派） |
| 5 | 安装 ES module loader（`import()` / 静态 `import` 解析；**先** 拦截 `csharp:` 虚拟模块，见 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11） |
| 6 | 可选：执行 `globals.js` 等项目脚本 |

### 4.3 首次类型访问

```
import { T } from "csharp:{assembly}/{namespace}"
  → loader 拦截 csharp: → 合成模块 named export
  → 读取 export T 时解析为 CSharp[assembly][typeFullName]（同一对象）

CSharp[assemblyName]  （属性 miss → 懒创建程序集对象并缓存）

assembly[typeFullName]  （属性 miss → CLR 解析 Type，EnsureBinding）
  → 构建 STO / IEO、三表、dispatch
  → 返回类型对象并缓存
```

之后 JS 侧通过类型对象 / 实例 exotic object 访问成员，**无需**手动 Export 或 Callback 标记。

### 4.4 整域 Reset / 关闭

宿主公开 API **无** `Shutdown`；热更或清空脚本世界用 `TsAppDomain.Reset(loader)`（调用当下仅预约，本帧 **EndOfFrame** 才真正 teardown + 按 Initialize 路径重建）。内部 teardown 顺序概念上为：

1. 排空 pending JS ref 释放队列
2. `ObjectRegistry::Shutdown`、Struct registry shutdown
3. 释放主 `JSContext` / `JSRuntime`（随后重建并安装新 loader）

旧 `GetFunction` 委托在 Reset 生效后一律作废。

---

## 5. 与其它文档的边界

| 主题 | 所在文档 |
|------|----------|
| 属性分派 / 三表 / miss 语义 | [metatable/](/docs/spec/metatable/) |
| Push / Pop / ref / Opaque | [marshal/](/docs/spec/marshal/) |
| `zts.make_*` / `register_method` | [05-LIB.md](./05-LIB.md) |
| `GetFunction` 与 Delegate 桥 | [01-HOST-API.md](./01-HOST-API.md) |
| `csharp:` 类型模块 | [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11 |
| ObjectRegistry / GC root | [10-LIFETIME.md](./10-LIFETIME.md) |
| `undefined` / `null` 完整规则 | [marshal/](/docs/spec/marshal/) |
| Unity Install / QuickJS pin | [11-MULTI-VERSION.md](./11-MULTI-VERSION.md) |
| Editor Mono `JS_Throw` gate | [build/03-MONO-CALLBACK-GATE.md](./build/03-MONO-CALLBACK-GATE.md) |
| Puerts 类型路径迁移 | [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) |
| TypeScript 工作流 | [14-TYPESCRIPT.md](./14-TYPESCRIPT.md) |

---

## 6. 示例：最小脚本

```javascript
import { Demo } from "csharp:Assembly-CSharp";

const demo = new Demo();
demo.setX(10);
console.log(demo.getX());

// 显式重载（见 04-METHOD-OVERLOAD）
demo['Run(System.Int32)'](42);          // 全签名键
const run = demo['Run(System.Int32)'];
zts.register_method("run_i32", run);    // 短名后可 obj.run_i32(42)
demo.run_i32(42);

// Event：无专用对象
demo.add_ValueChanged((v) => console.log(v));
demo.remove_ValueChanged(handler);
```

低层等价（全局 `CSharp`）：

```javascript
CSharp.AC = CSharp['Assembly-CSharp'];
const Demo = CSharp.AC.Demo;
const demo = new Demo();
```

C# 侧：

```csharp
var onStart = TsAppDomain.GetFunction<Action>("main", "OnStart");
onStart();

public event Action<int> ValueChanged;
// JS: demo.add_ValueChanged((v) => { ... });
//     demo.remove_ValueChanged(handler);
```

**方法 this 绑定：**

```javascript
demo.setX(1);              // ✅ 作为方法调用，自动传入 CLR this
const fn = demo.setX;
fn(1);                     // ❌ 提取的函数不自动绑定 this；行为未定义或抛错（实现须一致且可诊断）
```

---

## 7. 与 ZLua 的对照（迁移提示）

| ZLua | ZTS |
|------|-----|
| `LuaAppDomain` | `TsAppDomain` |
| `zlua` | `zts` |
| `[LuaMarshalAs]` / `[LuaAlias]` | `[TsMarshalAs]` / `[TsAlias]` |
| `require` + 表导出 | ES `import` / `export`；CLR 类型用 **`import { T } from "csharp:…"`**；`GetFunction` 按模块 namespace |
| `obj:Method()` | `obj.Method()` |
| userdata + metatable | exotic object + internal slots |
| `__index` miss → `error` | 属性 miss → `throw Error('zts: …')` |
| Lua `nil` | 区分 `null` 与 `undefined`（见 §1.4） |
