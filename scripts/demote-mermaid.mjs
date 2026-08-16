#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (/\.(md|mdx)$/.test(ent.name)) yield p;
  }
}

let n = 0;
for (const root of ['docs', 'i18n']) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    const s = fs.readFileSync(f, 'utf8');
    if (!s.includes('```mermaid')) continue;
    fs.writeFileSync(f, s.replace(/```mermaid/g, '```text'));
    n++;
    console.log(f);
  }
}
console.log('demoted', n);
