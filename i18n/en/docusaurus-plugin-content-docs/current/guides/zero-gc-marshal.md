---
sidebar_position: 20
title: 少 GC Marshal
description: Registry / ByVal / Opaque 策略。
---

# 少 GC Marshal

引用类型默认走 Registry；struct 默认 ByVal；热点路径可选用 Opaque。定性说明见 [concepts/marshal-overview](/docs/concepts/marshal-overview/)，契约见 [marshal](/docs/spec/marshal/)。
