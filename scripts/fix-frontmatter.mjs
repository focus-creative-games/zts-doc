#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function* walk(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else if (ent.name.endsWith('.md') || ent.name.endsWith('.mdx')) yield p;
  }
}

function needsQuote(v) {
  return /[:\[\]{}#&*!|>%@`]/.test(v) || v.includes(':') || /^[-?]/.test(v);
}

function quoteField(fm, key) {
  return fm.replace(new RegExp(`^(${key}:\\s*)(.+)$`, 'm'), (m, prefix, raw) => {
    const v = raw.trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      return m;
    }
    if (!needsQuote(v)) return m;
    return `${prefix}"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  });
}

function fixFile(file) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.startsWith('---')) return false;
  const end = s.indexOf('\n---', 3);
  if (end < 0) return false;
  let fm = s.slice(0, end + 4);
  const body = s.slice(end + 4);
  let next = fm;
  next = quoteField(next, 'description');
  next = quoteField(next, 'title');
  if (next === fm) return false;
  fs.writeFileSync(file, next + body);
  return true;
}

let n = 0;
for (const root of ['docs', 'i18n']) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    if (fixFile(f)) {
      n++;
      console.log(f);
    }
  }
}
console.log('fixed', n);
