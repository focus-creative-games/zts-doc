---
sidebar_position: 4
title: 联系方式
description: QQ、Discord、Issue 与仓库。
---

# 联系方式

## 渠道

- QQ 群：`1095435513`（ZTS 交流群）
- Discord：[https://discord.gg/5bT7w9aRMz](https://discord.gg/5bT7w9aRMz)
- 源码与 Issue：[focus-creative-games/zts](https://github.com/focus-creative-games/zts)
- Demo：[zts-demo](https://github.com/focus-creative-games/zts-demo)
- 文档站：[zts.code-philosophy.com](https://zts.code-philosophy.com/)；文档源码 [zts-doc](https://github.com/focus-creative-games/zts-doc)
- 邮件：`zts@code-philosophy.com`

### 同族产品

| 产品 | 链接 | 备注 |
|------|------|------|
| ZLua（Lua） | [doc.zlua.cn](https://doc.zlua.cn) | 问题请发到对应仓库 / 群，避免混提 |
| **zts-ue**（Unreal） | [focus-creative-games/zts-ue](https://github.com/focus-creative-games/zts-ue) | UE 上的 TypeScript 方案；**开发中**，勿与本站 Unity 问题混提 |

## 提问模板

在 QQ / Discord / Issue 提问时，直接粘贴下面结构（能填多少填多少）：

```text
【环境】
- Unity / 团结版本：
- 平台：Editor（Win / macOS） / Player（Win64 / Android / iOS / WebGL / 小游戏 / 鸿蒙…）：
- ZTS 版本或 commit：
- 纯 JS 还是 TsProject：

【现象】
- 期望：
- 实际：
- 是否仅 Player 失败：

【已做检查】
- [ ] Install
- [ ] Generate/All（Player）
- [ ] 脚本已 Sync / 拷贝到 StreamingAssets
- [ ] canonical 未带 .js
- [ ] 未使用废弃 Event 糖语法

【最小复现】
- 步骤：
- 关键 JS/TS + C# 片段：
- 日志 / 栈：
```

更完整的复现要求见 [测试](/docs/community/testing/)。排障自助：[排障指南](/docs/guides/troubleshooting/)、[FAQ](/docs/community/faq/)。
