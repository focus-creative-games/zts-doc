---
sidebar_position: 1
title: 为什么选择 ZenTS
description: 更易用、更完备、与 ZLua 同构、Il2Cpp 优化 —— ZenTS 相对 Puerts / 自管 QuickJS 的选型理由。
---

# 为什么选择 ZenTS

Puerts、自管 QuickJS 已经证明「在 Unity 里用 JS/TS」可行。ZenTS 要解决的是下一层问题：**把 JS↔C# 做成真正现代、完备、且在 Il2Cpp 上足够快、足够省的互操作**——而不是再堆一套导出配置、白名单和手写绑定。

设计与 [ZLua](https://doc.zlua.cn) **同构**（门面 / Marshal / 生命周期）：会用 ZLua 即可很快上手 ZenTS；Lua 与 TS 产品可并存。

详细矩阵见 **[选型对比](/docs/compare/FEATURES/)**；迁移见 **[migration](/docs/community/migration/)**。

---

## 七个理由（30 秒）

| | 一句话 |
|--|--------|
| **更易用** | 设计贴近 C#；**零 per-type Wrap 白名单**；类型懒绑定 |
| **更完备** | 重载、ref/out、struct ByVal/ByObj、Nullable、委托、数组、指针、`[JsMarshalAs]` 等 |
| **更统一** | 与 ZLua **同一套语义契约**；Host / Marshal / Exotic 心智对齐 |
| **更高效** | Player **Il2Cpp** 热路径为 C++ 桥接；签名复用 stub |
| **更少 GC** | 引用类型与 struct 默认 Registry / ByVal；另有 Opaque 等策略 |
| **双运行时** | Editor **Mono** + 发布 **Il2Cpp Player**；JS 可见语义一致 |
| **TS 一等公民** | `TsProject`、`csharp:` 声明、进 Play 闸门；运行时只跑 emit 后的 JS |

---

## 1. 更易用：现代、简单、零配置

传统方案的心智负担往往是：

- 维护导出列表 / 生成配置
- 改 API 就要重新 Generate **海量 Wrap**
- C#→JS 走命令式 `DoString` / 临时 `eval` / 路径字符串拼装

ZenTS 把互操作做成接近 **P/Invoke** 的声明式模型：

| 你要做的事 | ZenTS |
|------------|------|
| C# 调 JS | `JsAppDomain.GetFunction<T>(module, exportName)` 取得 Delegate 后 `Invoke` |
| 覆盖 Marshal | `[JsMarshalAs]` |
| JS 访问 C# | `CSharp` 根对象懒加载，或 `import { T } from "csharp:…"` |

```csharp
// 须在 Initialize 之后（例如 Awake），勿用 static 字段初始化器
var AppAdd = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
// AppAdd(10, 20);
```

```javascript
import { Demo } from "csharp:Assembly-CSharp";
console.log(Demo.Add(3, 5));
const d = new Demo();
d.Run(10); // 实例方法：obj.Method(args)，无 Lua 冒号语法
```

**零配置**指：不需要 per-type C# Wrap 白名单与成员级 Wrap 工程。Editor 开箱即用；发 Il2Cpp Player 时执行一次 Generate（生成 **C++ stub**，不是托管 Wrap 海）。

模块 specifier **canonical 不含** `.js` / `.ts`（如 `"app"`、`"game/logic"`）。

→ [快速开始](/docs/getting-started/quick-start/) · [使用指南](/docs/guides/install/)

---

## 2. 更完备：几乎能调到的 C# 都能调

目标不是「导出几个热路径 API」，而是 **标准和完备的 C#↔JS 交互**，包括但不限于：

| 类别 | 能力 |
|------|------|
| 类型 | class / struct / interface / enum / nullable |
| 成员 | 静态与实例：字段、属性、方法 |
| 高级 | 泛型类、泛型方法、delegate、数组（含多维） |
| 语言细节 | 方法重载、`ref` / `out` / `in`、Event（`add_` / `remove_`） |
| 属性 | `[JsAlias]`、`[JsExtension]`、`[JsMarshalAs]` |

语义以 [规范](/docs/spec/00-OVERVIEW/) 为契约；双端（Mono Editor / Il2Cpp Player）**JS 可见行为一致**。

成员 miss 时 **`throw Error('zents: member not found: …')`**，不会静默返回 `undefined`。

→ [兼容性矩阵](/docs/getting-started/compatibility/) · [特性对比](/docs/compare/FEATURES/)

---

## 3. 更高效：方法论对齐 ZLua，公开数字待补齐

Il2Cpp 上的性能目标与 ZLua 相同：**去掉托管 Wrap 折返**，在 C++ 里一次完成 marshal 与 `methodPointer` 调用；相同 ReducedType 签名 **复用 stub**。

:::note 公开基准
目前 **尚无** 面向 ZenTS 的公开四方实测数字；**请勿把 ZLua 数字直接当作 ZenTS 数字**。方法论对齐 ZLua（见 [ZLua 性能对比](https://doc.zlua.cn/docs/compare/PERFORMANCE/)）；ZenTS 公开数据补齐后会更新 [选型对比](/docs/compare/FEATURES/)。
:::

:::tip
互调再快，也要先 profiling。若脚本边界只占帧时间 2%，五倍互调也只省约 1.6%。ZenTS 适合 **战斗公式、UI、每帧大量小调用** 这类边界热点。
:::

→ [选型对比 · 性能说明](/docs/compare/FEATURES/)

---

## 4. 更少更快的 GC

默认策略面向热路径：

| 策略 | 含义 |
|------|------|
| **引用类型** | 默认走 ObjectRegistry / exotic object，避免无意义装箱与临时 `object[]` |
| **struct** | 默认可走 **ByVal** / **ByObj** 等路径（见规范）；热路径面向少分配 |
| **OpaqueValue** | 临时句柄：同步调用链内更灵活的低分配策略 |
| **enum** | 默认 `number`，不强制 boxed 对象 |

需要写回时用 Opaque / ByVal exotic；裸 `number` **不回写**（与 C# `ref` 语义对齐，见 [ref/out/in](/docs/guides/ref-out-in/)）。

→ [少 GC Marshal](/docs/guides/zero-gc-marshal/) · [生命周期规范](/docs/spec/10-LIFETIME/)

---

## 5. 极小的桥接：签名复用，而非每成员一 Wrap

| 方案 | 典型体积模型 |
|------|----------------|
| Puerts / 自管 QuickJS（手写） | 常随导出成员 / 绑定代码膨胀，或靠生成物维护 |
| **ZenTS（Il2Cpp）** | **合并同签名** 桥接函数，直接生成高效 **C++** stub（ReducedType 复用） |

因此在「仍能访问几乎全部 C# 类型、字段、属性、方法」的前提下：

- 桥接代码体积通常远小于「每成员独立 Wrap」模型
- Editor（Mono）用 Expression Emit，**不进 Player 包**；Player 体积由 C++ stub 决定

→ [Il2Cpp 实现](/docs/impl/IL2CPP/)

---

## 6. 支持的 Unity、平台与 QuickJS

| 维度 | ZenTS |
|------|------|
| JS 引擎 | **QuickJS**（pin 见包内 `ZenTS~/`） |
| Unity | **2021.3**、**2022.3**、**Unity 6（6000.0 / 6000.3 / 6000.5）** |
| 引擎 | **团结引擎** |
| 运行时 | Editor **Mono** + Player **Il2Cpp** |
| Editor | **Windows**、**macOS** |
| Player | **Il2Cpp 支持的全部平台**（Win64 / Android / iOS / WebGL / 小游戏 / 鸿蒙 / 车机等） |

完整矩阵见 [兼容性](/docs/getting-started/compatibility/)。

→ [支持的版本与平台](/docs/getting-started/compatibility/)

---

## 7. 同族产品、维护积极

ZenTS 与同族方案由同一产品线演进：

| 产品 | 引擎 / 宿主 | 状态 |
|------|-------------|------|
| **ZenTS**（本站） | Unity / 团结 · C# | Alpha，本站文档覆盖 |
| **[ZLua](https://doc.zlua.cn)** | Unity / 团结 · Lua | 已发布文档站 |
| **[zts-ue](https://github.com/focus-creative-games/zts-ue)** | Unreal Engine · C++ | **开发中**；仓库见 GitHub |

- 规范、术语、Marshal / 生命周期心智可在产品间对齐（语法面与宿主不同）
- Bug 响应与特性迭代可共享方法论
- 适合把脚本互操作当作 **长期基础设施**，而不是「停更的第三方插件」

---

## 不适合选 ZenTS 的情况

诚实边界同样重要：

| 情况 | 建议 |
|------|------|
| **不愿维护 libil2cpp 集成** | 插件形态的 Puerts 或自管 QuickJS 可能更轻 |
| **强依赖 Puerts 现有导出管线 / 大量资产** | 先读 [迁移](/docs/community/migration/) 与 [12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/)，评估迁移成本 |
| **只要极少量手写绑定、无完备互操作需求** | 自管 QuickJS 可能更直接 |
| **团队只写 Lua、不需要 JS/TS** | 优先 [ZLua](https://doc.zlua.cn) |
| **宿主是 Unreal Engine** | 关注 [zts-ue](https://github.com/focus-creative-games/zts-ue)（开发中）；本站为 Unity 文档 |

---

## 下一步

1. [5 分钟快速开始](/docs/getting-started/quick-start/)
2. [特性对比](/docs/compare/FEATURES/) · [摘要](/docs/compare/SUMMARY/)
3. [规范总览](/docs/spec/00-OVERVIEW/)
4. [设计概览](/docs/concepts/design-overview/)

## 延伸阅读

| 文档 | 内容 |
|------|------|
| [设计概览](/docs/concepts/design-overview/) | GetFunction 与双向桥接 |
| [双运行时](/docs/concepts/dual-runtime/) | Mono / Il2Cpp 分工 |
| [术语表](/docs/concepts/glossary/) | Opaque / ByVal / stub 等 |
| [Il2Cpp 实现](/docs/impl/IL2CPP/) | Player 模块图 |
