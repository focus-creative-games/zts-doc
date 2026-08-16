---
sidebar_position: 2
title: 选型摘要
description: 何时选 ZTS。
---

# 选型摘要

- 需要 **JS/TS + 完备 C# 互操作 + Il2Cpp**，并希望与 **ZLua** 共用团队心智 → 优先 ZTS
- 已有大型 Puerts 资产且迁移成本高 → 评估适配器 / 渐进迁移（见 [迁移](/docs/community/migration/)）
- 只要极薄 QuickJS 嵌入、可接受手写绑定 → 自管方案可能更轻，但长期维护成本在你
