import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Translate from '@docusaurus/Translate';
import styles from './styles.module.css';

function Feature({
  title,
  icon,
  description,
}: {
  title: ReactNode;
  icon: string;
  description: ReactNode;
}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <div className="featureIcon">{icon}</div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <Feature
            icon="⚡"
            title={
              <Translate id="homepage.feature.easy.title">更易用 · 零配置</Translate>
            }
            description={
              <Translate id="homepage.feature.easy.desc">
                声明式 GetFunction / [JsMarshalAs]，CSharp 懒绑定；无需 per-type Wrap
                白名单。与 ZLua 同一套产品心智。
              </Translate>
            }
          />
          <Feature
            icon="🟦"
            title={
              <Translate id="homepage.feature.ts.title">TypeScript 一等公民</Translate>
            }
            description={
              <Translate id="homepage.feature.ts.desc">
                官方 TsProject 工作流、csharp: 声明、进 Play 闸门；运行时仍只执行 emit
                后的 ES module。
              </Translate>
            }
          />
          <Feature
            icon="📦"
            title={
              <Translate id="homepage.feature.il2cpp.title">
                Il2Cpp 就绪 · 双运行时
              </Translate>
            }
            description={
              <Translate id="homepage.feature.il2cpp.desc">
                Editor Mono 便于迭代；Player Il2Cpp 走 C++ 桥，签名复用 stub，ByVal /
                Registry Marshal。
              </Translate>
            }
          />
        </div>
      </div>
    </section>
  );
}
