---
sidebar_position: 11
title: "多版本管理"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`11-MULTI-VERSION.md`）
:::


# 11 — 多版本管理（Unity / QuickJS / 安装）

> 包内 **不** 携带完整 `libil2cpp` 树；安装时在当前 Unity 自带源码上叠加 **patch + zts-runtime + 选定 QuickJS**。
> 本文是 UPM 包布局、`LocalInstaller`、QuickJS 版本 pin、原生 DLL 命名，以及 Il2Cpp **`ZTSConf.inc` / Compatible 头** 的实现规范。
> JavaScript 可见语义仍以本目录其它 spec 为准；本文 **不改变** 互操作语义。
> **无** 多引擎矩阵 — **仅 QuickJS**（见 [build/01-QUICKJS.md](./build/01-QUICKJS.md)）。

---

## 1. 目标与非目标

### 1.1 目标

| 目标 | 说明 |
|------|------|
| **可升级 Unity** | 不随每个 Unity 版本整包携带 `libil2cpp` |
| **可 pin QuickJS** | Settings 指定 **`quickjsVersionId`**；源码缓存于 `QuickJsSrcCache` |
| **Editor DLL 固定逻辑名** | **`quickjs`**（见 [build/01-QUICKJS.md](./build/01-QUICKJS.md) §4） |
| **改动可审计** | 对 Unity `libil2cpp` 与 QuickJS 的修改以 **patch 文件** 存在 |
| **失败可见** | patch 上下文不匹配或缺少源码时 Install **失败并报错**，禁止静默跳过 |

### 1.2 非目标（本阶段）

| 项 | 说明 |
|----|------|
| 同 Editor 进程内热切换已加载的 `quickjs.dll` | Windows 下已加载 DLL 无法可靠覆盖；换 pin 后须 **重启 Editor** |
| 随包携带每个 QuickJS 日期的 Editor DLL | 需要时开发者自行编译 upstream 并替换 `Plugins/quickjs/` |
| 在只读 Package 内生成并引用 C# 源文件 | UPM 缓存只读；`QUICKJS_DLL` 常量固定为 **`quickjs`** |
| 一次交付全部历史 QuickJS / Unity 组合 | 先打通主推组合（见 §10），再按需加 patch |

---

## 2. 包内目录布局（`ZTS~`）

权威包数据根：`Packages/com.code-philosophy.zts/ZTS~/`

```
ZTS~/
├── zts-runtime/              # ZTS native，安装时 → libil2cpp/zts
│   ├── ZTSCommon.h           # 组装 Compatible + QuickJS 版本映射
│   ├── QuickJsCompatible.h   # QuickJS API shim（手写）
│   ├── Il2CppCompatible.h    # 多 Unity / 团结 il2cpp API shim（手写）
│   └── generated/
│       └── ZTSConf.inc       # Install/Generate 写入（仅宏，见 §12）
├── quickjs-il2cpp/           # Il2Cpp 用 vendored QuickJS（整目录 Install，无 patch）
│   ├── VERSION               # 如 2026-06-04
│   ├── quickjs.c / quickjs.h
│   ├── zts_il2cpp_config.h
│   ├── zts_qjs_std_stubs.c
│   └── …
├── patches/
│   └── libil2cpp/
│       ├── 2021.3/
│       │   └── 2021.3.0.patch
│       ├── 2022.3/
│       │   └── 2022.3.0.patch
│       ├── 6000.5/
│       │   └── 6000.5.6.patch
│       └── 6000/
│           └── 6000.0.0.patch
├── jslib/                    # ztslib.js 等
├── types/                    # zts.d.ts、tsconfig.base.json（编辑期；见 [14-TYPESCRIPT.md](./14-TYPESCRIPT.md)）
└── link.xml
```

Editor DLL 维护可另用 `Library/ZTS/QuickJsSrcCache/`（可选，非 Install 必需）。

### 2.1 目录 / 版本 id 命名

| 种类 | 规则 | 示例 |
|------|------|------|
| Settings id | `quickjs-{VERSION}`，与 **`ZTS~/quickjs-il2cpp/VERSION`** 一致 | `quickjs-2026-06-04` |
| Il2Cpp 源码 | 包内 vendored | `ZTS~/quickjs-il2cpp/` |
| （可选）上游缓存 | 仅 Editor DLL / 维护参考 | `QuickJsSrcCache/quickjs-2026-06-04/` |
| Unity patch 目录 | `patches/libil2cpp/{major}.{minor}/`，Unity 6 可回退 `{major}/` | `2022.3/`、`6000/` |
| Unity patch 文件 | `{major}.{minor}.{patch}.patch` | `2022.3.0.patch` |

**禁止** 在 `ZTS~` 下放置完整 `libil2cpp-{unity}` 树。QuickJS **Il2Cpp** 源码以 **`quickjs-il2cpp/`** 为准；**不**再使用 `patches/quickjs`。

### 2.2 开发期源码权威

| 内容 | 开发编辑位置 | 合入包内 |
|------|--------------|----------|
| `zts` C++ | `Build-Win64/.../libil2cpp/zts` | 同步到 `ZTS~/zts-runtime` |
| QuickJS（Il2Cpp） | `Build-Win64/.../libil2cpp/quickjs` | 回写 `ZTS~/quickjs-il2cpp` |
| 对 Unity `libil2cpp` 的改动 | `patches/libil2cpp` | **不** 提交整棵 libil2cpp |

---

## 3. 安装流水线（`LocalInstaller`）

安装输出根：`Library/ZTS/LocalIl2CppData-{platform}/`（路径以 `CommonDirs` 为准）。

### 3.1 顺序（必须）

1. 读取 **`ZTS~/quickjs-il2cpp/VERSION`**，同步 Settings **`quickjsVersionId`**
2. 从当前 Editor 复制官方 `il2cpp`（含 **stock** `libil2cpp`）到 Local 目录
3. 解析并应用 **libil2cpp patches**（§4）
4. 将 `ZTS~/zts-runtime` **复制/覆盖** 到 `Local.../libil2cpp/zts`
5. 将 **`ZTS~/quickjs-il2cpp`** **整目录拷贝**到 `Local.../libil2cpp/quickjs`（**无** QuickJS patch；排除 CLI / `quickjs-libc.c`）
6. 写入工程 **Scripting Define Symbols**（§7）
7. 写入 **`ZTSConf.inc`**（§12；权威输出在 Local `libil2cpp/zts/generated/`）
8. 若包内缺少 Editor **`quickjs`** 插件 DLL，**警告**（不阻断 Install）
9. 写入 **install fingerprint**（§9；`quickjsPatchKey=vendored`）
10. 清理 Il2Cpp / Bee 缓存；版本 pin / Define 变更时提示 **重启 Editor**

### 3.2 与旧行为的差异

| 旧 | 新 |
|----|----|
| 用包内完整 `libil2cpp-*` **整目录替换** | stock + patch + `zts-runtime` + vendored quickjs |
| `QuickJsSrcCache` + `patches/quickjs` | **`ZTS~/quickjs-il2cpp` 整树拷贝**（无 QuickJS patch） |
| 多 Lua 引擎矩阵 | **无**；仅 QuickJS |

---

## 4. libil2cpp patch 选择

对 Unity stock `libil2cpp` 的修改应尽量少（量级：数十行 hook），一律以 patch 文件维护。

### 4.1 选择算法

设当前 Unity 为 `2022.3.62f1`（比较时忽略 `f1` 等字母后缀）：

1. 按序尝试系列目录：`{major}.{minor}/`；若 `major >= 6000` 再回退 `{major}/`
2. 在**第一个存在的**系列目录内：
   - 若存在精确 `{major}.{minor}.{patch}.patch` → **选用**
   - 否则取版本号 **≤** 当前 Unity 的 **最大** floor 文件
3. 无可用 patch → **Install 失败**
4. apply 失败 → **Install 失败**（不得静默换文件）

### 4.1.1 已维护系列（示意）

| 目录 | 基线 Editor | 适用范围 | floor 文件 |
|------|-------------|----------|------------|
| `2021.3/` | 2021.3.45f2 | 2021.3.x | `2021.3.0.patch` |
| `2022.3/` | 2022.3.62f3 | 2022.3.x | `2022.3.0.patch` |
| `6000.5/` | 6000.5.6f1 | 6000.5.x | `6000.5.6.patch` |
| `6000/` | 6000.0.71f1 | 6000.0.x / 回退 | `6000.0.0.patch` |

### 4.2 与 `zts-runtime` 的边界

| 归属 | 内容 |
|------|------|
| `patches/libil2cpp` | 对 Unity 原有文件的插入/小改（初始化、编译列表、`TsAppDomain::Initialize` hook 等） |
| `zts-runtime` | ZTS 自有源码树 |

---

## 5. QuickJS（Il2Cpp vendored）

| 行为 | 说明 |
|------|------|
| 源码位置 | **`ZTS~/quickjs-il2cpp/`**（含 `VERSION`、核心 `.c/.h`、`zts_*` 适配与 stubs） |
| Install | **整目录拷贝** → `Local.../libil2cpp/quickjs`；**无** `patches/quickjs`、**无** Install 时字符串 patch |
| 校验 | `VERSION` 与 Settings id 后缀一致；须有 `quickjs.c` + `zts_qjs_std_stubs.c` |
| fingerprint | `quickjsPatchKey` 固定为 **`vendored`** |
| 升版本 | 更新 `quickjs-il2cpp` 目录内容与 `VERSION`，再 Install |

Editor DLL 仍可从独立上游 / `QuickJsSrcCache` / `mono-native` 构建，与 Il2Cpp vendored 树解耦。

---

## 6. Settings：选定 QuickJS 版本

| 字段 | 含义 |
|------|------|
| `quickjsVersionId` | 如 `quickjs-2026-06-04`；空见 §6.2 |

### 6.1 变更后义务

切换后须重新 Install；Define / Editor DLL 变更后提示重启 Editor。未 Install 或 fingerprint 不匹配时，Il2Cpp 打包应阻断。

### 6.2 默认版本

- 字段默认值 / 空值：与 **`ZTS~/quickjs-il2cpp/VERSION`** 对齐（当前 **`quickjs-2026-06-04`**）
- Install 时从 vendored `VERSION` 写回 Settings
- vendored 树缺失 → Install 失败；**不得**静默改用其它版本

---

## 7. 编译符号（Scripting Define Symbols）

由 Installer 写入 **工程** Define。

### 7.1 宏命名

| 宏 | 何时定义 | 用途 |
|----|----------|------|
| **`ZTS_QUICKJS`** | **始终**（ZTS 启用时） | 标识 QuickJS 引擎路径；与旧文档中泛化「脚本引擎」宏对齐 |
| `ZTS_QUICKJS_VERSION_20260604` | 可选；当需要 **C# 条件编译** 区分 pin 时 | 由 `quickjsVersionId` 解析；**非** 每个 patch 级宏 |

说明：

- **不需要** Lua 式 `ZTS_LUA_5_4` 多 API 族宏 — **仅 QuickJS**。
- 精确 pin 字符串对账用 **`ZTSConf.inc`** 的 **`ZTS_CONF_ID`** 与 fingerprint（§9），**不要** 为每个 DATE 新增永久 C# 宏（除非 §7.1 可选宏已启用）。

### 7.2 互斥

移除其它引擎遗留宏（若工程从 ZLua 迁移）；同一时刻仅 **`ZTS_QUICKJS`** 脚本引擎 define 集。

---

## 8. 原生 DLL 命名与 `QuickJsDllName`

### 8.1 随包策略

| 项 | 规则 |
|----|------|
| **逻辑名** | **`quickjs`**（锁定；不是 `qjs`） |
| **布局** | `Plugins/quickjs/<platform>/quickjs.{dll,dylib,so}` |
| **Gate** | 同目录 `zts_mono_gate*`（见 [build/03-MONO-CALLBACK-GATE.md](./build/03-MONO-CALLBACK-GATE.md)） |
| **Install** | 缺失 Editor DLL **警告**，不失败 |

切换 **`quickjsVersionId`** 只改变 Il2Cpp 内嵌源码树；**不改变** `DllImport` 逻辑名 — 开发者 **须** 自行替换物理 DLL 以匹配新 pin。

### 8.2 `QuickJsDllName.cs`

建议路径：`Packages/com.code-philosophy.zts/Runtime/Mono/Lvm/QuickJsDllName.cs`

```csharp
namespace ZTS
{
    public static class QuickJsDllName
    {
#if UNITY_IPHONE && !UNITY_EDITOR
        public const string QUICKJS_DLL = "__Internal";
#else
        public const string QUICKJS_DLL = "quickjs";
#endif
    }
}
```

Il2Cpp Player 侧 QuickJS 符号来自 **静态链接**，不经该 DLL 名；Editor **始终** `quickjs`。

### 8.3 Windows 加载锁定

换 pin 后替换 `quickjs.dll` 须 **重启 Editor**。Install 在 pin 或 Define 变更时须提示重启。

---

## 9. Fingerprint 与重新安装

Fingerprint 至少包含：

| 字段 | 说明 |
|------|------|
| `unityVersion` | 安装时的 `Application.unityVersion` |
| `quickjsVersionId` | 实际使用的 id |
| `libil2cppPatchKey` | 选用的 Unity patch 文件键 |
| `quickjsPatchKey` | 固定 `vendored`（Il2Cpp 使用包内 `quickjs-il2cpp`） |
| `packageContentStamp` | 包内容变更戳 |
| `defines` | 写入的 `ZTS_*` 集合 |

以下任一变化 → `NeedReinstall` 为真：

- 包内容戳变化
- Settings `quickjsVersionId` 与 fingerprint 不一致
- 当前 Unity 版本与 fingerprint 不一致
- Local 树缺失

---

## 10. 分阶段支持范围

| 阶段 | 范围 |
|------|------|
| **P0** | 默认 `quickjs-2026-06-04` + Unity `2022.3` patch + `zts-runtime` + Editor `quickjs.dll` |
| **P1** | Unity `2021.3` / `6000.x` patch 系列 + callback gate 随包 |
| **P2** | 可选 JS 调试扩展包 + 原生 C 模块 bootstrap（[build/05-NATIVE-MODULES.md](./build/05-NATIVE-MODULES.md)） |

---

## 11. 实现检查清单

- [ ] `ZTS~` 无完整 libil2cpp、无随包 QuickJS 上游源码
- [ ] QuickJS：仅接受 `QuickJsSrcCache/{quickjsVersionId}`
- [ ] 默认 `quickjsVersionId` = `quickjs-2026-06-04`
- [ ] Plugins `quickjs` DLL 缺失仅警告
- [ ] libil2cpp / quickjs patch floor 失败不降级
- [ ] Define **`ZTS_QUICKJS`** / fingerprint / 重启提示齐全
- [ ] `QuickJsCompatible.h` / `Il2CppCompatible.h` / `ZTSConf.inc` 符合 §12
- [ ] Install 写 Local `ZTSConf.inc`；Generate/All 校验或复写

---

## 12. Il2Cpp 运行时兼容层（`ZTSConf` / Compatible）

> 本节只约束 **Il2Cpp Player** 原生树（`zts-runtime`）。
> **Editor Mono** 使用 §7 Scripting Define + §8 `QuickJsDllName`，**不** 消费 `ZTSConf.inc`。

### 12.1 设计目标

| 真相源 | 表达内容 |
|--------|----------|
| **生成的 `ZTSConf.inc`** | QuickJS pin id、Unity / 团结版本、对账字符串 |
| **QuickJS 头文件** | 引擎 API；经 `ZTSCommon.h` 引用 |
| **手写 Compatible 头** | Unity API 差、QuickJS 小版本 shim |

### 12.2 文件职责

| 文件 | 性质 | 职责 |
|------|------|------|
| `zts-runtime/generated/ZTSConf.inc` | **生成** | 仅宏；勿手改 |
| `zts-runtime/QuickJsCompatible.h` | 手写 | `#include "quickjs.h"` + API shim |
| `zts-runtime/Il2CppCompatible.h` | 手写 | 团结 vs Unity il2cpp API 差 |
| `zts-runtime/ZTSCommon.h` | 手写 | 组装上述头；架构宏 |

**`ZTSCommon.h` include 顺序：**

1. `generated/ZTSConf.inc`
2. `QuickJsCompatible.h`
3. `Il2CppCompatible.h`

### 12.3 `ZTSConf.inc` 生成宏

| 宏 | 取值 | 说明 |
|----|------|------|
| `ZTS_QUICKJS` | `1` | 固定为 QuickJS 路径 |
| `ZTS_QUICKJS_VERSION_DATE` | 整数 `YYYYMMDD` | 由 VERSION 解析，如 `20260604` |
| `ZTS_TUANJIE_ENGINE` | `0` \| `1` | 团结 vs Unity |
| `ZTS_UNITY_VERSION` | 十进制整数 | `YYYY*10000+minor*100+patch` |
| `ZTS_TUANJIE_VERSION` | `0` 或十进制 | Unity 上为 `0` |
| `ZTS_CONF_ID` | 字符串字面量 | 例：`"quickjs-2026-06-04|unity-2022.3.62|tuanjie-0"` |

**数值编码禁止前导 `0`**（八进制陷阱）。

### 12.4 生成时机

| 步骤 | 职责 |
|------|------|
| **`LocalInstaller`（权威）** | Install 成功写入 Local `libil2cpp/zts/generated/ZTSConf.inc` |
| **`ZTS/Generate/All`（校验）** | 复写或校验；不一致则失败 |
| **Player 编译** | **只认** Local 树 conf |

### 12.5 示例

```c
/* Generated by ZTS Install/Generate. Do not edit. */
#define ZTS_QUICKJS                 1
#define ZTS_QUICKJS_VERSION_DATE    20260604
#define ZTS_TUANJIE_ENGINE          0
#define ZTS_UNITY_VERSION           20220362
#define ZTS_TUANJIE_VERSION         0
#define ZTS_CONF_ID                 "quickjs-2026-06-04|unity-2022.3.62|tuanjie-0"
```

### 12.6 与 Mono / C# Define 对照

| Il2Cpp（conf） | Editor Mono |
|----------------|-------------|
| `ZTS_QUICKJS`（1） | `#define ZTS_QUICKJS` |
| `ZTS_QUICKJS_VERSION_DATE` | 可选 `ZTS_QUICKJS_VERSION_*` 宏 |
| `ZTS_UNITY_*` / `ZTS_TUANJIE_*` | 无对等 conf |
| QuickJS API | P/Invoke **`quickjs.dll`** |

---

## 13. 文档地图

| 主题 | 文档 |
|------|------|
| QuickJS 源白名单 / Editor DLL | [build/01-QUICKJS.md](./build/01-QUICKJS.md) |
| Mono callback gate | [build/03-MONO-CALLBACK-GATE.md](./build/03-MONO-CALLBACK-GATE.md) |
| JS 调试 hook | [build/04-JS-DEBUGGER.md](./build/04-JS-DEBUGGER.md) |
| 原生 C 模块 | [build/05-NATIVE-MODULES.md](./build/05-NATIVE-MODULES.md) |
| TypeScript 工作流 / `ZTS~/types` | [14-TYPESCRIPT.md](./14-TYPESCRIPT.md) |
