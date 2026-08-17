#!/usr/bin/env node
/** One-shot generator for zen-ts-doc markdown pages. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');

function w(rel, body) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, body.replace(/\r\n/g, '\n'));
  console.log('+', rel);
}

function cat(rel, label, position, extra = {}) {
  w(rel, JSON.stringify({label, position, collapsed: false, ...extra}, null, 2) + '\n');
}

cat('getting-started/_category_.json', '入门', 2);
cat('guides/_category_.json', '使用指南', 3);
cat('concepts/_category_.json', '核心概念', 4);
cat('compare/_category_.json', '选型对比', 5);
cat('reference/_category_.json', 'API 参考', 6);
cat('community/_category_.json', '社区', 8);
cat('impl/_category_.json', '架构与实现', 1);

w(
  'intro.md',
  `---
sidebar_position: 1
slug: /intro
title: 介绍
description: ZenTS 是什么、核心特性与适用场景。
---

# 介绍

**ZenTS** 是一个针对 Unity Il2Cpp 优化的现代 **TypeScript / JavaScript** 脚本方案，由 **QuickJS** 驱动，设计与 [ZLua](https://doc.zlua.cn) 对齐。

它用清晰的规则统一 C# 与 JS 的双向调用：\`JsAppDomain.GetFunction\`、\`CSharp[…]\` / \`import from "csharp:…"\`、\`[JsMarshalAs]\` 等，屏蔽底层易错的原生绑定细节。

## 为什么选择 ZenTS

相对 Puerts / 自管 QuickJS，以及「手写绑定」：

| | |
|--|--|
| **更易用** | 设计贴近 C#；**零 per-type Wrap 白名单**；类型懒绑定 |
| **更完备** | 重载、ref/out、struct ByVal/ByObj、Nullable、委托、数组、指针、\`[JsMarshalAs]\` 等 |
| **更统一** | 与 ZLua **同一套语义契约**；会用 ZLua 即可很快上手 ZenTS |
| **更高效** | Player **Il2Cpp** 热路径为 C++ 桥接；签名复用 stub |
| **更少 GC** | 引用类型与 struct 默认 Registry / ByVal；另有 Opaque 等策略 |
| **双运行时** | Editor **Mono** + 发布 **Il2Cpp Player** |
| **TS 一等公民** | \`TsProject\`、\`csharp:\` 声明、进 Play 闸门；运行时仍只跑 emit 后的 JS |

完整论述见 **[为什么选择 ZenTS](/docs/concepts/why-zents/)**；对照见 **[选型对比](/docs/compare/FEATURES/)**。

## 核心特性

| 能力 | 说明 |
|------|------|
| JS/TS → C# | \`CSharp\` 懒绑定或 \`import { T } from "csharp:…"\` |
| C# → JS | \`JsAppDomain.GetFunction<T>\` 取得 Delegate 后调用 |
| 双运行时 | **Mono（Editor）与 Il2Cpp（Player）**；语义一致、实现路径不同 |
| TypeScript | 官方工作流；见 [TypeScript 工作流](/docs/guides/typescript-workflow/) |
| Marshal | ByVal / ByObj / Opaque 等，见 [Marshal 规范](/docs/spec/marshal/) |

:::info 当前状态
<span class="runtimeBadge"><span class="runtimeBadgeMono">Mono · 已完成</span><span class="runtimeBadgeIl2cpp">Il2Cpp · 已完成</span></span>

日常在 **Editor（Mono）** 开发；发版与性能以 **Il2Cpp Player** 为准。详见 [项目状态](/docs/getting-started/project-status/)。
:::

## 下一步

- [5 分钟快速开始](/docs/getting-started/quick-start/) — 跑通 js-demo / ts-demo
- [安装与集成](/docs/getting-started/installation/)
- [使用指南](/docs/guides/install/)
- [规范总览](/docs/spec/00-OVERVIEW/)
`,
);

w(
  'getting-started/installation.md',
  `---
sidebar_position: 1
title: 安装与集成
description: 通过 UPM / Git URL 安装 ZenTS 包。
---

# 安装与集成

## 包标识

- UPM 包名：\`com.code-philosophy.zen-ts\`
- 源码仓库：[focus-creative-games/zen-ts](https://github.com/focus-creative-games/zen-ts)

## 通过 Git URL 安装

在 \`Packages/manifest.json\` 中加入：

\`\`\`json
{
  "dependencies": {
    "com.code-philosophy.zen-ts": "https://github.com/focus-creative-games/zen-ts.git"
  }
}
\`\`\`

也可在 Unity：**Window → Package Manager → + → Add package from git URL**。

## 安装后

1. 确认菜单出现 **ZenTS/**（Init TypeScript Project、Generate Typings、Compile 等）。
2. 纯 JS 工程：准备 Loader + \`JsScripts/\`（见 [快速开始](/docs/getting-started/quick-start/)）。
3. TypeScript 工程：执行 **ZenTS/Init TypeScript Project**，或直接打开 [ts-demo](https://github.com/focus-creative-games/zen-ts-demo)。

## Il2Cpp 说明

Player 使用包内 \`ZenTS~/zents-runtime\` 进入 LocalIl2Cpp / 导出工程。细节见 [构建](/docs/guides/build/) 与 [spec/build](/docs/category/build/)。
`,
);

w(
  'getting-started/quick-start.md',
  `---
sidebar_position: 2
title: 快速开始
description: 用 zen-ts-demo 的 js-demo / ts-demo 跑通最小闭环。
---

# 快速开始

推荐直接使用官方 Demo：[zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)。

仓库含两个独立 Unity 工程：

| 工程 | 说明 |
|------|------|
| \`js-demo/\` | 纯 JavaScript（ESM），脚本在 \`JsScripts/\` |
| \`ts-demo/\` | TypeScript 工作流（\`TsProject/\`） |

环境：推荐 Unity **2022.3 LTS**（亦支持 **2021.3.x** / **6000.0.x** / **6000.3.x** / **6000.5.x** / **团结引擎 1.x.y**，见 [兼容性](/docs/getting-started/compatibility/)）；\`ts-demo\` 需要本机 **Node LTS**。

## 路径 A：js-demo（Editor）

1. 用 Unity 打开 \`js-demo/\`。
2. 确认 \`Packages/manifest.json\` 中 ZenTS 包路径可用（开发期多为 \`file:…\`，发布改为 git URL）。
3. 打开 \`Assets/Scenes/SampleScene\`，点 **Play**。
4. Console 应出现类似：\`js main start\`、C# 访问路径日志、\`[identity] … OK\`，以及 \`AppAdd(10,20)=30\`。

要点：

- C# → JS：\`JsAppDomain.GetFunction\`（named export）
- JS → C#：\`CSharp[…]\` 与/或 \`import from "csharp:…"\`

详见 [JS 调用 C#](/docs/guides/js-calling-csharp/) 与 [C# 调用 JS](/docs/guides/csharp-calling-js/)。

## 路径 B：ts-demo（Editor）

1. 用 Unity 打开 \`ts-demo/\`。
2. 在工程根 \`TsProject/\` 执行 \`npm install\`（或菜单 **ZenTS Demo → Compile TypeScript**）。
3. （可选）**ZenTS Demo → Generate Typings** 刷新 \`generated/csharp/**\`。
4. Play；期望日志与 js-demo 类似（前缀 \`ts main\`）。

进 Play 时若开启 TypeScript 闸门，会自动 \`tsc --noEmit\`；失败则阻止 Play。

完整工作流见 [TypeScript 工作流](/docs/guides/typescript-workflow/)。

## 最小自建（纯 JS）

\`\`\`csharp
using System.IO;
using System.Text;
using UnityEngine;
using ZenTS;

public static class ZtsBootstrap
{
    static object LoadJsModule(string module)
    {
#if UNITY_EDITOR
        var path = Path.Combine(Application.dataPath, "..", "JsScripts", module + ".js");
#else
        var path = Path.Combine(Application.streamingAssetsPath, "Js", module + ".js");
#endif
        return File.Exists(path) ? File.ReadAllText(path, Encoding.UTF8) : null;
    }

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    static void Init() => JsAppDomain.Initialize(LoadJsModule);
}
\`\`\`

模块名为 **canonical specifier**（相对逻辑路径，**不含** \`.js\`），例如 \`"app"\`。
`,
);

w(
  'getting-started/compatibility.md',
  `---
sidebar_position: 3
title: 兼容性
description: Unity 版本、运行时与平台支持范围。
---

# 兼容性

## Unity / 团结

| 版本 | 状态 |
|------|------|
| Unity **2021.3.x** | ✅ 支持 |
| Unity **2022.3.x** | ✅ 支持 |
| Unity **6000.0.x** | ✅ 支持 |
| Unity **6000.3.x** | ✅ 支持 |
| Unity **6000.5.x** | ✅ 支持 |
| **团结引擎 1.x.y** | ✅ 支持 |

## 脚本 VM 与运行时

| 类别 | 状态 |
|------|------|
| **脚本 VM** | **QuickJS**（pin 见包内 \`ZenTS~/\`） |
| **Editor** | **Mono** |
| **Player** | **Il2Cpp**（权威实现） |

## 目标平台

| 类别 | 范围 |
|------|------|
| **Editor（开发）** | **Windows x64**、**macOS** |
| **Player（Il2Cpp）** | Il2Cpp 支持的全部目标（含 **Win64**、**Android**、**iOS**、**WebGL**、**微信小游戏**、**鸿蒙 / 车机** 等） |

语义契约以 [规范文档](/docs/category/spec/) 为准；见 [项目状态](/docs/getting-started/project-status/)。
`,
);

w(
  'getting-started/project-status.md',
  `---
sidebar_position: 4
title: 项目状态
description: Alpha 阶段能力边界与双运行时完成度。
---

# 项目状态

ZenTS 目前为 **Alpha**：API 与规范可能随版本迭代，但核心互操作路径已在 Editor Mono 与 Il2Cpp Player（含 Win64 / Android / iOS 等）上通过内部矩阵验证。Player 覆盖 **Il2Cpp 支持的全部平台**（见 [兼容性](/docs/getting-started/compatibility/)）。

| 维度 | 说明 |
|------|------|
| Editor Mono | 日常开发与冒烟（Windows / macOS）；Expression Emit |
| Il2Cpp Player | 发布路径；\`zents-runtime\` C++ 桥；凡 Il2Cpp 可构建目标均可发布 |
| 文档 | 本站 + 上游 \`Docs/spec\` |
| Demo | [zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo) \`js-demo\` / \`ts-demo\` |

问题与需求请到 [GitHub Issues](https://github.com/focus-creative-games/zen-ts/issues)，或见 [联系方式](/docs/community/contact/)（QQ / Discord）。
`,
);

// ---- guides ----
const guides = [
  [
    'install.md',
    1,
    '安装',
    '安装包与工程目录约定。',
    `# 安装

见 [安装与集成](/docs/getting-started/installation/)。本页补充工程约定：

- **纯 JS**：工程旁 \`JsScripts/\`（或你在 Loader 中约定的路径）；Player 侧常拷贝到 \`StreamingAssets/Js/\`。
- **TypeScript**：工程根 \`TsProject/\`（\`ZenTS/Init TypeScript Project\` 生成）；emit 产物供运行时加载。
- **包路径**：开发期 \`file:\`；发布改为 git URL，并相应调整 \`tsconfig\` 对包内 types 的引用。
`,
  ],
  [
    'hello-interop.md',
    2,
    'Hello 互操作',
    '最小 C#↔JS 互调。',
    `# Hello 互操作

## C# → JS

\`\`\`csharp
var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
Debug.Log(add(10, 20));
\`\`\`

\`\`\`js
// JsScripts/app.js
export function add(a, b) { return a + b; }
\`\`\`

## JS → C#

\`\`\`js
const AC = CSharp["Assembly-CSharp"];
const demo = new AC.Demo();
console.log(AC.Demo.Add(3, 5));
\`\`\`

或 TypeScript：

\`\`\`ts
import { Demo } from "csharp:Assembly-CSharp";
console.log(Demo.Add(3, 5));
\`\`\`

可运行样例见 [zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)。
`,
  ],
  [
    'js-calling-csharp.md',
    3,
    'JS 调用 C#',
    'CSharp 懒绑定与 csharp: import。',
    `# JS 调用 C#

## 路径 1：全局 \`CSharp\`

\`\`\`js
const AC = CSharp["Assembly-CSharp"];
const go = new AC["UnityEngine.GameObject"]("hi"); // 视具体绑定暴露而定
const demo = new AC.Demo();
demo.x = 10;
console.log(AC.Demo.Add(1, 2));
\`\`\`

类型按需懒绑定，**无需** per-type Wrap 白名单。

## 路径 2：\`csharp:\` 模块（TS/JS）

\`\`\`ts
import { Demo } from "csharp:Assembly-CSharp";
const d = new Demo();
\`\`\`

声明与 Generate Typings 见 [TypeScript 工作流](/docs/guides/typescript-workflow/) 与 [spec/14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)。

权威语义：[类型系统](/docs/spec/02-TYPE-SYSTEM/)、[元表/绑定](/docs/spec/metatable/)。
`,
  ],
  [
    'csharp-calling-js.md',
    4,
    'C# 调用 JS',
    'JsAppDomain.GetFunction 与 named export。',
    `# C# 调用 JS

\`\`\`csharp
JsAppDomain.Initialize(LoadJsModule);

var main = JsAppDomain.GetFunction<Action>("app", "main");
var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
main();
Debug.Log(add(10, 20));
\`\`\`

规则：

- 模块名为 **canonical**（不含 \`.js\`）
- 仅 **named export**；不要对 \`csharp:\` 模块调用 \`GetFunction\`
- Delegate 类型 \`T\` 决定参数/返回值 Marshal

规范：[Host API](/docs/spec/01-HOST-API/)。Demo：\`js-demo\` / \`ts-demo\` 中的 \`AppAdd\`。
`,
  ],
  [
    'typescript-workflow.md',
    5,
    'TypeScript 工作流',
    'TsProject、Generate Typings、Compile、Play 闸门。',
    `# TypeScript 工作流

ZenTS 运行时只执行 **ES module（JS）**；TypeScript 是官方一等编辑与检查路径。

## 一键初始化

菜单 **ZenTS/Init TypeScript Project** → 生成工程根 \`TsProject/\`（\`package.json\`、\`tsconfig\`、\`src/\` 等）。

也可直接使用 [ts-demo](https://github.com/focus-creative-games/zen-ts-demo) 的 \`TsProject/\`。

## 日常循环

1. **Generate Typings**（可选）：刷新 \`generated/csharp/**\`，供 \`import from "csharp:…"\`。
2. 编写 \`src/**/*.ts\`。
3. **Compile**（esbuild 等 1:1 emit）→ 运行时 Loader 读取产物。
4. 进 Play：若开启闸门，先 \`tsc --noEmit\`，失败则阻止 Play。

## Specifier

- 业务模块：canonical，如 \`"game/logic"\`（无 \`.js\`）
- C#：\`csharp:AssemblyName\`（细节见 [14-TYPESCRIPT](/docs/spec/14-TYPESCRIPT/)）

## 与纯 JS 的关系

\`js-demo\` 跳过 tsc；\`ts-demo\` 展示完整闸门。两者互操作语义相同。
`,
  ],
  [
    'overloads.md',
    10,
    '方法重载',
    'JS 侧重载解析要点。',
    `# 方法重载

C# 重载在 JS 侧按实参类型与 arity 解析；扩展方法可与实例方法合并候选。细节见 [04-METHOD-OVERLOAD](/docs/spec/04-METHOD-OVERLOAD/) 与 [13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/)。
`,
  ],
  [
    'ref-out-in.md',
    11,
    'ref / out / in',
    'ByRef 参数约定。',
    `# ref / out / in

ByRef 参数在 JS 侧通常通过可变容器或专用约定回写；Il2Cpp 路径对 struct 等有直接写回优化。见 [marshal/03-BYREF](/docs/spec/marshal/03-BYREF/) 与 [05-STRUCT](/docs/spec/marshal/05-STRUCT/)。
`,
  ],
  [
    'value-types.md',
    12,
    '值类型',
    'struct ByVal / ByObj。',
    `# 值类型

- **ByVal**：默认值语义 exotic（Cs2Js / \`new\` / \`_default\`）
- **ByObj**：装箱路径（\`box\`）

见 [05-STRUCT](/docs/spec/marshal/05-STRUCT/) 与 [术语表](/docs/concepts/glossary/)。
`,
  ],
  [
    'functions.md',
    13,
    '委托与函数',
    'Delegate ↔ JS function。',
    `# 委托与函数

JS function 可与 C# Delegate 互转；事件 \`add_\` / \`remove_\` 依赖委托身份缓存。见 [marshal/09-FUNCTION](/docs/spec/marshal/09-FUNCTION/)。
`,
  ],
  [
    'arrays.md',
    14,
    '数组',
    '数组 Marshal 概要。',
    `# 数组

见 [marshal/07-ARRAY](/docs/spec/marshal/07-ARRAY/)。
`,
  ],
  [
    'generics.md',
    15,
    '泛型',
    '封闭泛型类型访问。',
    `# 泛型

运行时绑定封闭构造类型；开放泛型定义本身不可直接实例化。见 [02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/)。
`,
  ],
  [
    'extension-methods.md',
    16,
    '扩展方法',
    '扩展方法与实例候选合并。',
    `# 扩展方法

标记 \`[JsExtension]\`（及规范约定的发现规则）后，可在接收者上以实例方法形式调用。见 [13-EXTENSION-METHODS](/docs/spec/13-EXTENSION-METHODS/)。
`,
  ],
  [
    'zents-lib.md',
    17,
    'zents 标准库',
    'zents.* 辅助 API。',
    `# zents 标准库

运行时注入 \`zents.*\`（对照 ZLua 的 \`zlua.*\`）。能力清单见 [05-LIB](/docs/spec/05-LIB/)。
`,
  ],
  [
    'js-marshal-as.md',
    18,
    'JsMarshalAs',
    '[JsMarshalAs] 覆盖默认 Marshal。',
    `# JsMarshalAs

\`[JsMarshalAs]\` 可覆盖参数/返回值/字段的默认 Marshal 策略（如 Opaque）。见 [marshal/02-MARSHAL-AS](/docs/spec/marshal/02-MARSHAL-AS/)。
`,
  ],
  [
    'js-alias.md',
    19,
    'JsAlias',
    '[JsAlias] 命名别名。',
    `# JsAlias

\`[JsAlias]\` 用于在脚本侧暴露更友好的名称。细节见规范与参考页 [Attributes](/docs/reference/attributes/)。
`,
  ],
  [
    'zero-gc-marshal.md',
    20,
    '少 GC Marshal',
    'Registry / ByVal / Opaque 策略。',
    `# 少 GC Marshal

引用类型默认走 Registry；struct 默认 ByVal；热点路径可选用 Opaque。定性说明见 [concepts/marshal-overview](/docs/concepts/marshal-overview/)，契约见 [marshal](/docs/spec/marshal/)。
`,
  ],
  [
    'editor-vs-player.md',
    21,
    'Editor 与 Player',
    'Mono 与 Il2Cpp 路径差异。',
    `# Editor 与 Player

| | Editor | Player |
|--|--------|--------|
| 运行时 | Mono | Il2Cpp |
| 绑定实现 | Expression Emit | C++ \`zents-runtime\` |
| 脚本加载 | 常读工程旁 \`JsScripts\` / TS emit | StreamingAssets 等 |

语义应对齐；性能以 Player 为准。见 [Architecture](/docs/category/impl/)。
`,
  ],
  [
    'build.md',
    22,
    '构建',
    'Il2Cpp 导出与 zents-runtime。',
    `# 构建

1. 确认包内 \`ZenTS~/zents-runtime\` / Install 流程已将运行时装入 LocalIl2Cpp。
2. 导出 Il2Cpp 工程后用 **Debug|x64**（开发）或 Release 构建。
3. QuickJS / 原生模块相关见 [spec/build](/docs/category/build/)。

团队内部联调可参考 ZenTSTest 的 \`sync-runtime-zents.bat\` 工作流（改 \`Build-Win64/.../zents\` → 同步回包）。
`,
  ],
  [
    'js-debugger.md',
    23,
    'JS 调试器',
    'Debugger Host 预留路径。',
    `# JS 调试器

Editor 侧预留 Debugger Host 接口，持续完善。能力边界见 [build/04-JS-DEBUGGER](/docs/spec/build/04-JS-DEBUGGER/)。
`,
  ],
  [
    'troubleshooting.md',
    24,
    '排障',
    '常见问题速查。',
    `# 排障

| 现象 | 排查 |
|------|------|
| \`GetFunction\` 失败 | canonical 名是否含 \`.js\`；是否 named export |
| \`csharp:\` 类型找不到 | 是否 Generate Typings；程序集名是否正确 |
| Play 被拦截 | \`tsc --noEmit\` 错误；看 Console |
| Il2Cpp 与 Editor 行为不一致 | 对照 [spec](/docs/category/spec/)；提 Issue 并附最小复现 |
| 包路径失效 | \`manifest.json\` \`file:\` / git URL |

更多：[FAQ](/docs/community/faq/)。
`,
  ],
];

for (const [file, pos, title, desc, body] of guides) {
  w(
    `guides/${file}`,
    `---
sidebar_position: ${pos}
title: ${title}
description: ${desc}
---

${body}`,
  );
}

// concepts
const concepts = [
  [
    'why-zents.md',
    1,
    '为什么选择 ZenTS',
    `# 为什么选择 ZenTS

面向「要在 Unity 用 JS/TS 脚本，又希望接近 ZLua 的完备互操作与 Il2Cpp 优化」的团队：

- **零配置**懒绑定，减少白名单与生成物心智负担
- **与 ZLua 同构**的门面 / Marshal / 生命周期，Lua 与 TS 产品可并存
- **官方 TypeScript 工作流**，而不是事后补丁
- **双运行时**：Editor 快迭代，Player 走 C++ 桥

若你已用 Puerts，可参考 [选型对比](/docs/compare/FEATURES/) 做迁移评估。
`,
  ],
  [
    'design-overview.md',
    2,
    '设计概览',
    `# 设计概览

\`\`\`mermaid
flowchart LR
  CS[C# Host] -->|GetFunction| JS[QuickJS ESM]
  JS -->|CSharp / csharp:| CS
  CS --> Mono[Editor Mono Emit]
  CS --> Il2[Player Il2Cpp zents-runtime]
\`\`\`

分层：Host API → 类型系统 / 重载 → Marshal → Exotic（元表）绑定 → 生命周期。权威：[00-OVERVIEW](/docs/spec/00-OVERVIEW/)。
`,
  ],
  [
    'dual-runtime.md',
    3,
    '双运行时',
    `# 双运行时

语义契约一份；实现两套：

- **Mono**：开发期 Expression Tree / Emit
- **Il2Cpp**：\`libil2cpp/zents\` C++（包内 \`ZenTS~/zents-runtime\`）

见 [editor-vs-player](/docs/guides/editor-vs-player/) 与 [impl](/docs/category/impl/)。
`,
  ],
  [
    'type-system-overview.md',
    4,
    '类型系统概览',
    `# 类型系统概览

脚本侧通过程序集 / 类型全名解析 CLR 类型；构造、成员访问、重载解析遵循统一规则。详见 [02-TYPE-SYSTEM](/docs/spec/02-TYPE-SYSTEM/)。
`,
  ],
  [
    'marshal-overview.md',
    5,
    'Marshal 概览',
    `# Marshal 概览

默认策略 + \`[JsMarshalAs]\` 覆盖。分类索引：[marshal](/docs/spec/marshal/)。
`,
  ],
  [
    'exotic-model.md',
    6,
    'Exotic 对象模型',
    `# Exotic 对象模型

C# 对象在 JS 中以 QuickJS exotic / 元表风格暴露成员（对照 ZLua metatable 模型）。布局与 \`index\`/\`binding\` 见 [metatable](/docs/spec/metatable/)。
`,
  ],
];

for (const [file, pos, title, body] of concepts) {
  w(
    `concepts/${file}`,
    `---
sidebar_position: ${pos}
title: ${title}
description: ${title}
---

${body}`,
  );
}

// compare
w(
  'compare/FEATURES.md',
  `---
sidebar_position: 1
title: 特性对比
description: ZenTS 与 Puerts / 自管 QuickJS 的定性对比。
---

# 特性对比

:::note
本页为**选型辅助**，不是行为契约。契约以 [spec](/docs/category/spec/) 为准。
:::

| 维度 | ZenTS | Puerts（典型） | 自管 QuickJS |
|------|-----|----------------|--------------|
| 绑定方式 | 懒绑定，零 per-type Wrap 白名单 | 常需生成/导出配置 | 手写绑定 |
| 与 ZLua 心智 | 同构（门面/Marshal） | 不同 | 无 |
| TypeScript | 官方 TsProject + csharp: | 视方案而定 | 自建 |
| Il2Cpp | 官方 C++ \`zents-runtime\` | 有成熟路径 | 自建 |
| 完备互操作 | 重载 / ref / struct ByVal… 按 spec | 视版本 | 视实现 |

## 性能

暂无公开四方实测数字时，**不编造基准**。方法论可参考 [ZLua 性能对比](https://doc.zlua.cn/docs/compare/PERFORMANCE/)；ZenTS 数据补齐后会更新本页。
`,
);

w(
  'compare/SUMMARY.md',
  `---
sidebar_position: 2
title: 选型摘要
description: 何时选 ZenTS。
---

# 选型摘要

- 需要 **JS/TS + 完备 C# 互操作 + Il2Cpp**，并希望与 **ZLua** 共用团队心智 → 优先 ZenTS
- 已有大型 Puerts 资产且迁移成本高 → 评估适配器 / 渐进迁移（见 [迁移](/docs/community/migration/)）
- 只要极薄 QuickJS 嵌入、可接受手写绑定 → 自管方案可能更轻，但长期维护成本在你
`,
);

// reference
w(
  'reference/overview.md',
  `---
sidebar_position: 1
title: 参考总览
description: API 参考入口。
---

# 参考总览

| 页 | 内容 |
|----|------|
| [JsAppDomain](/docs/reference/js-app-domain/) | 初始化、\`GetFunction\`、Loader |
| [Attributes](/docs/reference/attributes/) | \`JsMarshalAs\` / \`JsAlias\` / \`JsExtension\` |
| [zents / csharp:](/docs/reference/js-surface/) | 脚本侧表面 |

完整契约仍以 [spec](/docs/category/spec/) 为准。
`,
);

w(
  'reference/js-app-domain.md',
  `---
sidebar_position: 2
title: JsAppDomain
description: C# 宿主门面速查。
---

# JsAppDomain

| API | 说明 |
|-----|------|
| \`Initialize(loader)\` | 注册模块加载器；\`loader(canonical) → string\\|null\` |
| \`GetFunction<T>(module, exportName)\` | 取得 named export 对应 Delegate |

详见 [01-HOST-API](/docs/spec/01-HOST-API/)。
`,
);

w(
  'reference/attributes.md',
  `---
sidebar_position: 3
title: Attributes
description: JsMarshalAs / JsAlias / JsExtension。
---

# Attributes

| 特性 | 用途 |
|------|------|
| \`[JsMarshalAs]\` | 覆盖 Marshal 策略 |
| \`[JsAlias]\` | 脚本侧别名 |
| \`[JsExtension]\` | 扩展方法发现 |

对照 ZLua 的 \`[LuaMarshalAs]\` 等。细节见 marshal / extension spec。
`,
);

w(
  'reference/js-surface.md',
  `---
sidebar_position: 4
title: zents 与 csharp:
description: 脚本侧全局与模块速查。
---

# zents 与 csharp:

| 表面 | 说明 |
|------|------|
| \`CSharp\` | 懒绑定根 |
| \`import { T } from "csharp:Asm"\` | 类型模块 |
| \`zents.*\` | 标准库，见 [05-LIB](/docs/spec/05-LIB/) |
`,
);

// community
w(
  'community/faq.md',
  `---
sidebar_position: 1
title: FAQ
description: 常见问题。
---

# FAQ

**Q: 运行时执行 TypeScript 吗？**  
A: 否。只跑 emit 后的 JS（ESM）。

**Q: 和 ZLua 能混用吗？**  
A: 可同工程并存（不同 AppDomain 门面），语义对齐但 VM 不同。

**Q: Demo 打不开？**  
A: 检查已支持的 Unity / 团结版本（见 [兼容性](/docs/getting-started/compatibility/)）、包 \`file:\` 路径、Node（仅 ts-demo）。
`,
);

w(
  'community/testing.md',
  `---
sidebar_position: 2
title: 测试
description: 内部矩阵与冒烟。
---

# 测试

内部以 ZenTSTest 矩阵与冒烟为准（Editor Mono / Il2Cpp Player）。社区复现请附最小工程与日志。规范用例语义见各 \`spec/**\` 章节。
`,
);

w(
  'community/migration.md',
  `---
sidebar_position: 3
title: 迁移
description: 从其它 JS 方案迁入。
---

# 迁移

从 Puerts 等方案迁入时：先对齐模块加载与类型导出模型，再替换调用点。适配器思路见 [12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/)。
`,
);

w(
  'community/contact.md',
  `---
sidebar_position: 4
title: 联系方式
description: QQ、Discord、Issue 与仓库。
---

# 联系方式

- QQ 群：\`1095435513\`（ZenTS 交流群）
- Discord：[https://discord.gg/5bT7w9aRMz](https://discord.gg/5bT7w9aRMz)
- 源码与 Issue：[focus-creative-games/zen-ts](https://github.com/focus-creative-games/zen-ts)
- Demo：[zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)
- 文档站：[zen-ts.com](https://zen-ts.com/)；文档源码 [zen-ts-doc](https://github.com/focus-creative-games/zen-ts-doc)
- 邮件：\`zts@code-philosophy.com\`
`,
);

// impl
w(
  'impl/MONO.md',
  `---
sidebar_position: 1
title: Mono 实现
description: Editor Mono 路径笔记。
---

# Mono 实现

Editor 侧通过 Expression Emit 等方式完成绑定与调用门闸；**不覆盖** [spec](/docs/category/spec/) 语义。源码主要在包 \`Runtime/Mono/**\`。
`,
);

w(
  'impl/IL2CPP.md',
  `---
sidebar_position: 2
title: Il2Cpp 实现
description: zents-runtime C++ 路径笔记。
---

# Il2Cpp 实现

Player 热路径在 \`zents-runtime\`（\`jvm/\`、\`mt/\`、\`marshal/\` 等）。开发迭代常在导出工程 \`Build-Win64/.../libil2cpp/zents\`，再 sync 回包。细节索引随版本补充；语义仍以 spec 为准。
`,
);

w(
  'impl/overview.md',
  `---
sidebar_position: 0
title: 实现索引
description: Architecture 侧栏入口。
---

# 实现索引

| 文档 | 内容 |
|------|------|
| [Mono](/docs/impl/MONO/) | Editor Emit |
| [Il2Cpp](/docs/impl/IL2CPP/) | C++ 运行时 |

规范文档在 Docs 侧栏 **规范文档**；本侧栏只谈实现对照。
`,
);

w(
  'README.md',
  `# docs/

- 中文默认内容在本目录。
- \`spec/\` 由 \`npm run sync-spec\` 从 \`../ZenTSTest/Docs/spec\` 同步，请勿手改后期望保留。
- 英文副本：\`npm run sync-i18n-en\` → \`i18n/en/...\`。
`,
);

console.log('all content pages written');
