---
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
A: 检查已支持的 Unity / 团结版本（见 [兼容性](/docs/getting-started/compatibility/)）、包 `file:` 路径、Node（仅 ts-demo）。
