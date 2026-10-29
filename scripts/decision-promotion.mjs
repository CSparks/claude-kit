#!/usr/bin/env node
// decision-promotion.mjs — project decisions that settle kit or framework concerns (KIT-D111) and have not been
// promoted to a KIT or RG decision, so the next project does not re-litigate them.
//
//   unpromoted(root, { kitRoot })        -> [{ id, title, date, why }] newest first
//   promotionLines(root, { kitRoot })    -> the orient block lines ([] when nothing is flagged or `root` is the kit)
//   node scripts/decision-promotion.mjs --root <project> [--limit N]   lists the store's flagged decisions
//
// A decision is a candidate when its title or summary names a kit or framework concern (CONCERN). It is promoted when
// its frontmatter has `promoted: KIT-D### | RG-D### | none (<why>)`, or when a KIT or RG decision text cites its id.

import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CONCERN = /\b(?:broker|nextest|claude-kit|kit-d\d+|hooks?|dispatch(?:-guard)?|orient|patch-worker|sub-?agents?|test tiers?|tiered|build slots?|rapid-game|framework|shared crates?|rg-[a-z]+|cargo profile|target dir)\b/i;
const SHOWN = 3;
const DEFAULT_LIMIT = 40;

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

const decisionDirs = (root) => [join(root, '.ai', 'decisions'), join(root, 'rapid-game', '.ai', 'decisions')].filter(existsSync);

function citedIds(kitRoot, root) {
  const dirs = [join(kitRoot, '.ai', 'decisions'), ...(resolve(root) === resolve(kitRoot) ? [] : [join(root, 'rapid-game', '.ai', 'decisions')])].filter(existsSync);
  let text = '';
  for (const dir of dirs) for (const f of readdirSync(dir)) if (/^(?:KIT|RG)-D\d+.*\.md$/.test(f)) text += `${readFileSync(join(dir, f), 'utf8')}\n`;
  return text;
}

export function unpromoted(root, { kitRoot = KIT_ROOT } = {}) {
  const dir = join(root, '.ai', 'decisions');
  if (!existsSync(dir) || realpathSync(root) === realpathSync(kitRoot)) return [];
  const cited = citedIds(kitRoot, root);
  const flagged = [];
  for (const f of readdirSync(dir).filter((x) => /^[A-Z]+-D\d+.*\.md$/.test(x) && !x.startsWith('KIT-') && !x.startsWith('RG-'))) {
    const fm = frontmatter(readFileSync(join(dir, f), 'utf8'));
    const id = fm.id || f.split('-').slice(0, 2).join('-');
    const why = (CONCERN.exec(`${fm.title || ''} ${fm.summary || ''}`) || [])[0];
    if (!why || fm.promoted || new RegExp(`\\b${id}\\b`).test(cited)) continue;
    flagged.push({ id, title: fm.title || '', date: fm.date || '', why: why.toLowerCase() });
  }
  return flagged.sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}

export function promotionLines(root, opts = {}) {
  let flagged;
  try { flagged = unpromoted(root, opts); } catch { return []; }
  if (!flagged.length) return [];
  return [
    `--- UNPROMOTED KIT/FRAMEWORK DECISIONS (KIT-D111): ${flagged.length} in this store; each is a rule the next project will not see ---`,
    ...flagged.slice(0, SHOWN).map((d) => `  ${d.id} (${d.date}) ${d.title.slice(0, 110)} [${d.why}]`),
    `  promote to a KIT/RG decision that cites the id, or add "promoted: none (<why>)"; full list: node ${join(opts.kitRoot || KIT_ROOT, 'scripts', 'decision-promotion.mjs')} --root ${root}`,
    '',
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null; };
  const root = resolve(arg('root') || process.cwd());
  const limit = Number(arg('limit')) || DEFAULT_LIMIT;
  const flagged = unpromoted(root);
  console.log(`${root}: ${flagged.length} unpromoted kit/framework decision(s)`);
  for (const d of flagged.slice(0, limit)) console.log(`  ${d.id}  ${d.date}  [${d.why}]  ${d.title.slice(0, 120)}`);
  if (flagged.length > limit) console.log(`  … ${flagged.length - limit} more (--limit ${flagged.length})`);
}
