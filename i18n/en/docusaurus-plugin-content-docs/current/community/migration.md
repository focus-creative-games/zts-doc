---
sidebar_position: 3
title: 迁移
description: 从其它 JS 方案迁入（用户向）。
---

# 迁移

从 **Puerts**、Unity JS 集成、其它宿主式 JS 方案迁到 ZenTS 时：先对齐 **模块加载与类型导出模型**，再替换调用点。  
**契约全文**：[12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/)（本页是用户向摘要；冲突时以 spec 为准）。

选型差异见 [特性对比](/docs/compare/FEATURES/)。

---

## 1. 目标与非目标

### 目标

| 目标 | 说明 |
|------|------|
| **降低改写量** | 旧脚本可暂时继续 `CS.UnityEngine.GameObject` / `puerts.loadType(...)` 等 **类型获取** 形态 |
| **白名单对齐旧框架** | 导出清单来自原 StaticWrapper / 生成配置 / 特性，而不是扫全量程序集 |
| **不侵入 ZenTS 核心** | 适配为可选 ES module + Editor 导出工具；**不**改 `CSharp` / `csharp:` 语义 |
| **一份 adaptor + 多方案 Export** | 共用 `adaptor.js`；Puerts 等各自 `ExportTypes.cs` 生成同构清单 |

### 非目标（明确不做）

| 项 | 说明 |
|----|------|
| **C#→JS** | `GetFunction` / `JsEnv.Eval` / `[JSFunction]` 等 **不在** adaptor 范围 → 须手改 |
| **成员调用语义对齐** | 重载、Event、`ref`/`out`、Marshal 仍以 ZenTS spec 为准；adaptor **只**解决「类型表怎么拿到」 |
| **泛型旧语法** | 如 `puerts.loadGeneric(...)` → 改写为 `zents.make_generic_type` |
| **默认安装全局** | 须显式 `import` adaptor-init；**新项目不要装 adaptor**，直接用 `csharp:` |
| **BlittableCopy / 指针模型** | 用 ZenTS exotic + Registry / `[JsMarshalAs]` |
| **CommonJS `require`** | v1 仅 **ES module** |

官方类型访问永远是：

- `CSharp[assemblyName][typeFullName]`
- `import { T } from "csharp:Assembly/…"`

adaptor 只覆盖旧框架的 **全局命名空间链**。

---

## 2. `CS.*` → `csharp:`（推荐终点）

| 阶段 | 做法 |
|------|------|
| **过渡** | 复制包内 `ZenTS~/adaptors/` 的 `adaptor.js` + 对应 `ExportTypes.cs` → 生成 `*_export_types.js` → `initAdaptor(exportTypes)` |
| **终点（新代码）** | `import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine"` |
| **低层等价** | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |

```javascript
// 过渡：adaptor 挂好 CS 后
// const go = CS.UnityEngine.GameObject;

// 终点：ZenTS 原生
import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine";
const goType = GameObject; // 与 CSharp[...] 同一类型对象
```

```javascript
// 推荐入口模块（示意）
import exportTypes from './puerts_export_types.js';
import { initAdaptor } from './adaptor.js';

initAdaptor(exportTypes);
```

部署细节与清单字段见 [spec §2–§4](/docs/spec/12-MIGRATION-ADAPTORS/)。

---

## 3. 推荐迁移流程

```text
1. 新工程接入 ZenTS（Install；Editor 跑通 js-demo / ts-demo 级冒烟）
2. 复制 ExportTypes.cs → 旧工程 Editor；菜单生成 export_types.js
3. 复制 adaptor.js + 清单到 moduleLoader 可解析目录；Initialize 后 import init
4. 业务脚本先保留 CS.* 类型路径；逐个模块改为 ES import
5. 手改：C#→JS → GetFunction；Event → add_/remove_；泛型 / ref / Marshal
6. 删除 Puerts 运行时依赖；新脚本只写 csharp:，不再扩大 adaptor 清单
7. Il2Cpp：Generate + Sync StreamingAssets；Editor 与 Player 双端冒烟
```

---

## 4. 改写清单（用户向）

| 旧习惯（Puerts 等） | ZenTS |
|---------------------|-----|
| `CS.Ns.Type` / `loadType('T')` | adaptor **或** `csharp:` / `CSharp[…]` |
| `puerts.loadGeneric(...)` | `zents.make_generic_type` |
| `JsEnv.Tick` / 帧泵 | 宿主 **`JsFramePump`**（见 Host 规范） |
| `BlittableCopy` | `[JsMarshalAs]` / 默认 Marshal |
| `require('m')` | `import` + `moduleLoader` |
| `obj:Method()`（若从 Lua 思维带来） | `obj.Method()` |
| Eval / JsFunction 回调表 | **`JsAppDomain.GetFunction<T>`** + named export |
| Event `+=` / 专用糖 | `add_Xxx` / `remove_Xxx`（同一引用） |
| 读不到成员得 `undefined` | **strict miss → throw**；改逻辑 |
| 程序集隐式默认 | ExportTypes / `csharp:` **必须写真实程序集名** |

TypeScript 官方工作流 **不** 把 `CS` 全局当作一等公民；声明走 Generate Typings 的 `csharp:` modules。见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

---

## 5. 验收（迁移是否「够用」）

| # | 标准 |
|---|------|
| 1 | `initAdaptor` 后关键 `CS.*`（或全局链）能拿到与 `CSharp[…]` / `csharp:` **同一**类型对象 |
| 2 | 未 `initAdaptor` 时无额外全局副作用 |
| 3 | C#→JS 主路径已改为 `GetFunction`，业务不再依赖 Eval 字符串拼装 |
| 4 | Event / ref / 未知成员行为符合 ZenTS guides，而非旧框架习惯 |
| 5 | Il2Cpp Player 与 Editor 冒烟一致 |

完整验收表见 [spec §9](/docs/spec/12-MIGRATION-ADAPTORS/)。

---

## 相关文档

| 文档 | 内容 |
|------|------|
| [12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/) | 适配器契约 |
| [特性对比](/docs/compare/FEATURES/) | 语义差异与检查清单 |
| [FAQ](/docs/community/faq/) | 高频问题 |
| [测试](/docs/community/testing/) | 双端冒烟与最小复现 |
