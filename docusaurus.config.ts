import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ZTS 文档',
  tagline: '零配置 · 完备 C# 互操作 · QuickJS 上的 TypeScript / JavaScript',

  favicon: 'img/logo.jpg',

  // Keep classic webpack SSG (no @docusaurus/faster) for stable Mermaid-free builds.
  future: {
    v4: false,
  },

  url: 'https://zts.code-philosophy.com',
  baseUrl: '/',
  trailingSlash: true,

  organizationName: 'focus-creative-games',
  projectName: 'zts-doc',

  onBrokenLinks: 'throw',

  markdown: {
    format: 'detect',
    mermaid: false,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en'],
    localeConfigs: {
      'zh-CN': {label: '中文', htmlLang: 'zh-CN'},
      en: {label: 'English', htmlLang: 'en'},
    },
  },
  themes: [],

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['zh', 'en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/focus-creative-games/zts-doc/tree/main/',
          numberPrefixParser: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/logo.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ZTS 文档',
      logo: {
        alt: 'ZTS Logo',
        src: 'img/logo.jpg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: 'Architecture',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/focus-creative-games/zts-demo',
          label: 'Demo',
          position: 'right',
        },
        {
          href: 'https://github.com/focus-creative-games/zts',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Comparison', to: '/docs/category/compare/'},
            {label: 'Spec', to: '/docs/category/spec/'},
            {label: 'Quick start', to: '/docs/getting-started/quick-start/'},
            {label: 'Guides', to: '/docs/guides/install/'},
            {label: 'API reference', to: '/docs/reference/overview/'},
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/focus-creative-games/zts/issues',
            },
            {label: 'Contact & FAQ', to: '/docs/community/contact/'},
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'ZTS source',
              href: 'https://github.com/focus-creative-games/zts',
            },
            {
              label: 'Demo project',
              href: 'https://github.com/focus-creative-games/zts-demo',
            },
            {
              label: 'ZLua docs',
              href: 'https://doc.zlua.cn',
            },
            {
              label: 'zts-ue (Unreal, WIP)',
              href: 'https://github.com/focus-creative-games/zts-ue',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Code Philosophy. ZTS is MIT-licensed.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'typescript', 'javascript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
