#!/usr/bin/env node
/**
 * Sync ZenTSTest/Docs/spec → docs/spec, and GLOSSARY → docs/concepts/glossary.md.
 * Edit upstream ZenTSTest/Docs/spec, then npm run sync-spec. Do not hand-edit docs/spec.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function resolveUpstream(preferredParts, legacyParts, envKeys) {
  for (const key of envKeys) {
    if (process.env[key]) return path.resolve(root, process.env[key]);
  }
  const preferred = path.resolve(root, ...preferredParts);
  if (fs.existsSync(preferred)) return preferred;
  return path.resolve(root, ...legacyParts);
}

const specSrc = resolveUpstream(
  ['..', 'ZenTSTest', 'Docs', 'spec'],
  ['..', 'ZTSTest', 'Docs', 'spec'],
  ['ZENTS_SPEC_SRC', 'ZTS_SPEC_SRC'],
);
const glossarySrc = resolveUpstream(
  ['..', 'ZenTSTest', 'Docs', 'GLOSSARY.md'],
  ['..', 'ZTSTest', 'Docs', 'GLOSSARY.md'],
  ['ZENTS_GLOSSARY_SRC', 'ZTS_GLOSSARY_SRC'],
);

const specDest = path.join(root, 'docs', 'spec');
const glossaryDest = path.join(root, 'docs', 'concepts', 'glossary.md');

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, {recursive: true, force: true});
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, {recursive: true});
  for (const ent of fs.readdirSync(src, {withFileTypes: true})) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function* walkMd(dir) {
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkMd(p);
    else if (ent.isFile() && ent.name.endsWith('.md')) yield p;
  }
}

function demoteMermaid(content) {
  // Docusaurus 3.10 + React 19 SSG: MermaidRenderer calls useColorMode outside provider.
  // Keep diagrams readable as fenced text until upstream is fixed.
  return content.replace(/```mermaid/g, '```text');
}

function rewriteLinks(content, {isGlossary = false} = {}) {
  let out = content;
  out = out.replace(/\]\(\.\.\/GLOSSARY\.md\)/g, '](/docs/concepts/glossary/)');
  out = out.replace(/\]\(\.\.\/GLOSSARY\)/g, '](/docs/concepts/glossary/)');
  out = out.replace(/\]\(GLOSSARY\.md\)/g, '](/docs/concepts/glossary/)');
  // Directory-style relative links → absolute doc routes (trailingSlash site)
  out = out.replace(/\]\(\.\/marshal\/?(?:index\.md)?\)/g, '](/docs/spec/marshal/)');
  out = out.replace(/\]\(\.\/metatable\/?(?:index\.md)?\)/g, '](/docs/spec/metatable/)');
  out = out.replace(/\]\(\.\.\/marshal\/?(?:index\.md)?\)/g, '](/docs/spec/marshal/)');
  out = out.replace(/\]\(\.\.\/metatable\/?(?:index\.md)?\)/g, '](/docs/spec/metatable/)');
  out = out.replace(/\]\(\.\.\/marshal\/\)/g, '](/docs/spec/marshal/)');
  out = out.replace(/\]\(\.\.\/metatable\/\)/g, '](/docs/spec/metatable/)');
  if (isGlossary) {
    out = out.replace(
      /\]\(\.\/spec\/([^)#]+?)(?:\.md)?(#[^)]*)?\)/g,
      (_, p, hash) => `](/docs/spec/${p}/${hash || ''})`,
    );
  }
  return out;
}

function ensureSpecBanner(content, rel) {
  const banner =
    `:::note 文档站副本\n` +
    `本页为语义契约的发布副本；请在上游 \`ZenTSTest/Docs/spec\` 修改后执行 \`npm run sync-spec\`。` +
    (rel ? `（源：\`${String(rel).replace(/\\\\/g, '/')}\`）` : '') +
    `\n:::\n\n`;
  if (content.includes('文档站副本')) return content;
  if (content.startsWith('---')) {
    const end = content.indexOf('\n---', 3);
    if (end !== -1) {
      const after = end + 4;
      return content.slice(0, after) + '\n' + banner + content.slice(after).replace(/^\n+/, '\n');
    }
  }
  return banner + content;
}

if (!fs.existsSync(specSrc)) {
  console.error(`spec source not found: ${specSrc}`);
  process.exit(1);
}

rmrf(specDest);
copyDir(specSrc, specDest);

let rewritten = 0;
for (const file of walkMd(specDest)) {
  const rel = path.relative(specDest, file);
  const body = fs.readFileSync(file, 'utf8');
  const next = demoteMermaid(ensureSpecBanner(rewriteLinks(body), rel));
  if (next !== body) {
    fs.writeFileSync(file, next);
    rewritten++;
  }
}

fs.mkdirSync(path.dirname(glossaryDest), {recursive: true});
if (fs.existsSync(glossarySrc)) {
  let g = fs.readFileSync(glossarySrc, 'utf8');
  if (!g.startsWith('---')) {
    g =
      `---\nsidebar_position: 90\ntitle: 术语表\ndescription: ZenTS / ZLua 对齐术语（从 ZenTSTest Docs/GLOSSARY 同步）。\n---\n\n` +
      g;
  }
  g = rewriteLinks(g, {isGlossary: true});
  if (!g.includes('文档站副本')) {
    g = g.replace(
      /^---\n([\s\S]*?)\n---\n/,
      `---\n$1\n---\n\n:::note 文档站副本\n术语表上游为 \`ZenTSTest/Docs/GLOSSARY.md\`；修改后执行 \`npm run sync-spec\`。\n:::\n\n`,
    );
  }
  fs.writeFileSync(glossaryDest, g);
  console.log('glossary → docs/concepts/glossary.md');
} else {
  console.warn(`glossary not found: ${glossarySrc}`);
}

console.log(`spec ${specSrc} → ${specDest} (rewrote ${rewritten} files)`);
