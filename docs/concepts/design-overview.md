---
sidebar_position: 2
title: 设计概览
description: 设计概览
---

# 设计概览

分层（示意）：

```text
C# Host  --GetFunction-->  QuickJS ESM
   ^                         |
   +----- CSharp / csharp: --+
   |
   +--> Editor Mono Emit
   +--> Player Il2Cpp zts-runtime
```

权威分层说明：[00-OVERVIEW](/docs/spec/00-OVERVIEW/)。
