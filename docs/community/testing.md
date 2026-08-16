---
sidebar_position: 2
title: 测试
description: 社区如何验证与最小复现；Editor / Player 矩阵（实用向）。
---

# 测试

> **原则：** 社区验证以 **可复现** 为准；本页不臆造未开源的内部套件细节。  
> **正确性** 对齐各 `spec/**`；**性能基准** 暂无公开四方表（见 [选型摘要](/docs/compare/SUMMARY/)）。

---

## 1. 你该测什么

| 目标 | 建议 |
|------|------|
| 业务冒烟 | 在 **Editor Play** 跑通：`Initialize` → `GetFunction` → JS→C# 主路径 |
| 发版信心 | 同一脚本在 **Il2Cpp Player** 再跑一遍（见下方矩阵） |
| 迁移正确性 | 对照 [迁移检查清单](/docs/community/migration/#改写清单用户向)；Event / ref / strict miss 单独点测 |
| 回归 | 把最小场景留在工程里，发版前手跑或 CI batchmode |

官方示例工程：[zts-demo](https://github.com/focus-creative-games/zts-demo)（`js-demo` / `ts-demo`）。

---

## 2. Editor / Player 矩阵（高阶）

| 维度 | Editor（Mono） | Player（Il2Cpp） |
|------|----------------|------------------|
| 用途 | 日常迭代、调试器、快速失败 | **发布权威**；语义与 Editor 应对齐 |
| Generate | 日常可不每次 | **必须** `ZTS/Generate/All` |
| 脚本路径 | `JsScripts` / `TsProject/out` | `StreamingAssets/Js` 或 `StreamingAssets/ZTS` |
| 断言标准 | 同一套期望行为 | **同一套**；不要「Editor 过就算」 |

**平台原则（实用版）：** 关键互操作路径至少覆盖 **Editor 一次 + 目标平台 Il2Cpp Player 一次**。任一端失败都视为失败，不要用「仅 Mono」当发版依据。

更细的双端差异：[Editor 与 Player](/docs/guides/editor-vs-player/)、[构建](/docs/guides/build/)。

---

## 3. 社区最小复现（提 Issue 前）

请尽量附上：

1. **Unity / 团结版本**、目标平台、ZTS 包版本或 commit  
2. **最小工程或补丁**：能去掉业务后仍复现的场景 / 两三个脚本  
3. **复现步骤**：Editor 还是 Player；是否已 Install / Generate / Sync  
4. **期望 vs 实际**：Console / Player 日志、完整异常栈  
5. **相关片段**：JS/TS named export、`GetFunction` 签名、涉及的 C# 类型（public API）

模板见 [联系方式](/docs/community/contact/#提问模板)。

**不要**只说「Player 挂了」；没有路径与日志时很难定位 Generate / StreamingAssets / loader 问题。

---

## 4. 建议的自测清单（实用）

复制到项目 wiki / PR 描述即可：

- [ ] Editor：`TsAppDomain.Initialize` 成功  
- [ ] Editor：`GetFunction` 调到 named export，返回值正确  
- [ ] Editor：`csharp:` 或 `CSharp` 调到目标类型；含 namespace 用括号键 / 带路径 import  
- [ ] Editor：未知成员 → 抛 `zts:` 错误（strict miss）  
- [ ] Editor：Event 用 `add_` / `remove_`，同一引用可卸  
- [ ] （若用 TS）`tsc --noEmit` 通过；emit **未** bundle；Play 闸门符合预期  
- [ ] Player：已 Generate；StreamingAssets 中有对应 `.js`  
- [ ] Player：重复上述冒烟；无「仅 Editor」依赖  

规范条款级用例语义以 `spec/**` 为准；内部 ZTSTest 矩阵若未随文档开源，**以你工程内可跑通的清单为准**。

---

## 5. 与 Demo / 规范的关系

| 材料 | 用途 |
|------|------|
| [zts-demo](https://github.com/focus-creative-games/zts-demo) | 冒烟与工作流样板 |
| [spec](/docs/category/spec/) | 行为契约；写用例时按章节对齐 |
| [排障](/docs/guides/troubleshooting/) | 失败时的检查表 |
| [FAQ](/docs/community/faq/) | 高频误解 |

---

## 相关文档

- [构建](/docs/guides/build/)
- [Editor 与 Player](/docs/guides/editor-vs-player/)
- [迁移](/docs/community/migration/)
- [联系方式](/docs/community/contact/)
