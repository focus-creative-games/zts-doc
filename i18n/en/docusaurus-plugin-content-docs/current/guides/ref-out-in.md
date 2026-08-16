---
sidebar_position: 11
title: ref / out / in
description: ByRef 参数约定。
---

# ref / out / in

ByRef 参数在 JS 侧通常通过可变容器或专用约定回写；Il2Cpp 路径对 struct 等有直接写回优化。见 [marshal/03-BYREF](/docs/spec/marshal/03-BYREF/) 与 [05-STRUCT](/docs/spec/marshal/05-STRUCT/)。
