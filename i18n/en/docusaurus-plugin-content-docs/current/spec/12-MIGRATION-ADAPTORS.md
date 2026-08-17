---
sidebar_position: 12
title: "迁移适配（Puerts / 其它 JS 方案）"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`12-MIGRATION-ADAPTORS.md`）
:::


# 12 — 迁移适配（Puerts / 其它 Unity JS 方案）

> 为从 **Puerts**、**Unity JavaScript Integration**、**Jint 宿主模式** 等迁到 ZenTS 的项目提供 **JavaScript→C# 类型访问路径** 兼容层。
> 本适配 **不** 改变 ZenTS 核心语义。官方类型访问是 **`CSharp[assemblyName][typeFullName]`** 与等价的 **`import { T } from "csharp:…"`**（见 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11）。adaptor 只覆盖旧框架的 **全局命名空间链**（如 `CS.UnityEngine.GameObject`），**不是** `csharp:` 模块的替代实现。
> 实现交付物位于包内 **`ZenTS~/adaptors/`**（本文为契约）。

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|------|------|
| **降低改写量** | 旧脚本可继续写 `CS.UnityEngine.GameObject` / `puerts.loadType('UnityEngine.GameObject')` 等 **类型获取** 形态 |
| **白名单对齐旧框架** | 导出清单来自原方案的 **StaticWrapper / 生成配置 / 特性**，而非扫全量程序集 |
| **不侵入 ZenTS 核心** | 适配为可选 ES module + 一次性 Editor 导出工具；**不**修改 `CSharp` / `csharp:` 语义 |
| **一份 adaptor + 多方案 Export** | 共用 `adaptor.js`；Puerts / 其它方案各自 **`ExportTypes.cs`** 生成同构清单 |

### 1.2 非目标（本阶段明确不做）

| 项 | 说明 |
|----|------|
| **C#→JS** | **`GetFunction`** / Puerts **`JsEnv.Eval`** / `[JSFunction]` 等 **不在** 适配范围 |
| **成员调用语义对齐** | 重载、Event、`ref`/`out`、Marshal 等仍以 ZenTS spec 为准；适配只解决 **类型表如何拿到** |
| **泛型构造语法兼容** | 如 Puerts `puerts.loadGeneric(typeof(List), typeof(int))` → 须改写为 **`zents.make_generic_type`**（见 [05-LIB.md](./05-LIB.md)） |
| **把适配做成 ZenTS 默认全局** | 须开发者显式 `import './adaptor-init.js'`；**不**随 `zentslib.js` 自动安装。新脚本用 **`csharp:` import**（[02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11），不要为新项目装 adaptor |
| **模拟 Puerts BlittableCopy / 指针模型** | ZenTS 使用 **exotic object** + **`ObjectRegistry`**；见 [marshal/](/docs/spec/marshal/) |
| **CommonJS `require`** | v1 仅 **ES module**；adaptor 本身为 module |

### 1.3 访问形态对照

以 `UnityEngine.CoreModule.dll` 中的 `UnityEngine.GameObject` 为例：

| 方案 | 获取类型 |
|------|----------|
| **ZenTS（`CSharp`）** | `CSharp['UnityEngine.CoreModule']['UnityEngine.GameObject']` |
| **ZenTS（`csharp:` import）** | `import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine"` |
| **Puerts（typical）** | `CS.UnityEngine.GameObject` 或 `puerts.loadType('UnityEngine.GameObject')` |
| **xLua 系（若脚本复用）** | `CS.UnityEngine.GameObject` |
| **手写全局** | `UnityEngine.GameObject`（命名空间链） |

适配层把 Puerts / 全局链等 **重定向** 到 ZenTS 原生路径（`CSharp[...]`，与 `csharp:` import **同一** 类型对象）。差异由清单中的 **`top_namespace` / `export_name`** 表达，**不**再拆多份 adaptor 逻辑。**新脚本**优先 `csharp:` import，不必安装 adaptor。

---

## 2. 交付物与部署模型

### 2.1 包内权威源（只读模板）

```
Packages/com.code-philosophy.zen-ts/ZenTS~/adaptors/
├── README.md
├── adaptor.js                  -- 唯一 JS 适配实现（ES module）
├── puerts/
│   └── ExportTypes.cs          -- 菜单 ZenTS/ExportTypes（Puerts 工程用）
├── unity-js/
│   └── ExportTypes.cs          -- Unity 官方 JS 集成工程用（可选）
└── legacy-global/
    └── ExportTypes.cs          -- 仅全局命名空间链（无 CS 根）
```

### 2.2 开发者侧部署（必须复制）

| 文件 | 部署方式 |
|------|----------|
| `adaptors/adaptor.js` | 复制到 **`moduleLoader` 可解析** 的业务目录 |
| `adaptors/{方案}/ExportTypes.cs` | 复制到对应旧框架工程的 **Editor** 目录 |
| 生成的 `*_export_types.js` | 菜单生成后放入业务目录（建议纳入版本库） |

### 2.3 推荐入口模块

```javascript
import exportTypes from './puerts_export_types.js';
import { initAdaptor } from './adaptor.js';

initAdaptor(exportTypes);
```

或通过 **`moduleLoader`** 在宿主启动时 **`import './zents-adaptor-init.js'`**。

---

## 3. 导出清单格式（`export_types`）

### 3.1 唯一形状

```javascript
export default {
  top_namespace: 'CS',  // 可选；缺省 / "" / null → 挂到 globalThis
  types: {
    'UnityEngine.CoreModule': [
      { full_name: 'UnityEngine.GameObject' },
      { full_name: 'UnityEngine.Transform' },
    ],
    'Assembly-CSharp': [
      { full_name: 'Demo.Foo' },
      { full_name: 'Bar' },
      { full_name: 'Ns.Outer+Inner', export_name: 'Ns.Outer.Inner' },
    ],
  },
};
```

| 字段 | 说明 |
|------|------|
| `top_namespace` | **单段** 根名（如 `"CS"`）。省略则根为 **`globalThis`**。**禁止** 多段（如 `Foo.Bar`） |
| `types` | 程序集名 → **条目数组** |
| `full_name` | CLR `Type.FullName`（嵌套用 `+`），用于 `CSharp[asm][full_name]` |
| `export_name` | 相对根的 **点号路径**（**不含** `top_namespace`）。省略时等价 **`full_name` 的 `+`→`.`** |

### 3.2 各方案如何填写（ExportTypes 职责）

| 方案 | `top_namespace` | `export_name` 默认规则 |
|------|-----------------|------------------------|
| **Puerts** | `"CS"` | `FullName` 的 `+`→`.`；若 `StaticWrap` 使用短别名则写 `export_name` |
| **xLua 系脚本** | `"CS"` | 同 Puerts |
| **Unity JS / 全局链** | 省略 | `FullName` 的 `+`→`.`（`UnityEngine.GameObject`） |
| **Puerts `loadType('T')` only** | 可省略 | 每条 `full_name` = loadType 字符串；`export_name` 为 JS 侧曾用的短路径 |

### 3.3 导出范围（硬约束）

| 方案 | 扫描源 |
|------|--------|
| **Puerts** | `Configure` / 生成目录中的 **StaticWrap** 类型列表；或 `[Binding]` 特性覆盖集 |
| **Unity JS** | 工程声明的绑定类型表 |
| **Legacy global** | 手工维护列表或从旧 JSON 转换 |

**禁止** 默认扫全量 public 类型作为主路径。

### 3.4 MVP 类型范围

| 包含 | 不包含（本阶段） |
|------|------------------|
| 白名单中的 **非开放泛型** 具名类型 | 开放泛型的旧式 `List(Int32)` 调用语法 |
| 无命名空间类型 | 数组类型特殊挂载（用 `zents.make_*` 代替） |

`FullName` 含 `` ` `` 开放泛型或 `[` 数组专用语法：导出时 **跳过并告警**。

### 3.5 输出路径

| 项 | 规范 |
|----|------|
| **菜单** | `ZenTS/ExportTypes/Puerts` 等（各方案独立注册） |
| **默认输出** | 如 `Assets/ZenTS/puerts_export_types.js` |
| **格式** | **ES module** `export default { ... }`（UTF-8） |

---

## 4. Adaptor 行为契约（唯一 `adaptor.js`）

### 4.1 公共 API

```javascript
/**
 * @param {object} exportTypes  §3.1
 */
export function initAdaptor(exportTypes) {
}
```

### 4.2 根表

- 若 `top_namespace` 为非空字符串：使用 **`globalThis[top_namespace]`** 作为根；已存在且为 object → **合并**；否则 `{}`。
- 否则根为 **`globalThis`**（注意：污染全局；文档须警告）。

### 4.3 急切 vs 惰性（硬约束）

对每条条目：`export_name` 缺省时取 `full_name.replace(/\+/g, '.')`。

| 有效 `export_name` | 策略 |
|--------------------|------|
| **不含** `.` | `initAdaptor` 时立即 `CSharp[asm][full_name]` + 定义只读属性 |
| **含** `.` | `initAdaptor` **只** 建中间 namespace 对象并登记 pending；**首次**访问叶子经 **`Proxy` 或 getter** → resolve → 缓存 |

跨 assembly 的相同 `export_name` 前缀须合并到 **同一棵** 命名空间树。

**规范不要求** 使用 `Proxy` 实现分派（见 [00-OVERVIEW.md](./00-OVERVIEW.md) §1.3）；adaptor 内部 **可以** 使用 `Proxy` **仅用于迁移层**，不影响 ZenTS 核心 exotic 语义。

### 4.4 失败与冲突

- 解析失败 → **`throw new Error('zents: adaptor: …')`**
- 同一路径指向不同 `(asm, full_name)` → **`throw`**
- 未导出名：读属性返回 **`undefined`**（**不是** ZenTS 核心 `CSharp` 的 miss throw；迁移层保持旧框架 lenient 行为）

### 4.5 幂等

重复 `initAdaptor`：相同路径相同目标允许；冲突仍 **`throw`**。

### 4.6 与 `CSharp` 的边界

- Adaptor **只** 挂载类型 **对象**（ZenTS 类型表引用）；**不** 复制成员。
- 成员访问仍走 ZenTS **三表 / exotic object**（[metatable/](/docs/spec/metatable/)）。
- **`initAdaptor` 之后** `CSharp[...]`、`csharp:` named export 与 adaptor 路径 **必须** 指向同一类型对象 identity（同一引用）。

---

## 5. Puerts 特有迁移说明

### 5.1 不对等项（须人工改写）

| Puerts | ZenTS |
|--------|-----|
| `puerts.loadType('T')` | adaptor、原生 `CSharp[...]` 或 `import { T } from "csharp:…"` |
| `puerts.loadGeneric(T, TArgs...)` | **`zents.make_generic_type`** |
| `Puerts.JsEnv.Tick()` | **`JsFramePump`**（宿主帧泵） |
| `BlittableCopy` | **`JsMarshalAs`** / 默认 Marshal（[marshal/02-MARSHAL-AS.md](./marshal/02-MARSHAL-AS.md)） |
| `CS.new T()`（若使用） | **`new T(...)`**（`csharp:` import）或 **`new CSharp[...].T(...)`** 或 `zents` 构造辅助 |
| `require('module')` | **`import`** + **`moduleLoader`** |
| `obj:Method()` | **`obj.Method()`**（无冒号） |

### 5.2 Delegate / JSFunction

Puerts **`JsFunction` / 回调表** → ZenTS **`GetFunction<T>`** 或 JS 侧 **callable** 形参（[marshal/09-FUNCTION.md](./marshal/09-FUNCTION.md)）。**不在** adaptor 范围。

### 5.3 程序集映射

Puerts 常 implicit 使用默认程序集；ExportTypes **必须** 写出真实 **`Assembly-CSharp`** / **`UnityEngine.CoreModule`** 等程序集名，与 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) 一致。

---

## 6. Editor 导出工具契约

### 6.1 多方案独立脚本

| 包内路径 | 适用工程 |
|----------|----------|
| `adaptors/puerts/ExportTypes.cs` | Puerts |
| `adaptors/unity-js/ExportTypes.cs` | Unity 官方 JS 绑定 |
| `adaptors/legacy-global/ExportTypes.cs` | 仅全局链 |

须复制到已引用对应框架的程序集后使用。

### 6.2 生成步骤

1. 按 §3.3 收集类型（及别名信息）。
2. 写入 §3.1 形状；仅当 `export_name ≠ full_name`（`.` 形式）时写出 `export_name`。
3. UTF-8 写出 ES module；打印路径。
4. 键序 / 数组按程序集名、`full_name` **稳定排序**。

---

## 7. 使用流程

```text
1. 复制对应 ExportTypes.cs → 旧工程 Editor
2. ZenTS/ExportTypes/... → xxx_export_types.js
3. 复制 adaptor.js + 清单到 ZenTS 工程 moduleLoader 路径
4. 宿主 Initialize 后 import adaptor-init
5. 逐步删除 Puerts 运行时依赖；C#→JS 改为 GetFunction
```

---

## 8. 与其它文档的关系

| 主题 | 文档 |
|------|------|
| `CSharp` / `csharp:` / 类型对象 | [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) |
| `zents.make_*` | [05-LIB.md](./05-LIB.md) |
| `GetFunction` | [01-HOST-API.md](./01-HOST-API.md) |
| ES module | [01-HOST-API.md](./01-HOST-API.md) §1.3 |
| TypeScript / `csharp:` 声明 | [14-TYPESCRIPT.md](./14-TYPESCRIPT.md)（官方工作流 **不** 含 `CS` 全局） |

**冲突裁决：** 以 **本文 + `spec/**`** 为准。迁移指南 demo 若与 spec 冲突，以 spec 为准。

---

## 9. 验收标准

| # | 标准 |
|---|------|
| 1 | 一份 `adaptor.js` + 方案清单即可还原 Puerts `CS.*` 或全局命名空间链 |
| 2 | 含 `.` 的 `export_name` 惰性；不含 `.` 急切 |
| 3 | 冲突 / 解析失败明确 `throw`（`zents: adaptor:`） |
| 4 | 未 `initAdaptor` 无额外全局副作用 |
| 5 | ExportTypes 多方案独立；`adaptor.js` 无方案大 switch |
| 6 | 类型 identity 与原生 `CSharp[asm][full_name]` 及 `csharp:` named export 一致 |
