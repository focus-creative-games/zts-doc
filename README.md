# ZenTS Docs

ZenTS 静态文档站（Docusaurus 3），域名：[https://zen-ts.com/](https://zen-ts.com/)

## 本地开发

```bash
npm install
npm run sync-spec      # 从 ../ZenTSTest/Docs/spec 同步规范（含链接修正）
npm run sync-i18n-en   # 补齐英文 locale（默认不覆盖已有；加 -- --force 全覆盖）
npm start
```

构建：

```bash
npm run sync-spec
npm run sync-i18n-en -- --force
npm run build
```

> 当前构建关闭了 Mermaid 主题渲染（Docusaurus 3.10 + React 19 SSG 兼容问题）；`sync-spec` 会把 \`\`\`mermaid 降级为文本围栏，图仍可读。

## 内容工作流

| 内容 | 改哪里 |
|------|--------|
| 语义规范 `docs/spec` | 上游 `ZenTSTest/Docs/spec` → `npm run sync-spec` |
| 术语表 | `ZenTSTest/Docs/GLOSSARY.md` → 同上 |
| 教程 / 概念 / 对比 | 直接改 `docs/**`（除 `spec/`） |
| 英文 | `i18n/en/...` 或 `npm run sync-i18n-en -- --force` |

## 相关仓库

- 包：[focus-creative-games/zen-ts](https://github.com/focus-creative-games/zen-ts)
- Demo：[focus-creative-games/zen-ts-demo](https://github.com/focus-creative-games/zen-ts-demo)（`js-demo` / `ts-demo`）
- Unreal（开发中）：[focus-creative-games/zts-ue](https://github.com/focus-creative-games/zts-ue)
- 对照文档：[ZLua Docs](https://doc.zlua.cn)
