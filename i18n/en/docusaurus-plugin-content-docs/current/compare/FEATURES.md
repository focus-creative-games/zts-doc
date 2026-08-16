---
sidebar_position: 1
title: 特性对比
description: ZTS 与 Puerts / 自管 QuickJS 的定性对比。
---

# 特性对比

:::note
本页为**选型辅助**，不是行为契约。契约以 [spec](/docs/category/spec/) 为准。
:::

| 维度 | ZTS | Puerts（典型） | 自管 QuickJS |
|------|-----|----------------|--------------|
| 绑定方式 | 懒绑定，零 per-type Wrap 白名单 | 常需生成/导出配置 | 手写绑定 |
| 与 ZLua 心智 | 同构（门面/Marshal） | 不同 | 无 |
| TypeScript | 官方 TsProject + csharp: | 视方案而定 | 自建 |
| Il2Cpp | 官方 C++ `zts-runtime` | 有成熟路径 | 自建 |
| 完备互操作 | 重载 / ref / struct ByVal… 按 spec | 视版本 | 视实现 |

## 性能

暂无公开四方实测数字时，**不编造基准**。方法论可参考 [ZLua 性能对比](https://doc.zlua.cn/docs/compare/PERFORMANCE/)；ZTS 数据补齐后会更新本页。
