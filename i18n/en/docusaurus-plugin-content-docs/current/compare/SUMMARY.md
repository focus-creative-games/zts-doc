---
sidebar_position: 2
title: 选型摘要
description: 何时选 ZTS。
---

# 选型摘要

> **性质：** 选型与阅读导航，**不是** ZTS 行为规范。  
> **覆盖：** 何时优先 ZTS、何时暂缓迁移、本目录怎么读。

## 本目录

| 文件 | 内容 |
|------|------|
| [FEATURES.md](/docs/compare/FEATURES/) | 特性与用法：ZTS vs Puerts vs 自管 QuickJS；与 ZLua 语义同构说明 |
| 本页（SUMMARY） | 选型一句话 + 阅读顺序 + 诚实边界 |

目前 **没有** 公开四方实测数字页；有数据后再补，**不编造基准**。方法论可对照 [ZLua 性能对比](https://doc.zlua.cn/docs/compare/PERFORMANCE/)（那是 Lua 方案，不可直接当 ZTS 数字）。

## 对比对象（一句话）

| 方案 | 典型定位 | 与 ZTS 的关系 |
|------|----------|----------------|
| **ZTS** | JS/TS ↔ C# 完备互操作；Editor Mono + Il2Cpp Player；懒绑定 | 本文档树的「被评估方」 |
| **Puerts** | Unity 上成熟的 JS/TS 方案；常有 StaticWrap / 导出配置 | 迁移源之一；类型路径可用 adaptor（`CS.*`） |
| **自管 QuickJS** | 极薄嵌入 + 手写/生成绑定 | 包体与控制力强，长期维护成本在你 |
| **ZLua** | 同构语义的 Lua 产品线 | **不是**竞品；心智 / Marshal / Host 对齐，可同工程并存 |
| **[zts-ue](https://github.com/focus-creative-games/zts-ue)** | Unreal Engine · TypeScript（C++ 优化） | **同族**；**开发中**；本站不覆盖 UE |

## 何时选谁（诚实摘要）

| 更适合 | 建议 |
|--------|------|
| 需要 **JS/TS + 完备 C# 互操作 + Il2Cpp**，并希望与 **ZLua** 共用团队心智 | **优先 ZTS** |
| 已有大型 Puerts 资产、短期不能大改脚本 | **评估适配器 / 渐进迁移**（见 [迁移](/docs/community/migration/)）；不要指望一键语义等价 |
| 只要极薄 QuickJS、可接受手写绑定与自研 Marshal | **自管方案**可能更轻；完备互操作与双端一致性要自己扛 |
| 产品语言是 Lua 而非 JS/TS | 看 [ZLua](https://doc.zlua.cn)，不是本站 |
| 宿主是 **Unreal Engine** | 看 [zts-ue](https://github.com/focus-creative-games/zts-ue)（开发中），不是本站 |

## ZTS 当前状态（诚实说明）

| 维度 | 说明 |
|------|------|
| **阶段** | **Alpha**（见 [项目状态](/docs/getting-started/project-status/)） |
| **Editor Mono** | 日常开发与冒烟；Expression Emit |
| **Il2Cpp Player** | 发布路径（平台以兼容性 / 项目状态为准）；须 Install + **Generate** |
| **性能数字** | **暂无**公开可复现四方表 → 本目录 **不写假 ns / 假倍数** |
| **文档 / 生态** | 建设中；无 Puerts 级社区体量 |

**性能请以 Il2Cpp Player 自测为准**；Mono Editor 不代表发布性能。

## 阅读顺序

1. **选型或迁移前：** 读 [FEATURES.md](/docs/compare/FEATURES/)——类型访问、白名单、C#→脚本、Event、ref、struct、TS 工作流、迁移检查清单。
2. **确认是否愿维护 Il2Cpp 集成：** [为什么选择 ZTS](/docs/concepts/why-zts/)、[双运行时](/docs/concepts/dual-runtime/)、[构建](/docs/guides/build/)。
3. **从 Puerts 等迁入：** [社区迁移指南](/docs/community/migration/) + 契约 [12-MIGRATION-ADAPTORS](/docs/spec/12-MIGRATION-ADAPTORS/)。
4. **行为以 spec 为准：** [规范总览](/docs/spec/00-OVERVIEW/)；对比页与 demo 冲突时听 spec。

## 写作原则

1. **特性 / 用法：** 对照表 + 代码并行示例 + 迁移影响；链到 guides / spec。
2. **性能：** 未公开实测则标「待测 / 无数字」；**禁止**编造基准。
3. 不贬低其它方案的适用场景；写清 ZTS 取舍（libil2cpp 侵入、Generate、TS 闸门等）。
4. 与 ZLua 的关系写清：**语义同构、VM 不同**；不是「ZTS 比 ZLua 快/慢」这类无依据断言。

## 相关文档

| 文档 | 内容 |
|------|------|
| [FEATURES](/docs/compare/FEATURES/) | 特性对比正文 |
| [为什么选择 ZTS](/docs/concepts/why-zts/) | 产品叙事 |
| [迁移](/docs/community/migration/) | 用户向迁移步骤 |
| [FAQ](/docs/community/faq/) | 常见踩坑 |
| [ZLua 对比目录](https://doc.zlua.cn/docs/compare/) | 同构产品线的对比写法参考 |

---

*对比文档随实现演进更新；冲突时 ZTS 行为以 `spec/**` 为准。*
