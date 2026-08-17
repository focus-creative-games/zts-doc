---
sidebar_position: 90
title: 术语表
description: ZenTS / ZLua 对齐术语（从 ZenTSTest Docs/GLOSSARY 同步）。
---

:::note 文档站副本
术语表上游为 `ZenTSTest/Docs/GLOSSARY.md`；修改后执行 `npm run sync-spec`。
:::

# 术语表（GLOSSARY）

> 规范性术语以本表为准；实现细节见「实现落点」列。

## 核心架构

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ZenTS** | 产品名（曾用名 ZTS）。Unity 下 C# 与 JavaScript（QuickJS）互操作框架；Editor 用 Mono，Player 用 Il2Cpp | `Packages/com.code-philosophy.zen-ts` |
| **zents** | 代码小写标识：JS 标准库 `zents.*`、错误前缀 `zents:`、native 目录 `libil2cpp/zents` | [05-LIB.md](/docs/spec/05-LIB/) |
| **zen-ts** | Unity 包 / GitHub 仓库名；官网 [zen-ts.com](https://zen-ts.com) | [focus-creative-games/zen-ts](https://github.com/focus-creative-games/zen-ts) |
| **JS 可见语义** | 脚本侧可观察的行为契约；Mono 与 Il2Cpp **必须一致** | `spec/**` |
| **双运行时** | `ZenTS.Mono`（Editor）+ `ZenTS.Il2Cpp`（Player）；门面 `JsAppDomain` | [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) |
| **libil2cpp/zents** | Player 侧 native 实现根目录 | `build-win64/.../libil2cpp/zents` |
| **GetFunction** | C#→JS：`JsAppDomain.GetFunction<T>` 按 ES 模块与导出名绑定 Delegate | [01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **MethodBridge** | JS→C# 方法桥；Il2Cpp 按 ReducedType 复用 stub；Mono 每成员 Emit | `impl/codegen/` |
| **QuickJS** | 嵌入式 JS 引擎；每域 `JSRuntime` + 一个主 `JSContext` | [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) §2 |
| **Exotic object（异质对象）** | 带内部槽（internal slots）的 JS 对象，用于类型门面与 CLR 实例；**不**要求 ECMAScript `Proxy` | [metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) |

## 类型与命名

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **`CSharp` 根对象** | 全局对象；属性 miss 时懒加载程序集 → 类型；权威低层入口 | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §2 |
| **`csharp:` 虚拟模块** | 保留 specifier 前缀；`import { T } from "csharp:{assembly}/{namespace}"` 与 `CSharp[assembly][typeFullName]` **同一类型对象** | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §2.11 |
| **类型对象（typeObject）** | `CSharp[assembly][typeFullName]` 或 `csharp:` named export 解析得到的静态门面 exotic object | §3.1 |
| **`typeFullName`** | CLR 全名；namespace 用 `.`；嵌套类型用 `+` | §2.3 |
| **typeArg** | `zents` API 中描述 C# 类型的实参：类型对象 / `zents.types.*` / mscorlib 字符串 | `spec/05-LIB.md`§3 |
| **门面（view）** | 实例 exotic object 对外暴露的**声明类型**；可与运行时具体类型不同 | `spec/marshal/06-CLASS.md` |
| **`__typeid`** | 闭合泛型、数组等无法仅凭字符串反查的类型 id | TypeRegistry |
| **Intern** | 相同 `make_*_type` 实参多次调用返回同一类型对象 | TypeRegistry |

## 属性分派（metatable 目录）

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **静态类型 exotic（STO）** | 类型对象上的静态成员分派载体；等价 ZLua SMT 职责 | [metatable/01-LAYOUT.md](/docs/spec/metatable/01-LAYOUT/) |
| **实例 exotic（IEO）** | CLR 实例 exotic object 上的实例成员分派载体；等价 ZLua IMT 职责 | 同上 |
| **三表分派** | `methodTable` / `fieldGetterTable` / `fieldSetterTable` 属性读写分派 | [metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **属性 miss** | 未注册成员 → **`throw Error`**（`zents: member not found: …`；禁止反射 fallback，禁止静默 `undefined`） | [metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) |
| **只写属性读 miss** | setter 存在但 getter 不存在 → `zents: property has no getter: …` | 同上 |
| **Bind 期扁平化** | 继承链 public 成员在 `EnsureBinding` 时写入当前类型三表；**无**运行时向上查找 | [02-TYPE-SYSTEM.md](/docs/spec/02-TYPE-SYSTEM/) §5 |
| **dispatch closure** | 多重重载时默认方法名绑定的运行时分派函数 | `spec/04-METHOD-OVERLOAD.md` |
| **direct method function** | 单重重载、全签名键或别名绑定的桥接函数 | MetaBinding |
| **全签名键** | 同名多候选时自动挂的 `Name(Type.FullName,…)` direct 键（不含返回类型） | `spec/04-METHOD-OVERLOAD.md` §3.7 |
| **方法调用 this 绑定** | `obj.Method(args)` 作为方法调用时自动传入 CLR `this`；**提取**的 `const fn = obj.Method; fn(args)` **不**自动绑定 | [metatable/02-INDEX.md](/docs/spec/metatable/02-INDEX/) §3 |

## Marshal 形态

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ByVal handle** | 值类型 payload 内嵌于 exotic object 内部槽（struct 拷贝语义） | `spec/marshal/05-STRUCT.md` |
| **ByObj handle** | 托管引用 / boxed 值经 `ObjectRegistry` 的 exotic object | `spec/marshal/06-CLASS.md` |
| **OpaqueValue** | 无属性分派的临时 native 句柄（`ref`/`in`/`out` 或显式标注） | `spec/marshal/04-OPAQUE.md` |
| **StructHandle** | struct 在 C#→JS 默认路径上的 opaque 句柄（同步调用链内有效） | 同上 + struct 分册 |
| **ReducedType** | Il2Cpp 桥接按简化签名复用 stub 的键；Mono 不做此复用 | `impl/codegen/` |
| **`undefined` vs `null`** | `undefined` 表示「未传 / JS 缺失」；`null` 表示 CLR 引用 null 或 Nullable 无值；细节见 marshal 分册 | [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) §1.4；`spec/marshal/` |
| **bigint** | v1 **不支持**作为 CLR 整数通道；脚本侧 bigint 不得隐式映射为 `long`/`IntPtr` 等 | [00-OVERVIEW.md](/docs/spec/00-OVERVIEW/) §1.3 |

## Registry 与生命周期

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **ObjectRegistry** | ByObj exotic object 槽位 + `(identity, view)` 弱缓存 + GC root | `spec/10-LIFETIME.md` |
| **StructRegistry** | non-blittable struct handle 拷贝与 GC 扫描 | 同上 |
| **OpaqueParameterScope** | C# 调 JS 期间 opaque handle 的 generation 域 | OpaqueValueMarshal |
| **单 `JSContext`** | 宿主默认每域一个主上下文；跨线程须遵循帧泵 / 同步规则 | `spec/10-LIFETIME.md` §4 |

## 宿主 API

| 术语 | 含义 | 实现落点 |
|------|------|----------|
| **`GetFunction<T>`** | C#→JS 正式入口；返回 `MulticastDelegate`；调用方负责缓存 | [01-HOST-API.md](/docs/spec/01-HOST-API/) |
| **`[JsMarshalAs]`** | 参数 / 返回值 / 字段 / 属性的 Marshal 标注 | `spec/marshal/02-MARSHAL-AS.md` |
| **`[JsAlias]`** | 为方法追加最终 JS 名；可与默认名/其它别名重复，按名分组进 overload | `spec/04-METHOD-OVERLOAD.md` §5 |
| **Delegate 桥** | C#→JS 调用路径：`GetFunction` 绑定导出函数为 closed delegate 后 `Invoke` | `spec/marshal/09-FUNCTION.md` |
| **ES module** | 脚本模块单位；`GetFunction` 的 `jsModule` 为 **canonical specifier**（**不含** `.js` / `.ts`）；`csharp:` 为 ZenTS 保留的类型模块 scheme | [01-HOST-API.md](/docs/spec/01-HOST-API/) §1.3；[14-TYPESCRIPT.md](/docs/spec/14-TYPESCRIPT/) |
| **TsProject** | 工程根下的 TypeScript 源码与生成声明目录；emit 到 `out/`，运行时不读 `.ts` | [14-TYPESCRIPT.md](/docs/spec/14-TYPESCRIPT/) |

## 明确不支持（rewrite 规则）

| 术语 | 含义 |
|------|------|
| **Event 专用对象** | **无** `{ get, set, fire }` 子对象；使用 `add_EventName` / `remove_EventName` 普通方法 |
| **运行时继承 promotion** | 实例成员 **不在** 属性 miss 时沿链查找并缓存；改为 Bind 期扁平化 |
| **Lua 冒号语法** | **无** `obj:Method()`；统一 `obj.Method(args)` |
| **Proxy 作为分派机制** | 规范不要求、不依赖 ECMAScript `Proxy`；实现使用 exotic object 内部槽 |
| **bigint → CLR 整数** | v1 不支持 |

## 文档缩写

| 缩写 | 路径 |
|------|------|
| SPEC | `Docs/spec/**` |
| IMPL | `Docs/impl/**` |
| MT | `Docs/spec/metatable/**` |
| MAR | `Docs/spec/marshal/**` |
