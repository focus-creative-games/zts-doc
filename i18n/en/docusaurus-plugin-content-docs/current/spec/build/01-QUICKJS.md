---
sidebar_position: 1
title: "QuickJS 构建"
---
:::note 文档站副本
本页为语义契约的发布副本；请在上游 `ZTSTest/Docs/spec` 修改后执行 `npm run sync-spec`。（源：`build\01-QUICKJS.md`）
:::


# 构建 — QuickJS

> 本文约定 ZTS 在 **Editor（Mono）** 与 **Il2Cpp Player** 上如何接入 **QuickJS**。
> Mono callback gate 见 [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md)。
> 包布局、Install、Define、`ZTSConf.inc` 见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md)。
> 本文 **不改变** JavaScript 可见互操作语义（`spec/**` 仍为权威）。

---

## 1. 引擎定位

ZTS **仅** 支持 QuickJS 作为 JavaScript 引擎；**不存在** ZLua 式的多引擎矩阵（无 PUC-Rio / LuaJIT 切换）。

| 层 | 约定 |
|----|------|
| Settings | `quickjsVersionId`（如 `quickjs-2026-06-04`） |
| Editor | 动态库逻辑名 **`quickjs`** → `Plugins/quickjs/quickjs.dll`（或平台等价物） |
| Il2Cpp | 上游 **可编译 C 源码** 安装到 `Local.../libil2cpp/quickjs` |
| Define | `ZTS_QUICKJS`（及 Install 写入的 Unity 版本相关宏，见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) §7） |

**原则：**

- **Editor** 通过 `DllImport("quickjs")` 加载 Plugins 动态库；`ZTS.Mono` 经 P/Invoke 调用 QuickJS API。
- **Il2Cpp** 中 `zts-runtime` 与 QuickJS 源码 **静态编进同一 native 产物**；不经托管 P/Invoke 热路径。
- Il2Cpp 使用包内 **vendored** 树 **`ZTS~/quickjs-il2cpp/`**（已含 MSVC/Bee 适配）；**不对 QuickJS 使用 patch 机制**。升版本时直接更新该目录。

---

## 2. Il2Cpp 源码树（权威：`ZTS~/quickjs-il2cpp`）

上游参考：`d:\workspace\zts\quickjs`。包内 **`VERSION`** 记录 pin（当前 **`2026-06-04`** → Settings id `quickjs-2026-06-04`）。

### 2.1 核心（vendored 树内）

| 文件 | 职责 |
|------|------|
| `quickjs.c` / `quickjs.h` | VM、对象模型、`JSRuntime` / `JSContext`、API |
| `cutils.c` / `cutils.h` | 通用工具 |
| `libregexp.c` / `libregexp.h` / `libregexp-opcode.h` | RegExp 引擎 |
| `libunicode.c` / `libunicode.h` / `libunicode-table.h` | Unicode 表与辅助 |
| `dtoa.c` / `dtoa.h` | 浮点 ↔ 字符串 |
| `list.h` | intrusive 链表 |
| `quickjs-atom.h` | atom 常量 |
| `quickjs-opcode.h` | 字节码 opcode |
| `zts_il2cpp_config.h` / `zts_qjs_std_stubs.c` | MSVC/Il2Cpp 适配与 `js_std_*` stubs |

### 2.2 libc

| 文件 | 职责 |
|------|------|
| `quickjs-libc.h` | 声明（保留） |
| `zts_qjs_std_stubs.c` | 替代 POSIX `quickjs-libc.c`（Win/Il2Cpp **不**编入 libc.c） |

Editor DLL 仍可按需用完整 `quickjs-libc` 构建（`mono-native` / Plugins）。

### 2.3 独立入口（**不得** 进入 `libil2cpp/quickjs`）

| 文件 | 原因 |
|------|------|
| `qjs.c` | QuickJS 独立解释器入口 |
| `qjsc.c` | 字节码编译器 CLI |
| `run-test262.c` | test262 驱动 |
| `quickjs-libc.c` | POSIX；Il2Cpp 用 stubs |

同理排除：`tests/`、`fuzz/`、`examples/`、`unicode_gen.c`、`.github/` 等。

### 2.4 为何用 vendored 白名单树

- 避免 CLI / fuzz 编进 Il2Cpp；
- MSVC + Bee 合编适配已固化，避免 Install 时 fragile 字符串 patch；
- 树体积约 2–3MB，可随包分发。

---

## 3. Install 行为（Il2Cpp）

Install 流水线细节见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) §3。与本引擎相关的步骤摘要：

1. 读取 **`ZTS~/quickjs-il2cpp/VERSION`**，同步 Settings **`quickjsVersionId`**。
2. **整目录拷贝** `ZTS~/quickjs-il2cpp/` → **`Local.../libil2cpp/quickjs/`**（去掉 README；确认无 §2.3 文件）。**无** QuickJS patch 步骤。
3. 写入 Scripting Define **`ZTS_QUICKJS`** 与 **`ZTSConf.inc`**。
4. 将 **`ZTS~/zts-runtime`** 覆盖到 **`Local.../libil2cpp/zts`**。

**开发期可编辑参考：** `Build-Win64/Il2CppOutputProject/IL2CPP/libil2cpp/quickjs`；改动回写到 **`ZTS~/quickjs-il2cpp`**。

---

## 4. Editor 动态库

### 4.1 命名（锁定）

| 项 | 约定 |
|----|------|
| **逻辑名** | **`quickjs`**（**不是** `qjs`；`qjs.c` 仅为 upstream CLI 名） |
| **C# 常量** | `QuickJsDllName.QUICKJS_DLL = "quickjs"` |
| **Windows** | `Packages/com.code-philosophy.zts/Plugins/quickjs/win32-x64/quickjs.dll` |
| **macOS** | `Plugins/quickjs/darwin-universal/quickjs.dylib`（或分 `darwin-arm64` / `darwin-x64`） |
| **Linux Editor** | `Plugins/quickjs/linux-x64/quickjs.so`（可选随包或自建） |

缺 Editor 动态库时 Install **警告、不失败**；开发者自行编译 upstream QuickJS 为 shared library 并放入上述目录。替换已加载 DLL 后须 **重启 Editor**（Windows 文件锁）。

### 4.2 构建 upstream 为 Editor DLL（维护者 / 开发者）

自 QuickJS 源码树（含 `quickjs-libc`）编译 **shared** 库，**不** 链入 `qjs.c` / `qjsc.c`：

**Windows（MSVC，示意）：**

```bat
cl /O2 /LD /MD quickjs.c cutils.c libregexp.c libunicode.c dtoa.c quickjs-libc.c ^
   /Fe:quickjs.dll /D CONFIG_VERSION=\"2026-06-04\"
```

**macOS / Linux（clang/gcc，示意）：**

```bash
cc -O2 -fPIC -shared -o libquickjs.dylib \
  quickjs.c cutils.c libregexp.c libunicode.c dtoa.c quickjs-libc.c
```

产物命名须与 §4.1 一致（Windows **`quickjs.dll`**；Unix 可为 `libquickjs.so` / `libquickjs.dylib`，由 Unity `PluginImporter` + `DllImport` 映射规则对齐 **`quickjs`** 逻辑名）。

### 4.3 Editor 与 Player 版本关系

Editor DLL 与 Il2Cpp 内嵌源码 **不必 patch 级完全一致**，但须：

- 同一 **API 族**（QuickJS 主版本线一致）；
- **`quickjsVersionId` fingerprint** 可诊断二者偏差；
- 切换 `quickjsVersionId` 后 **同时** 更新 Editor DLL 与重新 Install。

### 4.4 Mono callback gate

Editor 上 JS→C# 回调 **不得** 在托管 reverse-P/Invoke 帧内直接 **`JS_Throw`**。须经 [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md) 的 native gate。Il2Cpp **不** 使用该 gate。

---

## 5. Il2Cpp 平台面

QuickJS 源码进树后，凡 Unity / 团结 **Il2Cpp 常规支持的目标**均可按 Unity 流程构建，包括但不限于 **Win64 / Android / iOS / WebGL / 微信小游戏 / 鸿蒙 / 车机** 等桌面、移动、小游戏与车载目标；**无**「仅移动平台 + 外置静态库」的特例（区别于 ZLua LuaJIT 模型）。平台矩阵见 [兼容性](/docs/getting-started/compatibility/)。

| 注意 | 说明 |
|------|------|
| **WebGL / 小游戏** | 允许；须确认 QuickJS 编译选项与 Il2Cpp WASM / 小游戏工具链兼容（见 `impl/IL2CPP.md`） |
| **线程** | ZTS v1 为 **单主 `JSContext`**（[10-LIFETIME.md](../10-LIFETIME.md) §6）；QuickJS Worker API **不在** v1 规范范围 |
| **bigint** | 引擎支持 bigint，但 ZTS v1 **禁止** bigint 作为 CLR 整数通道（[00-OVERVIEW.md](../00-OVERVIEW.md) §1.3） |

---

## 6. ES Module 与宿主 loader

ZTS 宿主在 `TsAppDomain.Initialize` 安装 **ES module loader**（[01-HOST-API.md](../01-HOST-API.md) §1.3），与 QuickJS **`JS_SetModuleLoaderFunc`** / `JS_SetModuleLoaderFunc2` 集成：

| 项 | 约定 |
|----|------|
| 业务模块 | 经 C# `moduleLoader(specifier)` 返回 **JS** 源码（TS 须先 emit；canonical **不含** `.js`，见 [14-TYPESCRIPT.md](../14-TYPESCRIPT.md)）；**不** 默认走磁盘 `import.meta.url` |
| **`csharp:` 类型模块** | ZTS 保留前缀；**不** 经 `moduleLoader`；合成 named export 为 CLR 类型对象（[02-TYPE-SYSTEM.md](../02-TYPE-SYSTEM.md) §2.11） |
| 内置 / 原生模块 | 经 `JS_SetModuleLoaderFunc` 或编译期 `js_init_module_*` 注册（见 [05-NATIVE-MODULES.md](./05-NATIVE-MODULES.md)） |
| `GetFunction` | 按模块 **命名导出** 绑定 Delegate；与静态 `import { x } from "mod"` 一致 |

Install **不** 替换 QuickJS module 系统；ZTS 在 `zts-runtime` 层挂载 loader opaque 指向托管回调。

---

## 7. 包内布局（与 Install 源）

权威包数据根：`Packages/com.code-philosophy.zts/ZTS~/`

```
ZTS~/
├── zts-runtime/              # 安装时 → libil2cpp/zts
│   ├── ZTSCommon.h
│   ├── QuickJsCompatible.h
│   ├── Il2CppCompatible.h
│   └── generated/
│       └── ZTSConf.inc       # Install 写入（见 11-MULTI-VERSION §12）
├── patches/
│   ├── libil2cpp/            # Unity 版本 floor patch
│   └── quickjs/              # QuickJS 版本 floor patch（可选）
├── jslib/                    # ztslib.js 等
└── link.xml
```

**不随包携带** QuickJS 上游完整源码；Install 从 **`Library/ZTS/QuickJsSrcCache`** 读取（见 [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) §2）。

---

## 8. 检查清单（例：`quickjs-2026-06-04`）

- [ ] Settings `quickjsVersionId` 正确；源码已在 `QuickJsSrcCache`
- [ ] 执行 Install；`Local.../libil2cpp/quickjs` 含 §2.1 文件且无 `qjs.c` / `qjsc.c`
- [ ] `Plugins/quickjs/` 下 **`quickjs` 逻辑名** 动态库就位；重启 Editor
- [ ] Define 含 **`ZTS_QUICKJS`**
- [ ] Editor 已部署 [callback gate](./03-MONO-CALLBACK-GATE.md) 原生库
- [ ] `ZTSConf.inc` 与 fingerprint 一致

---

## 9. 与其它文档的分工

| 文档 | 内容 |
|------|------|
| [11-MULTI-VERSION.md](../11-MULTI-VERSION.md) | UPM、Install 顺序、patch floor、Define、`ZTSConf.inc` |
| **本文** | QuickJS 源文件白名单、Editor **`quickjs`** DLL、Il2Cpp 源码进树 |
| [03-MONO-CALLBACK-GATE.md](./03-MONO-CALLBACK-GATE.md) | Editor `JS_Throw` 安全边界 |
| [04-JS-DEBUGGER.md](./04-JS-DEBUGGER.md) | Editor 可选 JS 调试 hook |
| [05-NATIVE-MODULES.md](./05-NATIVE-MODULES.md) | QuickJS C 模块 / 第三方原生扩展 |
