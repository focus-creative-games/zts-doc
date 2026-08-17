import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Translate, {translate} from '@docusaurus/Translate';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import RuntimeBadge from '@site/src/components/RuntimeBadge';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          <Translate id="homepage.title">ZenTS 文档</Translate>
          <span className="badgeAlpha">Alpha</span>
        </Heading>
        <p className="hero__subtitle">
          <Translate id="homepage.tagline">
            零配置 · 完备 C# 互操作 · QuickJS 上的 TypeScript / JavaScript
          </Translate>
        </p>
        <div className={styles.runtimeRow}>
          <RuntimeBadge />
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            <Translate id="homepage.cta.quickStart">5 分钟快速开始</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            href="https://github.com/focus-creative-games/zen-ts-demo">
            <Translate id="homepage.cta.demo">查看 Demo</Translate>
          </Link>
        </div>
        <p className={styles.heroMeta}>
          <Translate id="homepage.heroMeta">
            Unity 2021.3 / 2022.3 / 6000 · 团结 · QuickJS · Editor Win/macOS · Player 含 Win64 / Android / iOS / WebGL / 小游戏 / 鸿蒙
          </Translate>
        </p>
      </div>
    </header>
  );
}

const CSHARP_INVOKE = `// Bootstrap
JsAppDomain.Initialize(LoadJsModule);

void Start()
{
    var add = JsAppDomain.GetFunction<Func<int, int, int>>("app", "add");
    Debug.Log(add(10, 20)); // 30
}`;

const JS_EXPORT = `// JsScripts/app.js  (canonical: "app")
export function add(a, b) {
  return a + b;
}`;

const JS_TO_CSHARP = `import { Demo } from "csharp:Assembly-CSharp";

const d = new Demo();
d.x = 10;
console.log("Add:", Demo.Add(3, 5));`;

function CodePreview() {
  return (
    <section className={clsx('container', styles.codePreview)}>
      <Heading as="h2" className={styles.codePreviewTitle}>
        <Translate id="homepage.codePreview.title">双向调用一览</Translate>
      </Heading>
      <Tabs groupId="homepage-code" className={styles.codeTabs}>
        <TabItem
          value="cs2js"
          label={translate({id: 'homepage.tab.cs2js', message: 'C# → JS'})}
          default>
          <pre className={styles.codeBlock}>
            <code>{CSHARP_INVOKE}</code>
          </pre>
          <pre className={styles.codeBlock}>
            <code>{JS_EXPORT}</code>
          </pre>
        </TabItem>
        <TabItem
          value="js2cs"
          label={translate({id: 'homepage.tab.js2cs', message: 'JS/TS → C#'})}>
          <pre className={styles.codeBlock}>
            <code>{JS_TO_CSHARP}</code>
          </pre>
        </TabItem>
      </Tabs>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title={translate({
        id: 'homepage.layoutTitle',
        message: '首页',
      })}
      description={translate({
        id: 'homepage.layoutDesc',
        message:
          'ZenTS：Unity 上基于 QuickJS 的 TypeScript / JavaScript 脚本方案，设计与 ZLua 对齐。',
      })}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <CodePreview />
      </main>
    </Layout>
  );
}
