---
sidebar_position: 14
title: "TypeScript 工作流"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZenTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`14-TYPESCRIPT.md`）
:::


# 14 — TypeScript 工作流

> 约定 ZenTS 工程如何用 **TypeScript 编写业务脚本**、生成 **`csharp:` 声明**、检查与发布到 QuickJS。
> **不改变** JavaScript 可见互操作语义；运行时仍只加载 ES module 源码（[01-HOST-API.md](./01-HOST-API.md) §1.3）。
> `csharp:` specifier / 导出名 → [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11；`zents.*` → [05-LIB.md](./05-LIB.md)；调试 → [build/04-JS-DEBUGGER.md](./build/04-JS-DEBUGGER.md)。

**冲突裁决：** 本文与 `02` / `marshal` / `metatable` 冲突时，以那些文档的 **JS 语义** 为准。本文只约束编辑期 DX、工程布局与发布管线。

---

## 1. 目标与非目标

### 1.1 目标

| 项 | 约定 |
|----|------|
| 用 TS 写业务 | 补全、跳转、`tsc --noEmit`、CI |
| 对齐 `csharp:` | `import { T } from "csharp:…"` 在 IDE 中为真模块（`declare module`） |
| 对齐 `GetFunction` | 发布后仍是 **多模块 + named export**；canonical specifier **不含** `.js` / `.ts` |
| 声明与桥接同源 | 生成的 `.d.ts` 类型集 = Il2Cpp **Generate** 会绑定的那批（不是另一份 typings 白名单） |
| 声明入库 | `TsProject/generated/**` **纳入版本库**；无 Unity 的 CI 也能 `tsc --noEmit` |

### 1.2 非目标

| 项 | 态度 |
|----|------|
| 运行时执行 `.ts` | **不做**；QuickJS 只跑 emit 后的 JS |
| 默认 bundler（webpack / rollup 打成单文件） | **不做**；会破坏 `GetFunction(module, export)` |
| DOM / JSX / 业务 npm 运行时依赖 | **不在** v1 工作流 |
| 全量扫 UnityEngine 无 Generate 白名单 | **不做** |
| 官方 `CS.*` 全局类型 | **不做**；迁移见 [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) |
| `import type` 导入 C# 类型对象 | **禁止**（类型对象是运行时值，擦除后 `new T` 不存在） |
| 把 `tsc` 链进 `libil2cpp` | **不做**；编译在 Editor 本机 Node |

### 1.3 锁定决策

| # | 项 | 决策 |
|---|----|------|
| 1 | 模块 specifier | **canonical 不含 `.js` / `.ts`**（`GetFunction("main", …)`、`import { x } from "game/logic"`） |
| 2 | 生成声明 | **入库**（`TsProject/generated/`） |
| 3 | 进 Play 闸门 | **`tsc --noEmit` 默认开启**，Settings 可关 |
| 4 | 检查 vs 发布 | **检查用 `tsc --noEmit`；watch / 快速 emit 用 esbuild 1:1**；二者 **同一 `outDir`** |
| 5 | `.d.ts` 类型集 | 与 **Il2Cpp Generate** 同源，禁止独立 typings 清单 |

---

## 2. 分层

```
IDE / CI          tsc --noEmit  +  generated/*.d.ts + zents.d.ts
Emit              tsc 或 esbuild 1:1 ESM（.ts → .js + .js.map）
Runtime           moduleLoader / csharp: / CSharp / zents   ← 既有语义
```

| 层 | 工具 | 职责 |
|----|------|------|
| 类型 | 包内 `zents.d.ts` + 生成的 `declare module "csharp:…"` | 仅编辑期 |
| 检查 | `tsc --noEmit` | CI、提交前、进 Play 闸门 |
| 发布 | esbuild **不打包** 的 1:1 transpile（或 `tsc` emit） | 产出 JS；**不** minify export 名 |

**禁止** 用 esbuild 代替类型检查；**禁止** 用 `tsc` 做 bundle。

---

## 3. 工程布局

`.ts` **不得** 作为 Unity 可导入资源放在 `Assets/`（避免未知 importer）。源码在工程根：

```
<UnityProject>/
  TsProject/
    package.json                 # 仅 devDependencies：typescript、esbuild
    tsconfig.json                # extends 包内 tsconfig.base.json
    src/                         # 业务 TS（入库）
      main.ts
      game/logic.ts
    generated/                   # 生成声明（入库）
      csharp/                    # 每命名空间一个 .d.ts；文件名不含 ":"
    out/                         # emit；默认 gitignore
      main.js
      main.js.map
      game/logic.js
  Assets/StreamingAssets/ZenTS/    # Player 构建拷贝；非 Editor 热路径权威源
  Packages/com.code-philosophy.zen-ts/ZenTS~/types/
    zents.d.ts
    tsconfig.base.json
```

菜单 **`ZenTS/Init TypeScript Project`**：把包内脚手架 **复制** 到 `TsProject/`（UPM 只读，不在包内直接改工程 tsconfig）。

| 路径 | 版本库 |
|------|--------|
| `TsProject/src/**` | **入库** |
| `TsProject/generated/**` | **入库** |
| `TsProject/package.json`、`tsconfig.json` | **入库** |
| `TsProject/out/**`、`node_modules/` | **gitignore** |
| `Assets/StreamingAssets/ZenTS/**` | Player 构建产物；**不**当作 Editor 开发权威源（可 gitignore 或由构建写入） |

手写回归测试仍可放在 `StreamingAssets/Tests/Js`（纯 JS）；**不**强制迁 TS。

---

## 4. Canonical specifier（不含 `.js`）

### 4.1 逻辑名

业务模块的 **canonical specifier** 是相对 `TsProject/src/` 的 POSIX 路径，**去掉** `.ts` / `.js` / `.mjs`：

| TS 源 | Canonical | 磁盘 emit |
|--------|-----------|-----------|
| `TsProject/src/main.ts` | `main` | `TsProject/out/main.js` |
| `TsProject/src/game/logic.ts` | `game/logic` | `TsProject/out/game/logic.js` |

`GetFunction<T>("game/logic", "OnTick")` 的 `jsModule` **必须** 是 canonical（**不是** `"game/logic.js"`）。

绝对 `import { OnTick } from "game/logic"` 与 `GetFunction` 使用同一字符串。

### 4.2 相对导入与 `.js` 后缀

TypeScript ESM 在 `.ts` 源里写相对导入时 **使用** `.js` 后缀（文件仍是 `.ts`）：

```typescript
import { helper } from "./util.js";   // 源文件：util.ts
```

emit 保留该字符串。QuickJS `module_normalize` 相对当前模块解析后，loader 可能收到带 `.js` 的名字。

**规范：** 进入宿主 `moduleLoader` / `GetFunction` 缓存键之前，将 specifier **规范化为 canonical**：

1. 去掉前导 `./`（仅当它是多余的；相对段仍先经 QuickJS normalize）
2. 去掉尾缀 `.js` / `.mjs` / `.ts`
3. **不** 改写 `csharp:`（[02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11.1）

规范化后查 `out/{canonical}.js`。找不到 → loader 失败（明确异常），**不得** 再回退去读 `.ts`。

### 4.3 与纯 JS 测试的兼容

现有 `StreamingAssets/Tests/Js/*.js` 允许磁盘文件带 `.js`。Loader **仍** 按 §4.2 把 `assert.js` 规范为 `assert` 再解析。Canonical **对外契约**（`GetFunction`、文档、TS `from "…"`）一律不带后缀。

---

## 5. 包内手写类型

`ZenTS~/types/zents.d.ts` 随 UPM 分发，覆盖：

- 全局 `zents`、`CSharp`、`console`（无 DOM）
- `zents.*` 与 [05-LIB.md](./05-LIB.md) **一一对应**
- `CSharp` 为宽松索引签名（精确补全走 §6 生成模块）
- `ZenTS.OpaqueHandle`、`ZenTS.SzArray`、`ZenTS.GenericDef<N>` 等 branded / 辅助类型

`tsconfig.base.json` 锁定：

| 选项 | 值 / 要求 |
|------|-----------|
| `module` / `moduleResolution` | ESM（`nodenext` 或等价）；相对导入带 `.js` |
| `target` / `lib` | 与当前 pin 的 QuickJS 可执行子集一致；**禁止** `"DOM"` |
| `strict` | `true` |
| `noEmit` | 仅用于「检查」tsconfig；emit 用另一 profile 或 esbuild |
| `erasableSyntaxOnly` | **开启**（禁止 `enum` / `namespace` / 参数属性等非擦除语法） |
| `verbatimModuleSyntax` | **开启** |
| `types` / `include` | 包内 `zents.d.ts` + `TsProject/src` + `TsProject/generated` |

C# 类型是 **值**：必须 `import { Panel } from "csharp:…"`，**禁止** `import type { Panel }`。

---

## 6. `csharp:` 声明生成

### 6.1 文件与 `declare module`

Windows 文件名 **不得** 含 `:`。生成路径用程序集 / 命名空间段，**模块名** 仍是运行时 specifier：

```
TsProject/generated/csharp/Assembly-CSharp/MyGame.UI.d.ts
```

```typescript
declare module "csharp:Assembly-CSharp/MyGame.UI" {
  export class Panel {
    constructor();
    setTitle(title: string): void;
  }
}
```

**不要** 依赖 `compilerOptions.paths` 去映射 `csharp:` scheme。靠精确 `declare module "csharp:…"` 字符串匹配。

导出名、`` ` ``→`$`、无 arity 糖、嵌套模块、空命名空间模块：与 [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11 **完全一致**。

### 6.2 类型集 = Il2Cpp Generate

生成器 **读取与 Il2Cpp Generate 相同的类型/成员集合**（EnsureBinding 会写入三表的 public 成员；含 `[JsAlias]` / `[JsExtension]` / MarshalAs 配置的最终 JS 面）。

| 允许 | 禁止 |
|------|------|
| Generate 会进 Player 绑定的类型与成员 | 独立「typings」白名单 |
| 与 Generate 同步刷新（同一菜单或 Generate 的后置步骤） | Editor 反射扫到、但 Generate 不会绑定的 API |
| 开放泛型 **定义**（`List$1`）若 Generate 包含该定义 | 把未 Generate 的 UnityEngine 全量写入 `.d.ts` |

Generate 未包含的类型 **不得** 出现在 `csharp:` named export 声明中（否则 Editor 能补全、Player 缺失）。

菜单：**`ZenTS/Generate Typings`**；亦可挂在 **`ZenTS/Generate/All`** 之后。C# / 桥接配置变更后须重新生成并 **提交** `generated/`。

### 6.3 成员到 TS 的映射

| CLR | `.d.ts` | 备注 |
|-----|---------|------|
| class | `export declare class T` | `new T()`；静态在构造器上 |
| struct | `class` + `static _default(): T` | |
| enum | 常量对象 + `type` 为 `number` | **禁止** bigint |
| 静态类 | `private constructor()` | |
| 开放泛型定义 | `export const List: ZenTS.GenericDef<1>`（及 `List$1`） | **不是** `class List<T>`；`new List()` 须为类型错误 |
| 嵌套类型 | 仅声明类型模块 | **不** 生成 `Outer.Inner` 静态字段 |
| 无参属性 | 属性 | 只写则仅 setter |
| 有参属性 / 索引器 | `get_*` / `set_*` 方法 | 不要伪装 `obj[i]` |
| 事件 | `add_*` / `remove_*` | 无 Event 子对象 |
| 重载 | 多条函数签名 | 运行时仍 dispatch（[04-METHOD-OVERLOAD.md](./04-METHOD-OVERLOAD.md)） |
| `ref` / `out` / `in` | `ZenTS.OpaqueHandle<…>`（C#→JS 默认） | 见 marshal byref |
| delegate 形参 | 可调用函数类型 | 可传 JS function |
| szarray 实例 | `ZenTS.SzArray<T>`（`get` / `set` / `length`） | **不是** `T[]`；`T[]` 仅 `zents.to_array` 返回值 |

闭合泛型 / 数组类型对象：继续 `zents.make_*`；其返回值在 **P3 之前** 可为 `ZenTS.TypeObject`（`new` 实例宽类型）。

### 6.4 分期（声明精度）

| 期 | 声明内容 |
|----|----------|
| **P0** | 手写 `zents.d.ts` + 宽松 `CSharp`；尚无生成 `csharp:` 也可写 TS（`csharp:` import 需 `declare module` 或临时 `any`） |
| **P1** | 按 Generate 集生成 `csharp:`：class / struct / enum + 成员（开放泛型为 `GenericDef`） |
| **P3** | `make_generic_type` 泛型推断、重载签名细化、可选 `GetFunction` 导出核对 |

P0 脚手架与 P1 生成器可分步落地；**语义** 以本节为准。

---

## 7. 工具链

### 7.1 检查

```text
tsc --noEmit -p TsProject/tsconfig.json
```

进 **Play** 前执行（§8.1）。CI 无 Unity 时同样命令（依赖已入库的 `generated/`）。

### 7.2 Emit

| 场景 | 工具 | 输出 |
|------|------|------|
| watch / Editor 快速刷新 | **esbuild** 1:1（`format=esm`，**不** bundle） | `TsProject/out/**/*.js` + `.js.map` |
| 无 esbuild 时 | `tsc` emit 到 **同一 `outDir`** | 同上 |

`outDir` **必须** 与检查用 tsconfig 的 `rootDir`/`outDir` 布局一致（`src/game/logic.ts` → `out/game/logic.js`）。

**禁止** `--bundle`、**禁止** mangle named export（`GetFunction` 依赖导出名）。v1 **默认不 minify**。

### 7.3 Node

Editor 本机需要 **Node LTS**（调用 `npx tsc` / `npx esbuild`）。包 **不** 内嵌 tsc 二进制。缺失 Node 时：菜单 / Play 闸门 **失败并提示**，禁止静默跳过检查（闸门关闭时除外，§8.1）。

---

## 8. Editor / Player

### 8.1 进 Play 闸门

Settings（概念字段，实现名可对齐 `TsSettings`）：

| 项 | 默认 | 行为 |
|----|------|------|
| TypeScript Play 闸门 | **开** | 进 Play 前：`tsc --noEmit`；失败 → **阻止 Play** 并报告 |
| 闸门关闭 | 可关 | 仍建议 CI 跑检查 |

闸门开启时顺序：

1. 若 Generate / C# 绑定脏 → 生成 typings（§6.2）
2. `tsc --noEmit`
3. 若 `out/` 相对 `src/` 过期 → esbuild（或 tsc emit）

### 8.2 Editor 加载

`moduleLoader(canonical)` 读 `TsProject/out/{canonical}.js`。`csharp:` **不** 经 loader。

### 8.3 Player 构建

`IPreprocessBuildWithReport`（或等价）：

1. 可选：再跑 `tsc --noEmit`（失败中断出包）
2. emit 到 `out/`
3. 拷贝 `out/**/*.js`（及可选 `.map`）→ `StreamingAssets/ZenTS/`
4. Player `moduleLoader` **只** 读 StreamingAssets，**不** 依赖 Node、**不** 读 `.ts`

---

## 9. IDE 与调试

- 用 VS Code / Cursor 打开 `TsProject/`，或 Unity 工程 + `TsProject` 的 multi-root。
- `include`：`src`、`generated`、包内 `zents.d.ts`。
- emit **必须** 带 source map。调试 hook 把 logical path 映射到 `TsProject/src/**`（[build/04-JS-DEBUGGER.md](./build/04-JS-DEBUGGER.md)）。
- `csharp:` 合成模块无源码；断点打在业务 `.ts`。
- `erasableSyntaxOnly` 下 map 接近 1:1。

---

## 10. `GetFunction` 与导出

```csharp
JsAppDomain.GetFunction<Action<float>>("game/logic", "OnTick");
```

```typescript
// TsProject/src/game/logic.ts
export function OnTick(dt: number): void { /* … */ }
```

- `jsModule` = canonical（无 `.js`）。
- **仅** named export；不把 `export default` 自动映射为 `GetFunction` 名（[01-HOST-API.md](./01-HOST-API.md) §1.3）。
- **不要** 对 `csharp:` 模块 `GetFunction`。

P3 可增加「TS 导出 ↔ `GetFunction` 签名」核对；**非** v1 硬性。

---

## 11. 与 adaptor 的边界

| 官方工作流 | [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) |
|------------|------------------------------------------------------|
| `import { GameObject } from "csharp:UnityEngine.CoreModule/UnityEngine"` | `CS.UnityEngine.GameObject` |
| `tsconfig` **不** 包含 `CS` 全局 | 迁移工程可另生成 `cs-global.d.ts`，**不** 随 `zents.d.ts` 安装 |

新项目 **不** 安装 adaptor。

---

## 12. 验收

| # | 标准 |
|---|------|
| 1 | `GetFunction("main", …)` / `from "main"` 均无 `.js`；相对 `./x.js` 经 loader 规范为 canonical |
| 2 | `generated/csharp/**` 入库；CI 无 Unity 可 `tsc --noEmit` |
| 3 | Play 闸门默认开；`tsc` 失败阻止 Play；Settings 可关 |
| 4 | 检查走 tsc；watch emit 走 esbuild 1:1；同一 `outDir`；无 bundle |
| 5 | `.d.ts` 导出的类型 ⊆ Generate 绑定集；导出名与 §2.11 一致 |
| 6 | 运行时不读 `.ts` / `.d.ts`；Player 只加载 StreamingAssets 中的 JS |
| 7 | `import type { CSharpClass }` 在文档与 `verbatimModuleSyntax` 下不可作为类型对象值使用 |

---

## 13. 相关文档

| 文档 | 内容 |
|------|------|
| [01-HOST-API.md](./01-HOST-API.md) | `moduleLoader`、`GetFunction`、canonical specifier |
| [02-TYPE-SYSTEM.md](./02-TYPE-SYSTEM.md) §2.11 | `csharp:` 运行时模块 |
| [05-LIB.md](./05-LIB.md) | `zents.*` ↔ `zents.d.ts` |
| [11-MULTI-VERSION.md](./11-MULTI-VERSION.md) | `ZenTS~/types` 包内布局 |
| [12-MIGRATION-ADAPTORS.md](./12-MIGRATION-ADAPTORS.md) | 非官方 `CS.*` |
| [build/04-JS-DEBUGGER.md](./build/04-JS-DEBUGGER.md) | source map → `TsProject/src` |
